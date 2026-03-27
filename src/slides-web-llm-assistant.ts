/**
 * In-browser copresenter LLM via Transformers.js (WASM + quantized ONNX).
 * No tools, no localhost server — downloads model weights from Hugging Face on first use.
 *
 * The library loads from jsDelivr so `slides-web-llm.js` stays small for static hosting;
 * weights cache in the browser after the first run.
 *
 * Built to docs/slides-web-llm.js — see vite.config.slides-web-llm.ts
 */
// @ts-nocheck

/** Same behavior as `stripToolBlocksForSpeech` in stream-tool-tags (inlined to keep this chunk tiny). */
function stripToolBlocksForSpeech(raw) {
  let s = String(raw || '').replace(/<tools\b[^>]*>[\s\S]*?<\/tools>/gi, '');
  const open = s.search(/<tools\b/i);
  if (open !== -1) {
    const tail = s.slice(open);
    if (!/<\/tools>/i.test(tail)) s = s.slice(0, open);
  }
  return s;
}

/** Default: ~135M params, q4 ONNX — small download vs larger instruct models. */
export const DEFAULT_WEB_LLM_MODEL = 'onnx-community/SmolLM2-135M-Instruct-ONNX';

const TRANSFORMERS_CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';

let transformersMod = null;
let modelId = DEFAULT_WEB_LLM_MODEL;
let connected = false;
/** @type {Promise<any> | null} */
let pipelinePromise = null;
/** @type {string | null} */
let pipelineForModelId = null;

async function loadTransformers() {
  if (!transformersMod) {
    transformersMod = await import(/* @vite-ignore */ TRANSFORMERS_CDN);
    const { env } = transformersMod;
    if (env) {
      env.allowLocalModels = false;
      env.allowRemoteModels = true;
    }
    // TTS already uses worker.js; the LLM used to run ORT WASM on the main thread and could freeze the UI.
    // ORT's wasm.proxy runs inference in a dedicated worker (not the TTS worker, but off the UI thread).
    const wasm = env?.backends?.onnx?.wasm;
    if (wasm) {
      wasm.proxy = true;
      if (typeof wasm.numThreads === 'number' && wasm.numThreads > 2) wasm.numThreads = 2;
    }
  }
  return transformersMod;
}

function resetPipeline() {
  pipelinePromise = null;
  pipelineForModelId = null;
}

async function getTextGenerator() {
  const { pipeline, env } = await loadTransformers();
  if (pipelineForModelId !== modelId) {
    resetPipeline();
    pipelineForModelId = modelId;
    const tryWebGpu = Boolean(env?.IS_WEBGPU_AVAILABLE);
    if (tryWebGpu) {
      try {
        pipelinePromise = pipeline('text-generation', modelId, {
          dtype: 'q4',
          device: 'webgpu',
        });
        await pipelinePromise;
      } catch {
        pipelinePromise = pipeline('text-generation', modelId, {
          dtype: 'q4',
          device: 'wasm',
        });
      }
    } else {
      pipelinePromise = pipeline('text-generation', modelId, {
        dtype: 'q4',
        device: 'wasm',
      });
    }
  }
  return pipelinePromise;
}

