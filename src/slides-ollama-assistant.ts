/**
 * Ollama localhost LLM adapter.
 * Uses the native /api/chat endpoint (not OpenAI-compat).
 * Every request sets top-level `think: false` unless callers pass `think: true`, so
 * reasoning-capable models (e.g. Qwen 3.5) do not spend tokens in hidden thinking.
 * Ollama chat API documents `think` as a boolean on the request body.
 * Streaming is NDJSON (one JSON object per line).
 *
 * Slide actions (highlight, bullets, go_to_slide, fireworks) use Ollama native `tools` + streamed `message.tool_calls`
 * (see https://github.com/ollama/ollama/pull/10415). Assistant `content` is still
 * passed through `stripToolBlocksForSpeech` so accidental XML in text is not spoken.
 * Duplicate native calls in one turn are skipped via `stableToolCallFingerprint`.
 *
 * Built to docs/slides-ollama.js via vite.config.slides-ollama.ts (loaded by docs/slides-lab.js).
 */

import {
  slideToolCallSortKey,
  stableToolCallFingerprint,
  stripToolBlocksForSpeech,
} from './stream-tool-tags.js';

/** Wire shape for Ollama /api/chat (tool follow-ups). */
export type OllamaToolCallWire = {
  type: 'function';
  function: {
    index?: number;
    name: string;
    arguments: Record<string, unknown>;
  };
};

export type ChatMsg =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; tool_calls?: OllamaToolCallWire[] }
  | { role: 'tool'; content: string; tool_name: string };

/** Serialize messages for Ollama /api/chat (supports tool role + assistant tool_calls). */
export function messagesForOllamaApi(msgs: ChatMsg[]): Record<string, unknown>[] {
  return msgs.map((m) => {
    if (m.role === 'system' || m.role === 'user') {
      return { role: m.role, content: m.content };
    }
    if (m.role === 'tool') {
      return { role: 'tool', tool_name: m.tool_name, content: m.content };
    }
    const c = typeof m.content === 'string' ? m.content : '';
    const content = c.trim().length === 0 ? ' ' : c;
    if (m.tool_calls?.length) {
      return { role: 'assistant', content, tool_calls: m.tool_calls };
    }
    return { role: 'assistant', content };
  });
}

export type ToolCall = {
  function: { name: string; arguments: Record<string, unknown> };
};

export type OllamaChatOpts = {
  messages: ChatMsg[];
  temperature?: number;
  maxTokens?: number;
  /** When true, send `think: true` to Ollama; default false disables hidden reasoning. */
  think?: boolean;
  /** Stream token-by-token and flush sentences to this callback. */
  onSentence?: (sentence: string) => Promise<void>;
  /** Run deck actions from Ollama streamed `tool_calls`. */
  onToolCall?: (call: ToolCall) => Promise<string>;
  /** Return true to abort mid-stream (barge-in). */
  isStale?: () => boolean;
};

/**
 * Populated from Ollama `/api/chat` JSON (and streaming `done` lines): real tokenizer counts when present.
 * @see https://github.com/ollama/ollama/blob/main/docs/api.md — `prompt_eval_count`, `eval_count`
 */
export type OllamaChatUsageSnapshot = {
  promptEvalCount: number;
  evalCount: number;
  /** One per HTTP `/api/chat` (tool follow-ups are multiple calls). */
  apiCalls: number;
};

let lastChatUsage: OllamaChatUsageSnapshot | null = null;

function resetChatUsageForRequest(): void {
  lastChatUsage = { promptEvalCount: 0, evalCount: 0, apiCalls: 0 };
}

function mergeOllamaUsageFromJson(json: Record<string, unknown> | null | undefined): void {
  if (!lastChatUsage || !json) return;
  const pe = json.prompt_eval_count;
  const ec = json.eval_count;
  if (typeof pe === 'number' && pe >= 0) lastChatUsage.promptEvalCount += pe;
  if (typeof ec === 'number' && ec >= 0) lastChatUsage.evalCount += ec;
}

/** Latest completed `chat()` totals (sums tool rounds). May omit counts when Ollama omits fields (e.g. cache). */
export function getLastChatUsage(): OllamaChatUsageSnapshot | null {
  return lastChatUsage ? { ...lastChatUsage } : null;
}

let baseUrl = 'http://localhost:11434';
let model = 'qwen3.5:2b';
let connected = false;

/** Extra headers for every Ollama HTTP call (e.g. `Authorization: Bearer …` for https://ollama.com). */
let requestHeaders: Record<string, string> = {};