function stripForSpeech(text) {
  return stripToolBlocksForSpeech(String(text || ''))
    .replace(/^\s*(?:action|narration|stage|tool)\s*:\s*/i, '')
    .replace(/\[(?:\s*)(?:pause|beat|laughs?|laughing|applause|gasps?|sighs?|music)(?:\s*)\]/gi, ' ')
    .replace(/\((?:\s*)(?:pause|beat|laughs?|applause)(?:\s*)\)/gi, ' ')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\|[^|]+\|>/g, '')
    .replace(/\*+/g, '')
    .replace(/[#_~`>]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const SENT_END = /[.!?]\s+|[.!?]$/;

function splitIntoSpeechSentences(full) {
  const t = stripForSpeech(full);
  if (!t) return [];
  const out = [];
  let rest = t;
  let match;
  while ((match = rest.match(SENT_END)) !== null) {
    const idx = match.index + match[0].length;
    const sentence = rest.slice(0, idx).trim();
    rest = rest.slice(idx).trim();
    if (sentence) out.push(sentence);
  }
  if (rest.trim()) out.push(rest.trim());
  return out.length ? out : [t];
}

/**
 * Small quantized instruct models (SmolLM2-class) often under-use or parrot `role: system` in ChatML.
 * Fold all system text into the **first user** message so the template is only user/assistant turns.
 * (Callers can keep storing `system` in history; this runs right before `buildChatPrompt`.)
 */
function mergeSystemIntoUserMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return messages;
  const systemChunks = [];
  const body = [];
  for (let i = 0; i < messages.length; i += 1) {
    const m = messages[i];
    if (!m || typeof m !== 'object') continue;
    if (m.role === 'system' && typeof m.content === 'string') {
      const t = m.content.trim();
      if (t) systemChunks.push(t);
    } else {
      body.push(m);
    }
  }
  if (systemChunks.length === 0) return messages;
  const sys = systemChunks.join('\n\n');
  const prefix = `${sys}\n\n---\n\n`;
  const out = [];
  let merged = false;
  for (let j = 0; j < body.length; j += 1) {
    const m = body[j];
    if (!merged && m.role === 'user') {
      const c = typeof m.content === 'string' ? m.content : String(m.content ?? '');
      out.push({ ...m, content: prefix + c });
      merged = true;
    } else {
      out.push(m);
    }
  }
  if (!merged) {
    out.unshift({ role: 'user', content: prefix.trimEnd() });
  }
  return out;
}

function buildChatPrompt(tokenizer, messages) {
  if (tokenizer && typeof tokenizer.apply_chat_template === 'function') {
    try {
      return tokenizer.apply_chat_template(messages, {
        tokenize: false,
        add_generation_prompt: true,
      });
    } catch {
      /* fall through */
    }
  }
  let s = '';
  for (const m of messages) {
    const role = m.role === 'system' ? 'system' : m.role === 'assistant' ? 'assistant' : 'user';
    s += `<|im_start|>${role}\n${m.content}<|im_end|>\n`;
  }
  s += '<|im_start|>assistant\n';
  return s;
}

/** ChatML assistant header — same as SmolLM2 / many HF instruct models. */
const CHATML_ASSISTANT = '<|im_start|>assistant';

/**
 * `pipeline` returns `generated_text` = prompt + completion. If `startsWith(prompt)` fails (decoder /
 * Unicode drift), the code used to pass the **whole** string to TTS — including the system message.
 * Peel the completion via the last assistant segment and stop tokens.
 */
function extractAssistantCompletion(generated, prompt) {
  const g = String(generated ?? '');
  const p = String(prompt ?? '');
  if (!g) return '';

  if (p.length > 0 && g.startsWith(p)) {
    return g.slice(p.length).trim();
  }

  if (g.includes(CHATML_ASSISTANT)) {
    const idx = g.lastIndexOf(CHATML_ASSISTANT);
    let tail = g.slice(idx + CHATML_ASSISTANT.length).replace(/^\s*\n?/, '');
    for (const em of ['<|im_end|>', '<|endoftext|>', '<|eot_id|>']) {
      const at = tail.indexOf(em);
      if (at !== -1) tail = tail.slice(0, at);
    }
    tail = tail.trim();
    if (tail) return tail;
  }

  if (p.length > 0 && g.length >= p.length) {
    let i = 0;
    const n = Math.min(g.length, p.length);
    while (i < n && g.charCodeAt(i) === p.charCodeAt(i)) i += 1;
    if (i === p.length) return g.slice(i).trim();
  }

  return g.trim();
}

/**
 * @param {object} opts
 * @param {Array<{role: string, content: string}>} opts.messages
 * @param {number} [opts.temperature]
 * @param {number} [opts.maxTokens]
 * @param {(s: string) => Promise<void>} [opts.onSentence]
 * @param {() => boolean} [opts.isStale]
 */
export async function chat(opts) {
  const gen = await getTextGenerator();
  const tokenizer = gen.tokenizer;
  const { messages, temperature = 0.7, maxTokens = 128, onSentence, isStale } = opts;

  const messagesForPrompt = mergeSystemIntoUserMessages(messages);
  const prompt = buildChatPrompt(tokenizer, messagesForPrompt);
  const max_new_tokens = Math.min(Math.max(4, Math.floor(Number(maxTokens) || 128)), 512);

  const rawOut = await gen(prompt, {
    max_new_tokens,
    temperature,
    do_sample: true,
    top_p: 0.92,
  });

  const generated = rawOut?.[0]?.generated_text ?? '';
  const answer = extractAssistantCompletion(generated, prompt);
  const cleaned = stripForSpeech(answer).trim();
  const finalText = cleaned || stripForSpeech(answer).trim() || answer.trim();

  if (typeof onSentence === 'function') {
    let parts = splitIntoSpeechSentences(finalText);
    if (parts.length === 0 && String(finalText || '').trim().length > 0) {
      parts = [String(finalText).trim()];
    }
    for (const sent of parts) {
      if (isStale?.()) return '';
      const chunk = String(sent || '').trim();
      if (!chunk) continue;
      await onSentence(chunk);
    }
  }

  return finalText || 'I could not produce an answer. Try rephrasing.';
}

export function getBaseUrl() {
  return 'browser';
}

export function getModel() {
  return modelId;
}

export function isConnected() {
  return connected;
}

export function setModel(m) {
  const next = typeof m === 'string' && m.trim() ? m.trim() : DEFAULT_WEB_LLM_MODEL;
  if (next !== modelId) {
    modelId = next;
    resetPipeline();
  }
}

export function disconnect() {
  connected = false;
}

/**
 * @param {string} [_baseUrl] — ignored (Ollama compatibility)
 * @param {string} [requestedModel]
 * @param {(msg: string) => void} [onStatus]
 */
export async function connect(_baseUrl, requestedModel, onStatus) {
  const want =
    typeof requestedModel === 'string' && requestedModel.trim()
      ? requestedModel.trim()
      : DEFAULT_WEB_LLM_MODEL;
  modelId = want;
  resetPipeline();

  onStatus?.('Loading Transformers.js…');
  await loadTransformers();

  onStatus?.(`Downloading / compiling ${modelId} (first visit can take a minute)…`);
  await getTextGenerator();

  connected = true;
  onStatus?.(`Ready — ${modelId}`);
  return { models: [modelId] };
}

export function getLastChatUsage() {
  return null;
}

const kittenSlidesWebLlmApi = {
  connect,
  disconnect,
  isConnected,
  getModel,
  getBaseUrl,
  setModel,
  chat,
  getLastChatUsage,
};

if (typeof window !== 'undefined') {
  window.kittenSlidesWebLlm = kittenSlidesWebLlmApi;
}