export function setOllamaRequestHeaders(headers: Record<string, string> | null | undefined): void {
  requestHeaders = headers && typeof headers === 'object' ? { ...headers } : {};
}

function ollamaFetchInit(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...requestHeaders,
    },
    body: JSON.stringify(body),
  };
}

/**
 * Ollama /api/chat `tools` list for Kiki (copresenter).
 * Intentionally narrow: highlight, bullets, slide changes, fireworks only.
 * Other stage actions (voice, overlay, diagram jumps) were previously wired from the slides lab; the shipped `slides.html` is TTS-only.
 */
export const OLLAMA_SLIDE_TOOLS: readonly unknown[] = [
  {
    type: 'function',
    function: {
      name: 'highlight_text',
      description: 'Highlight a phrase on the current slide body or title.',
      parameters: {
        type: 'object',
        required: ['text'],
        properties: {
          text: { type: 'string', description: 'Substring to highlight (matched case-insensitively).' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'emphasize_bullet',
      description: 'Emphasize one bullet line on the current slide.',
      parameters: {
        type: 'object',
        required: ['index'],
        properties: {
          index: { type: 'number', description: '1-based bullet index.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'go_to_slide',
      description: 'Jump to a slide by 1-based slide number.',
      parameters: {
        type: 'object',
        required: ['slide_number'],
        properties: {
          slide_number: { type: 'number', description: 'Slide number from 1 to deck length.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fireworks',
      description: 'Celebrate with a short fireworks animation on stage.',
      parameters: {
        type: 'object',
        properties: {
          duration_seconds: { type: 'number', description: 'Duration in seconds (1–8).' },
        },
      },
    },
  },
];

function stripForSpeech(text: string): string {
  return text
    .replace(/^\s*(?:action|narration|stage|tool)\s*:\s*/i, '')
    .replace(/\[(?:\s*)(?:pause|beat|laughs?|laughing|applause|gasps?|sighs?|music)(?:\s*)\]/gi, ' ')
    .replace(/\((?:\s*)(?:pause|beat|laughs?|applause)(?:\s*)\)/gi, ' ')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\|[^|]+\|>/g, '')
    .replace(/<tools\b[^>]*>[\s\S]*?<\/tools>/gi, '')
    .replace(/\*+/g, '')
    .replace(/[#_~`>]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

type OllamaStreamFunctionDelta = {
  index?: number;
  name?: string;
  arguments?: string | Record<string, unknown> | null;
};

type OllamaStreamToolCallDelta = {
  index?: number;
  id?: string;
  type?: string;
  function?: OllamaStreamFunctionDelta;
};

type OllamaStreamMessage = {
  role?: string;
  content?: string;
  tool_calls?: OllamaStreamToolCallDelta[] | OllamaStreamToolCallDelta;
};

export type NativeToolSlot = { name: string; argsStr: string };

/** Normalize streamed `tool_calls` (array or single object). */
export function normalizeOllamaToolCallDeltas(raw: unknown): OllamaStreamToolCallDelta[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw as OllamaStreamToolCallDelta[];
  if (typeof raw === 'object') return [raw as OllamaStreamToolCallDelta];
  return [];
}

/**
 * Extract tool call deltas from one NDJSON object (`message.tool_calls` or rare top-level `tool_calls`).
 */
export function extractToolCallDeltasFromStreamChunk(parsed: unknown): OllamaStreamToolCallDelta[] {
  if (!parsed || typeof parsed !== 'object') return [];
  const p = parsed as Record<string, unknown>;
  const msg = p.message as Record<string, unknown> | undefined;
  const fromMsg = msg?.tool_calls;
  const fromRoot = p.tool_calls;
  return normalizeOllamaToolCallDeltas(fromMsg ?? fromRoot);
}

function slotIndexForDelta(d: OllamaStreamToolCallDelta, arrayIndex: number): number {
  if (typeof d.index === 'number') return d.index;
  const fi = d.function?.index;
  if (typeof fi === 'number') return fi;
  return arrayIndex;
}

/** Exported for tests — accumulates streamed `tool_calls` into slots by index. */
export function mergeOllamaToolDeltas(
  slots: Map<number, NativeToolSlot>,
  deltas: OllamaStreamToolCallDelta[],
): void {
  for (let i = 0; i < deltas.length; i += 1) {
    const d = deltas[i];
    const idx = slotIndexForDelta(d, i);
    const fn = d.function;
    if (!fn) continue;
    const arg = fn.arguments;
    const hasName = typeof fn.name === 'string' && fn.name.trim().length > 0;
    const hasArg = arg != null && arg !== '';
    if (!hasName && !hasArg) continue;
    const cur = slots.get(idx) ?? { name: '', argsStr: '' };
    if (hasName) cur.name = fn.name!.trim();
    if (arg != null && arg !== '') {
      if (typeof arg === 'string') {
        cur.argsStr += arg;
      } else if (typeof arg === 'object' && !Array.isArray(arg)) {
        cur.argsStr = JSON.stringify(arg);
      }
    }
    slots.set(idx, cur);
  }
}

function slotToToolCall(slot: NativeToolSlot): ToolCall | null {
  const name = slot.name.trim();
  if (!name) return null;
  const s = slot.argsStr.trim();
  let args: Record<string, unknown> = {};
  if (s) {
    try {
      const p = JSON.parse(s) as unknown;
      if (p && typeof p === 'object' && !Array.isArray(p)) args = p as Record<string, unknown>;
      else return null;
    } catch {
      return null;
    }
  }
  return { function: { name, arguments: args } };
}

/** Materialize merged stream slots into tool calls (parseable JSON args only), ordered by slot index. */
export function listReadyToolCallsFromSlots(slots: Map<number, NativeToolSlot>): ToolCall[] {
  const out: ToolCall[] = [];
  const ordered = [...slots.entries()].sort((a, b) => a[0] - b[0]);
  for (const [, s] of ordered) {
    const tc = slotToToolCall(s);
    if (tc) out.push(tc);
  }
  return out;
}

async function flushReadyNativeToolCalls(
  slots: Map<number, NativeToolSlot>,
  executedFingerprints: Set<string>,
  toolCallSortKey: (name: string) => number,
  onToolCall: (c: ToolCall) => Promise<string>,
  toolResultsByFingerprint: Map<string, string>,
  isStale?: () => boolean,
): Promise<void> {
  const ready: ToolCall[] = [];
  for (const slot of slots.values()) {
    const tc = slotToToolCall(slot);
    if (tc) ready.push(tc);
  }
  ready.sort((a, b) => toolCallSortKey(a.function.name) - toolCallSortKey(b.function.name));
  for (const tc of ready) {
    const fp = stableToolCallFingerprint(tc);
    if (executedFingerprints.has(fp)) continue;
    executedFingerprints.add(fp);
    if (isStale?.()) return;
    const result = await onToolCall(tc);
    toolResultsByFingerprint.set(fp, String(result));
  }
}

const MAX_SLIDE_TOOL_ROUNDS = 12;

function appendAssistantToolRoundToMessages(
  messages: ChatMsg[],
  rawAssistantContent: string,
  merged: ToolCall[],
  toolResultsByFingerprint: Map<string, string>,
  toolCallSortKey: (name: string) => number,
): void {
  const ordered = [...merged].sort((a, b) => toolCallSortKey(a.function.name) - toolCallSortKey(b.function.name));
  const c = rawAssistantContent.trim().length > 0 ? rawAssistantContent.trim() : ' ';
  messages.push({
    role: 'assistant',
    content: c,
    tool_calls: ordered.map((tc, i) => ({
      type: 'function' as const,
      function: {
        index: i,
        name: tc.function.name,
        arguments: tc.function.arguments,
      },
    })),
  });
  for (const tc of ordered) {
    const fp = stableToolCallFingerprint(tc);
    messages.push({
      role: 'tool',
      tool_name: tc.function.name,
      content: toolResultsByFingerprint.get(fp) ?? '',
    });
  }
}

export function getBaseUrl(): string { return baseUrl; }
export function getModel(): string { return model; }
export function isConnected(): boolean { return connected; }

export async function connect(
  url: string = baseUrl,
  requestedModel?: string,
  onStatus?: (msg: string) => void,
): Promise<{ models: string[] }> {
  baseUrl = url.replace(/\/+$/, '');
  onStatus?.(`Checking Ollama at ${baseUrl}\u2026`);

  const res = await fetch(`${baseUrl}/api/tags`, {
    signal: AbortSignal.timeout(5000),
    headers: { ...requestHeaders },
  });
  if (!res.ok) throw new Error(`Ollama returned ${res.status} from /api/tags`);
  const json = (await res.json()) as { models?: { name: string }[] };
  const models = (json.models ?? []).map((m) => m.name).sort();
  if (models.length === 0) throw new Error('Ollama has no models. Run: ollama pull qwen3.5:2b');

  const want = typeof requestedModel === 'string' ? requestedModel.trim() : '';
  if (want) {
    model = want;
  } else if (!models.some((m) => m === model || m.startsWith(model + ':'))) {
    model = models[0];
  }

  connected = true;
  onStatus?.(`Connected \u2014 model: ${model} (${models.length} available)`);
  return { models };
}

export function disconnect(): void {
  connected = false;
}

export function setModel(m: string): void {
  model = m;
}

/**
 * Send a chat completion via Ollama's native /api/chat.
 * With `onToolCall`, uses streaming, sends `tools`, and runs native `tool_calls`.
 */
export async function chat(opts: OllamaChatOpts): Promise<string> {
  resetChatUsageForRequest();
  const { messages, onSentence, onToolCall } = opts;
  const streaming = typeof onSentence === 'function';

  if (onToolCall) {
    const streamOpts = streaming ? opts : { ...opts, onSentence: async () => {} };
    return readStreamWithSlideTools(messages, streamOpts, slideToolCallSortKey);
  }

  return doStreamOrPlain(messages, opts);
}

const SENT_END = /[.!?]\s+|[.!?]$/;

/**
 * Stream + native tools, then follow Ollama tool-calling loop: append assistant `tool_calls`,
 * `tool` results, and call again until the model returns a text-only turn (always end with a user-facing message).
 * Mutates `messages` in place with assistant + tool rows for conversation persistence.
 */
async function readStreamWithSlideTools(
  messages: ChatMsg[],
  opts: OllamaChatOpts,
  toolCallSortKey: (name: string) => number,
): Promise<string> {
  const {
    temperature = 0.7,
    maxTokens = 280,
    think = false,
    onSentence,
    onToolCall,
    isStale,
  } = opts;
  const onSent = onSentence!;
  let lastToolResultSummary = '';

  for (let round = 0; round < MAX_SLIDE_TOOL_ROUNDS; round += 1) {
    const nativeSlots = new Map<number, NativeToolSlot>();
    const executedFingerprints = new Set<string>();
    const toolResultsByFp = new Map<string, string>();

    const body: Record<string, unknown> = {
      model,
      messages: messagesForOllamaApi(messages),
      stream: true,
      options: { temperature, num_predict: maxTokens },
      tools: [...OLLAMA_SLIDE_TOOLS],
    };
    body.think = think;

    const res = await fetch(`${baseUrl}/api/chat`, ollamaFetchInit(body));
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Ollama ${res.status}: ${text.slice(0, 200)}`);
    }

    if (lastChatUsage) lastChatUsage.apiCalls += 1;

    let raw = '';
    let emittedUpTo = 0;

    if (!res.body) {
      if (isStale?.()) return '';
      const json = (await res.json()) as { message?: OllamaStreamMessage } & Record<string, unknown>;
      mergeOllamaUsageFromJson(json);
      raw = String(json?.message?.content ?? '');
      const deltas = extractToolCallDeltasFromStreamChunk(json);
      if (deltas.length && onToolCall) {
        mergeOllamaToolDeltas(nativeSlots, deltas);
      }
      if (onToolCall) {
        await flushReadyNativeToolCalls(
          nativeSlots,
          executedFingerprints,
          toolCallSortKey,
          onToolCall,
          toolResultsByFp,
          isStale,
        );
      }
    } else {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let leftover = '';

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (isStale?.()) {
            reader.cancel();
            return '';
          }

          leftover += decoder.decode(value, { stream: true });
          const lines = leftover.split('\n');
          leftover = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            let parsed: { message?: OllamaStreamMessage; done?: boolean } & Record<string, unknown>;
            try {
              parsed = JSON.parse(trimmed);
            } catch {
              continue;
            }

            if (parsed.done === true) {
              mergeOllamaUsageFromJson(parsed);
              continue;
            }

            const deltas = extractToolCallDeltasFromStreamChunk(parsed);
            if (deltas.length && onToolCall) {
              mergeOllamaToolDeltas(nativeSlots, deltas);
              await flushReadyNativeToolCalls(
                nativeSlots,
                executedFingerprints,
                toolCallSortKey,
                onToolCall,
                toolResultsByFp,
                isStale,
              );
            }

            const msg = parsed.message;
            const delta = msg?.content ?? '';
            if (!delta) continue;

            raw += delta;

            const speechClean = stripToolBlocksForSpeech(raw);
            if (emittedUpTo > speechClean.length) emittedUpTo = speechClean.length;
            let sentBuf = speechClean.slice(emittedUpTo);

            let match: RegExpMatchArray | null;
            while ((match = sentBuf.match(SENT_END)) !== null) {
              const idx = match.index! + match[0].length;
              const sentence = stripForSpeech(sentBuf.slice(0, idx)).trim();
              sentBuf = sentBuf.slice(idx);
              if (sentence) await onSent(sentence);
              emittedUpTo = speechClean.length - sentBuf.length;
              if (isStale?.()) {
                reader.cancel();
                return '';
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      if (isStale?.()) return '';

      if (onToolCall) {
        await flushReadyNativeToolCalls(
          nativeSlots,
          executedFingerprints,
          toolCallSortKey,
          onToolCall,
          toolResultsByFp,
          isStale,
        );
      }
    }

    if (isStale?.()) return '';

    const merged = listReadyToolCallsFromSlots(nativeSlots);
    for (const tc of merged) {
      const fp = stableToolCallFingerprint(tc);
      const r = toolResultsByFp.get(fp);
      if (r != null && r.length > 0) lastToolResultSummary = r;
    }

    const speechClean = stripToolBlocksForSpeech(raw);
    if (emittedUpTo > speechClean.length) emittedUpTo = speechClean.length;
    const tail = stripForSpeech(speechClean.slice(emittedUpTo)).trim();
    if (tail) await onSent(tail);

    if (merged.length === 0) {
      const finalText = stripForSpeech(stripToolBlocksForSpeech(raw)).trim();
      const forHistory = finalText || lastToolResultSummary || ' ';
      messages.push({ role: 'assistant', content: forHistory });
      return finalText || lastToolResultSummary || 'Done.';
    }

    appendAssistantToolRoundToMessages(messages, raw, merged, toolResultsByFp, toolCallSortKey);
  }

  const limitMsg =
    lastToolResultSummary ||
    'I ran several stage actions but could not finish what I wanted to say. Ask again in one short question.';
  messages.push({ role: 'assistant', content: limitMsg });
  return limitMsg;
}

async function readStream(
  res: Response,
  onSentence: (s: string) => Promise<void>,
  isStale?: () => boolean,
): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let sentBuf = '';
  let full = '';
  let leftover = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (isStale?.()) { reader.cancel(); return ''; }

      leftover += decoder.decode(value, { stream: true });
      const lines = leftover.split('\n');
      leftover = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let parsed: { message?: { content?: string }; done?: boolean } & Record<string, unknown>;
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          continue;
        }
        if (parsed.done === true) {
          mergeOllamaUsageFromJson(parsed);
          continue;
        }
        const delta = parsed.message?.content ?? '';
        if (!delta) continue;

        sentBuf += delta;
        full += delta;

        let match: RegExpMatchArray | null;
        while ((match = sentBuf.match(SENT_END)) !== null) {
          const idx = match.index! + match[0].length;
          const sentence = stripForSpeech(sentBuf.slice(0, idx)).trim();
          sentBuf = sentBuf.slice(idx);
          if (sentence) await onSentence(sentence);
          if (isStale?.()) { reader.cancel(); return ''; }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (isStale?.()) return '';
  const tail = stripForSpeech(sentBuf).trim();
  if (tail) await onSentence(tail);

  return stripForSpeech(full).trim();
}

async function doStreamOrPlain(messages: ChatMsg[], opts: OllamaChatOpts): Promise<string> {
  const {
    temperature = 0.7, maxTokens = 280, think = false,
    onSentence, isStale,
  } = opts;
  const streaming = typeof onSentence === 'function';

  const body: Record<string, unknown> = {
    model,
    messages: messagesForOllamaApi(messages),
    stream: streaming,
    options: { temperature, num_predict: maxTokens },
  };
  body.think = think;

  const res = await fetch(`${baseUrl}/api/chat`, ollamaFetchInit(body));
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ollama ${res.status}: ${text.slice(0, 200)}`);
  }

  if (lastChatUsage) lastChatUsage.apiCalls += 1;

  if (!streaming) {
    if (isStale?.()) return '';
    const json = (await res.json()) as Record<string, unknown>;
    mergeOllamaUsageFromJson(json);
    return stripForSpeech((json.message as { content?: string } | undefined)?.content ?? '').trim();
  }

  return readStream(res, onSentence!, isStale);
}

const kittenSlidesOllamaApi = {
  connect,
  disconnect,
  setModel,
  getModel,
  getBaseUrl,
  isConnected,
  chat,
  setOllamaRequestHeaders,
  getLastChatUsage,
};

if (typeof window !== 'undefined') {
  window.kittenSlidesOllama = kittenSlidesOllamaApi;
}
