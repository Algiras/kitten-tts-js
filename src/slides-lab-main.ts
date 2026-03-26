// @ts-nocheck — migrated from docs/slides.html; tighten types incrementally or split modules.
import { resolveNarratorPreset } from './slides-narrator-policy.js';
import {
  NARRATOR_PHASE as NarratorPhase,
  narratorMayScheduleMicPure,
  narratorWatchdogShouldRecover,
  shouldIgnoreSttForPttAccumulation,
} from './slides-narrator-state.js';

/** Section rail + timing; separate from on-slide copy. Aligned with docs/talk-outline.md */
const deckMeta = [
  { section: 'Opening', duration: '1 min', takeaway: 'Talk title sets the theme; name and links support, not the headline.', artifacts: [], audienceQuestion: '' },
  { section: 'Plan', duration: '1 min', takeaway: 'Audience knows the arc: TTS → KittenTTS → port → build → runtimes → landscape → next.', artifacts: ['Talk outline'], audienceQuestion: '' },
  { section: 'What is TTS', duration: '2 min', takeaway: 'Neural vs browser TTS vocabulary is set.', artifacts: ['speechSynthesis', 'ONNX TTS'], audienceQuestion: 'When is built-in TTS enough vs bringing your own model?' },
  { section: 'KittenTTS', duration: '2 min', takeaway: 'Upstream is KittenML on Hugging Face; JS port is runtime only.', artifacts: ['KittenML/KittenTTS', 'Hugging Face weights'], audienceQuestion: 'Who owns the checkpoints vs the runtime?' },
  { section: 'kitten-tts-js', duration: '4 min', takeaway: 'KittenML/… in Node vs onnx-community/… in browser; why JavaScript.', artifacts: ['npm package', 'ORT Web', 'WebGPU Nano'], audienceQuestion: 'Which HF ID do I use in Node vs the browser?' },
  {
    section: 'Build process',
    duration: '3 min',
    takeaway: 'Agents plus Whisper transcript checks, waveform gates, and browser runs — not “sounds fine”.',
    artifacts: ['Cursor / Claude', 'Whisper STT vs reference', 'Waveform / level gates', 'Playwright', 'whisper-tts-eval skill'],
    audienceQuestion: 'How do you regression-test TTS without golden ears?',
  },
  {
    section: 'Eval loop',
    duration: '1 min',
    takeaway: 'One full-screen loop: change → WAV → checks → ship or iterate.',
    artifacts: ['Mermaid diagram'],
    audienceQuestion: '',
  },
  { section: 'Requirements', duration: '3 min', takeaway: 'Support matrix: Node CPU; browser WASM tiers; WebGPU Nano-only.', artifacts: ['secure context', 'model cache'], audienceQuestion: 'What breaks on Safari or without SharedArrayBuffer?' },
  { section: 'Landscape', duration: '3 min', takeaway: 'Self-host JS vs cloud vs Piper — trade who hosts the model.', artifacts: ['Web Speech', 'Cloud APIs', 'Piper'], audienceQuestion: 'When is cloud TTS worth it over npm + static hosting?' },
  {
    section: 'Roadmap',
    duration: '2 min',
    takeaway: 'Eval docs, deck scoring, worker docs, CI golden WAV + STT, community.',
    artifacts: ['GitHub issues', 'whisper-tts-eval'],
    audienceQuestion: 'What would you merge first?',
  },
  { section: 'Q&A', duration: 'as needed', takeaway: 'Links visible; seed questions if the room is quiet.', artifacts: ['Live demo URL', 'Repo URL'], audienceQuestion: 'What did we not cover?' },
  { section: 'Thank you', duration: '1 min', takeaway: 'Credit KittenML; point at the repo.', artifacts: ['Algiras/kitten-tts-js', 'KittenML attribution'], audienceQuestion: null },
];

const deck = [
  {
    title: 'kitten-tts: real-time TTS (text-to-speech) on (almost) anything',
    lede: 'Algimantas Krasauskas · AI Engineer · Wix\nkitten-tts-js — Kiki (AI assistant — copresenter for this deck) is in the loop.',
    bullets: ['🐙  https://github.com/Algiras', '💼  https://www.linkedin.com/in/asimplek/'],
    glossary: ['TTS — text-to-speech'],
    notes: 'Lead with the title; then thanks, name, role, Wix. Project repo URLs stay on Q&A / thank you — here is how to find you.',
    llmNotes:
      'At most one warm line in character if Algimantas speaks; do not spell out long URLs unless asked — say “Algiras on GitHub” or “LinkedIn asimplek” if needed (on slide: octocat + briefcase emojis).',
  },
  {
    title: 'What we’ll talk about',
    lede: 'A straight line through the port so “why JavaScript” lands after TTS (text-to-speech) and KittenTTS are defined.',
    bullets: [
      'What is TTS (text-to-speech)?',
      'What is KittenTTS? — models, voices, Hugging Face (HF — public model hub) weights',
      'Why kitten-tts-js — providers, runtimes, why JavaScript (JS)',
      'How it was built — agents; Whisper (OpenAI STT model family), waveform (audio signal), browser evals',
      'Where it runs — Node.js vs browser, requirements',
      'What else exists — stacks and tradeoffs',
      'What’s next → Q&A (questions & answers)',
    ],
    glossary: [
      'HF — Hugging Face model hub',
      'Whisper — OpenAI speech-to-text model family',
      'Node.js — JavaScript runtime on the server',
      'Evals — automated checks on audio, transcripts, browser',
    ],
    notes: '30–45 seconds. Optional: mention a short demo when you reach the port slide.',
    llmNotes:
      'If asked for the roadmap in one breath, use the seven bullets in order (detail after each em dash). Slides 6–7 are build story then eval-loop diagram alone; slide 10 is what’s next (bullets only, no diagram). Keep it under two sentences unless asked.',
  },
  {
    title: 'What is TTS?',
    lede: 'Text-to-speech turns text into audio (the waveform you hear). Neural (ML-trained) systems learn text → waveform; classical systems use hand-tuned rules and smaller models.',
    bullets: [
      'Rough pipeline: text → linguistic features (pronunciation / prosody) → acoustic model (predicts sound) → waveform.',
      'Browser speechSynthesis (built-in Web Speech API — TTS in the tab): zero setup, but fixed voices, uneven quality, no WAV (waveform audio file) pipeline, hard to A/B (compare two setups) in your stack.',
      'Neural ONNX (Open Neural Network Exchange) in JS: repeatable output, export, same code path in Node and web when you need it.',
    ],
    glossary: [
      'Waveform — audio signal over time',
      'Linguistic features — pronunciation / prosody hints for the model',
      'speechSynthesis — browser Web Speech API (built-in TTS)',
      'ONNX — open format for exchanging ML models across runtimes',
    ],
    notes: 'About one minute. Built-in TTS is great for a11y (accessibility); bring your own model when you need control.',
    llmNotes: 'Contrast “sounds fine in the OS” vs “same voice and graph everywhere I ship JS.”',
  },
  {
    title: 'What is KittenTTS?',
    lede: 'KittenTTS (KittenML / Stellon Labs) is the Python reference. The JavaScript port runs their ONNX (Open Neural Network Exchange) exports — same research, different runtime.',
    bullets: [
      'StyleTTS2-style — same neural TTS architecture family as the research line; kitten-tts-js runs exported ONNX graphs, not Python training code.',
      'Tiers: nano, micro, mini — model sizes / quality tradeoff vs cloud TTS footprint.',
      'Source of truth for weights (checkpoints — saved trained parameters): KittenML on Hugging Face (HF — model hub).',
      'Voices in the port: Bella, Jasper, Luna, Bruno, Rosie, Hugo, Kiki, Leo.',
    ],
    glossary: [
      'StyleTTS2 — neural TTS architecture family (research lineage)',
      'Checkpoints — saved weights after training',
      'HF — Hugging Face (public weights hub)',
    ],
    notes: 'Separate “who ships checkpoints” from “how we load them in JS” on the next slide. Apache-2.0 if the room asks.',
    llmNotes: 'If asked “is this your model?”, say no — runtime port; credit KittenML for architecture and voices.',
  },
  {
    title: 'Why kitten-tts-js?',
    lede: 'Unofficial TypeScript (typed superset of JavaScript) port — npm install kitten-tts-js. Same voices as upstream; runs where your JS already lives.',
    bullets: [
      'ONNX Runtime (ORT) in-process: Node CPU · browser WASM (WebAssembly; + SIMD / threads when allowed) · WebGPU when available.',
      'Streaming: async generator (yields audio chunks as they are ready), sentence chunks · cache after first download (Node dir + browser Cache API — persists fetched model bytes).',
      'Node: KittenML/… Hugging Face (HF) model IDs, CPU execution.',
      'Browser WASM: onnx-community/KittenTTS-…-ONNX — Nano, Micro, Mini tiers.',
      'Browser WebGPU: Nano ONNX only today; Micro/Mini stay on WASM (ORT WebGPU + int8 limits).',
      'Why JS (JavaScript): one language for lib + demo + tests; earlier first chunk; static pages and Web Workers (background JS threads); no Python service in your app path.',
    ],
    glossary: [
      'ORT — ONNX Runtime (runs .onnx models)',
      'TypeScript — typed superset of JavaScript',
      'Cache API — browser storage for fetched model bytes',
      'Web Workers — JavaScript off the UI thread',
    ],
    notes: 'Name the two paste targets: KittenML/… vs onnx-community/…. Demo + links fit here or on Q&A / thank you.',
    llmNotes: 'Honest tradeoff: Python is the reference; JS buys distribution and integration, not automatic win vs every cloud voice.',
  },
  {
    title: 'How it was built',
    lede: 'Agents and editors sped up the boring parts; verification stayed on real audio and browsers.',
    bullets: [
      'Cursor, Composer, Claude Code — IDE-integrated coding agents (spec → code → fix loops).',
      'Whisper (or similar STT — speech-to-text) on synthetic WAV (waveform audio) — transcript vs reference text; normalize, diff; optional WER (word error rate).',
      'Waveform / level gates — silence, peak, RMS (root mean square level) on fixed prompts so bad exports fail without listening.',
      'Playwright or browser-agent runs — real WASM (WebAssembly) / WebAudio path; not “green in Node” only.',
      'Repo skill whisper-tts-eval — same loop in Claude / Cursor for `/tts-eval` and `/whisper-eval`.',
    ],
    glossary: [
      'WER — word error rate (STT vs reference)',
      'Playwright — browser automation for real WASM paths',
      'WASM — WebAssembly in the browser',
    ],
    notes: 'Story beat: I did not trust “sounds fine” — I wanted comparable strings and signals across commits. Next slide is the loop diagram only.',
    llmNotes: 'If asked for one habit to steal: measure audio output, not only text logs.',
  },
  {
    title: 'Build / eval loop',
    lede: 'One loop: synthesize audio → run STT and waveform gates → ship only when everything passes; otherwise iterate.',
    bullets: [],
    glossary: ['STT — speech-to-text', 'WAV — waveform audio file', 'Level gates — RMS / silence / peak checks'],
    notes: 'Full-width diagram below the title row; narrate the cycle once.',
    llmNotes: 'One spoken sentence on the loop; let the graphic do the work.',
    diagram: 'reinforcement_loop',
  },
  {
    title: 'Where it runs — requirements',
    lede: 'Models are tens of MB (megabytes) — plan for download, cache, and runtime capability — not a tiny npm (Node package manager) tarball alone.',
    bullets: [
      'Node (Node.js): supported release from the repo; CPU threads configurable; first run fetches HF (Hugging Face) weights then caches.',
      'Browser: modern evergreen (auto-updated Chrome / Firefox / Safari / Edge); HTTPS (secure HTTP) or localhost for audio + fetch.',
      'WASM (WebAssembly): SIMD and multi-threading when the page and ORT (ONNX Runtime) build allow.',
      'WebGPU: capable GPU (graphics processor) + browser; GPU path is Nano-only; Micro/Mini WASM.',
      'Offline only after the cache warms — npm script diagnose:node-runtime (repo helper) for implementers.',
    ],
    glossary: [
      'Evergreen — auto-updated Chrome / Firefox / Safari / Edge',
      'SIMD — CPU parallel math (faster WASM)',
      'HTTPS — HTTP over TLS (secure context)',
    ],
    notes: 'One-sentence matrix: Node + KittenML + CPU; browser + onnx-community + WASM for all tiers; GPU only Nano.',
    llmNotes: 'If someone says “Safari?”, answer briefly: WebGPU/WASM variance — check current ORT + browser matrix.',
  },
  {
    title: 'Landscape — models, providers, requirements',
    lede: 'Pick axes: who hosts the model, and what you must ship (API — application programming interface — keys, disk, WASM, GPU).',
    bullets: [
      'Web Speech API — OS (operating system) voices; weakest control and consistency.',
      'kokoro-js (small JS TTS library) / ONNX (Open Neural Network Exchange)-in-JS peers — compare size, license, voice count.',
      'Cloud TTS (ElevenLabs, Google, Azure, OpenAI, …) — API key, billing, egress (network out); often top quality.',
      'Self-host server (Piper — open local TTS engine; containers — e.g. Docker) — ops heavy; not “static GitHub Pages only”.',
      'Python KittenTTS — same weights; different deployment than npm (Node package manager) + static hosting.',
    ],
    glossary: [
      'kokoro-js — lightweight JS / ONNX TTS option',
      'Piper — open self-hosted TTS engine',
      'Egress — billable / metered network out',
    ],
    notes: 'Position kitten-tts-js: self-hosted small ONNX, JS-native — not always replace cloud TTS.',
    llmNotes: 'If asked “what should I use?”, ask back: budget, privacy, offline, and who maintains the runtime.',
  },
  {
    title: 'What’s next?',
    lede: 'The port is useful when the loop around spoken output (TTS in your product) keeps getting tighter.',
    bullets: [
      'Document Whisper + waveform evals end-to-end — thresholds, fixtures, CI (continuous integration) hooks.',
      'Stronger listen-back / scoring in this deck lab (transcript vs intent, not only waveforms).',
      'Docs and examples for Web Worker layout (TTS off the UI thread) and streaming UX (user experience — chunk-by-chunk audio).',
      'Golden WAV (waveform audio) + transcript baselines in CI; fail PRs (pull requests) when STT (speech-to-text) or level checks drift.',
      'Community: github.com/Algiras/kitten-tts-js',
    ],
    glossary: [
      'CI — continuous integration (automated test on each change)',
      'PR — pull request (proposed code change)',
      'Web Worker — background JS thread (TTS off UI)',
    ],
    notes: 'Bridge to Q&A; optional ?debug=1 on this lab if you showed assistant tooling.',
    llmNotes: 'Keep forward-looking but concrete — no vapor roadmap.',
  },
  {
    title: 'Questions?',
    lede: 'HF (Hugging Face) IDs, WebGPU vs WASM (WebAssembly), cloud vs self-host — happy to go deep.',
    bullets: [
      'Live demo: algiras.github.io/kitten-tts-js',
      'Repo: github.com/Algiras/kitten-tts-js',
      'npm (Node package manager): kitten-tts-js',
    ],
    glossary: ['HF — Hugging Face model IDs', 'WASM vs WebGPU — CPU bytecode path vs GPU path'],
    notes: 'Stay on this slide while answering. If silence, seed: which HF ID in Node vs browser?',
    llmNotes: 'Short answers. Tools only if they help the room see a phrase on screen.',
  },
  {
    title: 'Thank you',
    lede: 'kitten-tts-js — JavaScript (JS) port of KittenTTS.',
    bullets: [
      'github.com/Algiras/kitten-tts-js',
      'Thanks to KittenML / KittenTTS for models and voices.',
      'Try this deck with ?debug=1 (verbose assistant / tool logs in the lab).',
    ],
    glossary: ['?debug=1 — URL flag for assistant / tool logging in this lab'],
    notes: 'Warm close; optional beat before leaving fullscreen.',
    llmNotes: 'One line of thanks from Algimantas and Kiki unless asked for more.',
  },
];

function formatBulletsForPlaintext(bullets) {
  if (!Array.isArray(bullets)) return '';
  const rows = [];
  for (const b of bullets) {
    if (typeof b === 'string') rows.push(b);
    else if (b && typeof b === 'object' && typeof b.text === 'string') {
      rows.push(b.text);
      if (Array.isArray(b.sub)) {
        for (const s of b.sub) rows.push(`  ${s}`);
      }
    }
  }
  return rows.map((r) => `- ${r}`).join('\n');
}

function formatGlossaryForPlaintext(slide) {
  const g = slide && Array.isArray(slide.glossary) ? slide.glossary : [];
  if (!g.length) return '';
  return `Glossary (this slide):\n${g.map((line) => `- ${line}`).join('\n')}`;
}

function maxTopLevelBulletsInDeck(slides) {
  let m = 1;
  for (const s of slides || []) {
    const n = Array.isArray(s.bullets) ? s.bullets.length : 0;
    if (n > m) m = n;
  }
  return m;
}

/**
 * Pre-validated Mermaid for this deck. Each preset is a separate zero-argument tool (`diagram_*`).
 * Keys must match `SLIDE_DIAGRAM_PRESET_KEYS` in `src/stream-tool-tags.ts`.
 * In-deck diagram: eval loop only (talk-outline slide 7).
 */
const DIAGRAM_PRESETS = {
  reinforcement_loop: {
    title: '',
    definition: `%%{init: {'flowchart': {'curve': 'basis', 'padding': 16}, 'themeVariables': {'fontSize': '22px'}}}%%
flowchart LR
  C(["Change"]) --> A(["WAV out"])
  A --> K(["STT + level gates"])
  K --> T{Pass?}
  T -->|yes| D(["Ship"])
  T -->|no| C`,
  },
} as const;

/** 0-based `deck` index where each diagram is rendered in the slide body (not an overlay). */
const DIAGRAM_PRESET_SLIDE_INDEX: Record<keyof typeof DIAGRAM_PRESETS, number> = {
  reinforcement_loop: 6,
};

const SLIDES_LAB_TTS_NANO_ONNX = 'onnx-community/KittenTTS-Nano-v0.8-ONNX';
const SLIDES_LAB_TTS_MINI_ONNX = 'onnx-community/KittenTTS-Mini-v0.8-ONNX';

/** Root-relative so URL matches slides.html whether opened as /slides, /slides/, or /slides.html. */
const worker = new Worker('/worker.js', { type: 'module' });
const pendingRequests = new Map();
let currentSlideIndex = 0;
let ttsReady = false;
let listening = false;

const recognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition || null;
const recognition = recognitionCtor ? new recognitionCtor() : null;

const slideKickerEl = document.getElementById('slide-kicker');
const slideTitleEl = document.getElementById('slide-title');
const slideLedeEl = document.getElementById('slide-lede');
const slideBulletsEl = document.getElementById('slide-bullets');
const slideGlossEl = document.getElementById('slide-gloss');
const slideDiagramEl = document.getElementById('slide-diagram');
const assistantStatusEl = document.getElementById('assistant-status');
const stageAssistantAvatarEl = document.getElementById('stage-assistant-avatar');
const stageOrbTriggerEl = document.getElementById('stage-orb-trigger');
const stageCaptionBar = document.getElementById('stage-caption-bar');
const stageCaptionText = document.getElementById('stage-caption-text');
const stagePttHint = document.getElementById('stage-ptt-hint');
const stagePttHintText = document.getElementById('stage-ptt-hint-text');
const stageCardEl = document.getElementById('stage-card');
const stageSlideRefEl = document.getElementById('stage-slide-ref');
const prevSlideBtn = document.getElementById('prev-slide');
const nextSlideBtn = document.getElementById('next-slide');
const stageWaveformEl = document.getElementById('stage-waveform');
const waveformCtx = stageWaveformEl?.getContext('2d');
const ttsChipEl = document.getElementById('tts-chip');
const sttChipEl = document.getElementById('stt-chip');
const gpuChipEl = document.getElementById('gpu-chip');
const llmChipEl = document.getElementById('llm-chip');
const ollamaUrlEl = document.getElementById('ollama-url');
const ollamaProgressEl = document.getElementById('ollama-progress');
const presentSlidesBtn = document.getElementById('present-slides');
const llmContextMeterEl = document.getElementById('llm-context-meter');
const llmContextWrapEl = document.getElementById('llm-context-wrap');
const llmContextIndEl = document.getElementById('llm-context-ind');
const stageLlmContextRingEl = document.getElementById('stage-llm-context-ring');
const stageLlmContextIndEl = document.getElementById('stage-llm-context-ind');
const voiceSelectEl = document.getElementById('voice-select');
const runtimeSelectEl = document.getElementById('runtime-select');
const modelSelectEl = document.getElementById('model-select');
const speedSelectEl = document.getElementById('speed-select');
const presenterRailEl = document.getElementById('presenter-rail');
const narratorWebRailEl = document.getElementById('narrator-web-rail');
const toolCommandsRefEl = document.getElementById('tool-commands-ref');
const assistantDebugPanelEl = document.getElementById('assistant-debug-panel');
const assistantDebugLogEl = document.getElementById('assistant-debug-log');
const assistantDebugClearBtn = document.getElementById('assistant-debug-clear');
const narratorPermLineEl = document.getElementById('narrator-perm-line');
const narratorLiveStateEl = document.getElementById('narrator-live-state');
const narratorLiveTextEl = document.getElementById('narrator-live-text');
const nwBadgeGumEl = document.getElementById('nw-badge-gum');
const nwBadgeWakeEl = document.getElementById('nw-badge-wake');
const nwBadgeMediaEl = document.getElementById('nw-badge-media');
const nwBadgeVibrateEl = document.getElementById('nw-badge-vibrate');
const sttLangSelectEl = document.getElementById('stt-lang-select');
function activeInterruptPreset() {
  return resolveNarratorPreset('demo');
}

function webgpuAvailable() {
  return typeof navigator !== 'undefined' && 'gpu' in navigator && Boolean(navigator.gpu);
}

function pickSttLanguageFromNavigator() {
  if (!sttLangSelectEl) return;
  const nav = (navigator.language || 'en-US').replace('_', '-');
  const values = Array.from(sttLangSelectEl.options).map((o) => o.value);
  if (values.includes(nav)) {
    sttLangSelectEl.value = nav;
    return;
  }
  const base = nav.split('-')[0].toLowerCase();
  const byPrefix = values.find((v) => v.toLowerCase().startsWith(`${base}-`));
  sttLangSelectEl.value = byPrefix || 'en-US';
}

/** Read LLM `<select>` when needed — do not cache at module load (can be null if script order changes). */
function getOllamaModelIdFromDom() {
  const el = document.getElementById('ollama-model-select');
  const raw = el && 'value' in el ? String(el.value) : '';
  const t = raw.trim();
  return t || 'qwen3.5:2b';
}

function updateLabAutoSummary() {
  const el = document.getElementById('lab-auto-summary');
  if (!el) return;
  const gpu = webgpuAvailable();
  const ttsLine = gpu ? 'TTS: Nano ONNX, GPU runtime' : 'TTS: Mini ONNX, auto runtime';
  const stt = sttLangSelectEl?.value || 'en-US';
  const v = voiceSelectEl?.value || 'Rosie';
  const llm = getOllamaModelIdFromDom();
  el.textContent = `${ttsLine} · voice ${v} · STT ${stt} · LLM ${llm}`;
}

function applySlideLabAutopilot() {
  if (modelSelectEl) {
    modelSelectEl.value = webgpuAvailable() ? SLIDES_LAB_TTS_NANO_ONNX : SLIDES_LAB_TTS_MINI_ONNX;
  }
  if (runtimeSelectEl) runtimeSelectEl.value = webgpuAvailable() ? 'gpu' : 'auto';
  if (voiceSelectEl) voiceSelectEl.value = 'Rosie';
  if (speedSelectEl) speedSelectEl.value = '1';
  pickSttLanguageFromNavigator();
  updateLabAutoSummary();
}

applySlideLabAutopilot();
voiceSelectEl?.addEventListener('change', () => updateLabAutoSummary());

let currentOrbState = 'idle';
let narratorModeActive = false;
let narratorProcessing = false;
let narratorRestartTimer = 0;
/** Drop STT results until this `performance.now()` (speaker tail after interrupt). */
let sttIgnoreResultsUntilPerfMs = 0;
let narratorWakeLock = null;
/** KittenTTS playback element + blob URL (for barge-in / cleanup). */
let activeNarrationAudio = null;
let activeNarrationUrl = null;

/**
 * Narrator lane FSM — mic stays off during copresenter work (LLM + TTS); Space bumps `assistantEpoch`, stops TTS, then returns to ARMED until Space opens the mic again.
 *
 * - OFF: narrator mode off (manual Read Slide/Notes still runs TTS outside this lane).
 * - ARMED: narrator on, mic idle; primary phase that schedules recognition.start after TTS ends.
 * - LISTENING: Web Speech recognition running.
 * - COGNITION: LLM / streaming; mic does not run (no STT on speaker bleed).
 * - VOCALIZING: TTS playing; mic does not run until playback ends or Space interrupt.
 *
 * Phase constants: `slides-narrator-state.ts` (unit-tested).
 */
let narratorAudioPhase = NarratorPhase.OFF;
/** Bumped when the presenter interrupts the copresenter; `isStale` drops unfinished work. */
let assistantEpoch = 0;

function refreshNarratorLiveUi(state, text) {
  if (narratorLiveStateEl && state != null) narratorLiveStateEl.textContent = state;
  if (narratorLiveTextEl && text != null) narratorLiveTextEl.textContent = text;
}

/** Hide live transcript on the stage and in the narrator rail (state line unchanged). */
function clearUserTranscriptDisplay() {
  showStageCaption('');
  if (narratorLiveTextEl) narratorLiveTextEl.textContent = '';
}

/** Hide the whole aside until narrator tools or assistant debug need it (avoids empty side column). */
function syncPresenterRailVisibility() {
  if (!presenterRailEl) return;
  const narr = Boolean(narratorWebRailEl && !narratorWebRailEl.hidden);
  const tools = Boolean(toolCommandsRefEl && !toolCommandsRefEl.hidden);
  const dbg = Boolean(assistantDebugPanelEl && !assistantDebugPanelEl.hidden);
  presenterRailEl.hidden = !(narr || tools || dbg);
}

function applySttLanguageFromUi() {
  if (recognition && sttLangSelectEl) recognition.lang = sttLangSelectEl.value || 'en-US';
}

function transcriptForDisplay(event) {
  let t = '';
  for (let i = 0; i < event.results.length; i += 1) {
    t += event.results[i][0]?.transcript || '';
  }
  return t.replace(/\s+/g, ' ').trim();
}

async function primeMicrophoneForNarrator() {
  if (!navigator.mediaDevices?.getUserMedia) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: { ideal: true },
        noiseSuppression: { ideal: true },
        autoGainControl: { ideal: true },
      },
      video: false,
    });
    stream.getTracks().forEach((tr) => tr.stop());
    nwBadgeGumEl?.classList.add('nw-badge-on');
  } catch {
    nwBadgeGumEl?.classList.remove('nw-badge-on');
  }
}

async function acquireNarratorWakeLock() {
  if (!navigator.wakeLock?.request) return;
  if (narratorWakeLock) return;
  try {
    narratorWakeLock = await navigator.wakeLock.request('screen');
    nwBadgeWakeEl?.removeAttribute('hidden');
    narratorWakeLock.addEventListener('release', () => {
      nwBadgeWakeEl?.setAttribute('hidden', '');
      narratorWakeLock = null;
    });
  } catch {
    nwBadgeWakeEl?.setAttribute('hidden', '');
  }
}

function releaseNarratorWakeLock() {
  try {
    narratorWakeLock?.release?.();
  } catch {
    // ignore
  }
  narratorWakeLock = null;
  nwBadgeWakeEl?.setAttribute('hidden', '');
}

function syncMediaSessionPlaying(label, playing) {
  if (!('mediaSession' in navigator)) return;
  try {
    if (playing) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: label || 'KittenTTS',
        artist: 'kitten-tts-js slides',
        album: 'Narrator',
      });
      navigator.mediaSession.playbackState = 'playing';
      nwBadgeMediaEl?.removeAttribute('hidden');
    } else {
      navigator.mediaSession.playbackState = 'none';
      nwBadgeMediaEl?.setAttribute('hidden', '');
    }
  } catch {
    // ignore
  }
}

async function updateMicPermissionLine() {
  if (!narratorPermLineEl) return;
  if (!navigator.permissions?.query) {
    narratorPermLineEl.textContent = 'Permissions API unavailable — allow microphone when the browser asks.';
    return;
  }
  try {
    const status = await navigator.permissions.query({ name: 'microphone' });
    const paint = () => {
      if (status.state === 'granted') narratorPermLineEl.textContent = 'Microphone permission: granted';
      else if (status.state === 'denied') {
        narratorPermLineEl.textContent = 'Microphone permission: denied — use the site lock icon to allow access.';
      } else narratorPermLineEl.textContent = 'Microphone permission: prompt appears when listening starts.';
    };
    paint();
    status.onchange = paint;
  } catch {
    narratorPermLineEl.textContent = 'Microphone permission: check site settings in your browser.';
  }
}

function clearNarratorRestartTimer() {
  if (narratorRestartTimer) {
    clearTimeout(narratorRestartTimer);
    narratorRestartTimer = 0;
  }
}

function scheduleRestartNarratorMic(delayMs) {
  if (!recognition || !narratorModeActive) return;
  if (!narratorMayScheduleMic()) return;
  clearNarratorRestartTimer();
  resetNarratorWatchdog();
  narratorRestartTimer = window.setTimeout(() => {
    narratorRestartTimer = 0;
    if (!narratorMayScheduleMic() || listening) return;
    // Fresh utterance after TTS / cognition — do not merge with pttPriorText from an older session.
    pttPriorText = '';
    pttAccumulated = '';
    pttDiscardSttUntilOnstart = true;
    try {
      recognition.start();
    } catch {
      pttDiscardSttUntilOnstart = false;
      scheduleRestartNarratorMic(Math.max(delayMs, 600));
    }
  }, delayMs);
}

let narratorWatchdogTimer = 0;
function resetNarratorWatchdog() {
  if (narratorWatchdogTimer) clearTimeout(narratorWatchdogTimer);
  narratorWatchdogTimer = 0;
  if (!narratorModeActive) return;
  narratorWatchdogTimer = window.setTimeout(() => {
    narratorWatchdogTimer = 0;
    if (
      !narratorWatchdogShouldRecover({
        narratorModeActive,
        listening,
        narrationPlaying: isActiveNarrationPlaying(),
        narratorProcessing,
        narratorAudioPhase,
      })
    ) {
      return;
    }
    console.warn('[narrator watchdog] stuck in', narratorAudioPhase, '— recovering to ARMED');
    narratorAudioPhase = NarratorPhase.ARMED;
    refreshNarratorLiveUi('Recovered — listening soon…', '…');
    scheduleRestartNarratorMic(300);
  }, 15000);
}

/** One audio path at a time: pause STT while TTS will play (no mic + speakers together). */
function suspendNarratorListeningForPlayback() {
  clearNarratorRestartTimer();
  if (recognition && listening) {
    pttAccumulated = '';
    pttPriorText = '';
    pttDiscardSttUntilOnstart = true;
    try {
      recognition.stop();
    } catch {
      // ignore
    }
  }
}

worker.onmessage = (event) => {
  const { type, id, payload } = event.data;
  if (!pendingRequests.has(id)) return;
  const request = pendingRequests.get(id);
  if (type === 'error') {
    request.reject(new Error(payload));
  } else {
    request.resolve(payload);
  }
  pendingRequests.delete(id);
};

function postToWorker(type, payload) {
  return new Promise((resolve, reject) => {
    const id = `${Date.now()}-${Math.random()}`;
    pendingRequests.set(id, { resolve, reject });
    worker.postMessage({ type, id, payload });
  });
}

const EMPTY_SLIDE_META = {
  section: '',
  duration: '',
  takeaway: '',
  artifacts: [],
  audienceQuestion: '',
};

function getSlideMeta(index) {
  const m = deckMeta[index];
  if (!m) return { ...EMPTY_SLIDE_META };
  return {
    section: m.section ?? '',
    duration: m.duration ?? '',
    takeaway: m.takeaway ?? '',
    artifacts: Array.isArray(m.artifacts) ? m.artifacts : [],
    audienceQuestion: m.audienceQuestion ?? '',
  };
}

/** Slide copy + section metadata merged (LLM / UI expect kicker, duration, etc.). */
function getActiveSlide() {
  const content = deck[currentSlideIndex];
  const meta = getSlideMeta(currentSlideIndex);
  return {
    ...content,
    kicker: meta.section,
    duration: meta.duration,
    takeaway: meta.takeaway,
    artifacts: meta.artifacts,
    audienceQuestion: meta.audienceQuestion,
  };
}

function updateStatus(message, kind = '') {
  if (!assistantStatusEl) return;
  assistantStatusEl.textContent = message;
  const cls = kind === 'success' ? 'ok' : kind === 'warning' ? 'warn' : kind ? 'err' : '';
  assistantStatusEl.className = cls ? `status-pill ${cls}` : 'status-pill';
}

function showStageCaption(text, isListening = false) {
  if (!stageCaptionBar) return;
  if (!text) {
    stageCaptionBar.hidden = true;
    return;
  }
  stageCaptionText.textContent = text;
  stageCaptionBar.hidden = false;
  stageCaptionBar.dataset.listening = String(isListening);
}

function showStagePttHint(text) {
  if (!stagePttHint) return;
  if (!text) {
    stagePttHint.hidden = true;
    return;
  }
  stagePttHintText.textContent = text;
  stagePttHint.hidden = false;
}

function setOrbState(state) {
  currentOrbState = state;
  if (stageAssistantAvatarEl) stageAssistantAvatarEl.dataset.state = state;
}

let orbEnergyRaf = 0;
let orbEnergySamples = null;
let orbEnergySampleRate = 0;
let orbEnergyPeak = 1;
let orbEnergyAudio = null;
let orbSmoothedLevel = 0;
let orbPrevLevels = [0, 0, 0];
const WAVEFORM_BARS = 64;
let waveformSmoothed = new Float32Array(WAVEFORM_BARS);

function computePeakAmplitude(pcm) {
  let peak = 0;
  const step = Math.max(1, Math.floor(pcm.length / 4000));
  for (let i = 0; i < pcm.length; i += step) {
    const v = Math.abs(pcm[i]);
    if (v > peak) peak = v;
  }
  return peak || 1;
}

function stopOrbAudioTracking() {
  if (orbEnergyRaf) { cancelAnimationFrame(orbEnergyRaf); orbEnergyRaf = 0; }
  orbEnergySamples = null;
  orbEnergyAudio = null;
  orbSmoothedLevel = 0;
  orbPrevLevels = [0, 0, 0];
  waveformSmoothed = new Float32Array(WAVEFORM_BARS);
  if (stageCardEl) stageCardEl.removeAttribute('data-waveform-active');
  if (currentOrbState === 'speaking') {
    setOrbState('idle');
  }
}

const WAVE_COLORS = {
  speaking:  { top: [255, 183, 136], bot: [208, 99, 47] },
  listening: { top: [136, 232, 200], bot: [52, 146, 110] },
  thinking:  { top: [255, 210, 143], bot: [220, 129, 43] },
  idle:      { top: [255, 183, 136], bot: [208, 99, 47] },
};

function drawWaveform(bars, globalLevel, state) {
  const cv = stageWaveformEl;
  const ctx = waveformCtx;
  if (!cv || !ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth;
  const h = cv.clientHeight;
  if (cv.width !== w * dpr || cv.height !== h * dpr) {
    cv.width = w * dpr;
    cv.height = h * dpr;
  }
  ctx.clearRect(0, 0, cv.width, cv.height);

  const pal = WAVE_COLORS[state] || WAVE_COLORS.speaking;
  const [tr, tg, tb] = pal.top;
  const [br, bg, bb] = pal.bot;

  const n = bars.length;
  const gap = 2 * dpr;
  const barW = Math.max(2, (cv.width - gap * (n - 1)) / n);
  const maxH = cv.height * 0.9;
  const baseH = 3 * dpr;
  const cx = cv.width / 2;

  for (let i = 0; i < n; i++) {
    const x = i * (barW + gap);
    const amp = bars[i];
    const barH = baseH + amp * maxH;
    const dist = Math.abs((x + barW / 2) - cx) / (cv.width / 2);
    const fade = 1 - dist * dist * 0.5;
    const alpha = (0.2 + amp * 0.7) * fade;
    const y = cv.height - barH;

    const grad = ctx.createLinearGradient(x, y, x, cv.height);
    grad.addColorStop(0, `rgba(${tr}, ${tg}, ${tb}, ${alpha})`);
    grad.addColorStop(1, `rgba(${br}, ${bg}, ${bb}, ${alpha * 0.35})`);
    ctx.fillStyle = grad;

    const r = Math.min(barW / 2, 4 * dpr);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + barW - r, y);
    ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
    ctx.lineTo(x + barW, cv.height);
    ctx.lineTo(x, cv.height);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
  }
}

function orbEnergyTick() {
  const audio = orbEnergyAudio;
  const pcm = orbEnergySamples;
  if (!audio || !pcm || audio.paused || audio.ended) {
    orbEnergyRaf = 0;
    return;
  }
  const t = audio.currentTime;
  const sr = orbEnergySampleRate || 22050;
  const center = Math.floor(t * sr);

  const halfWin = Math.floor(sr * 0.035);
  const lo = Math.max(0, center - halfWin);
  const hi = Math.min(pcm.length, center + halfWin);
  let sum = 0;
  for (let i = lo; i < hi; i++) sum += Math.abs(pcm[i]);
  const avg = hi > lo ? sum / (hi - lo) : 0;
  const normalized = Math.min(avg / orbEnergyPeak, 1);
  orbPrevLevels.push(normalized);
  if (orbPrevLevels.length > 3) orbPrevLevels.shift();
  const frameAvg = (orbPrevLevels[0] + orbPrevLevels[1] + orbPrevLevels[2]) / 3;
  orbSmoothedLevel += (frameAvg - orbSmoothedLevel) * 0.4;
  const s = orbSmoothedLevel;

  const waveSpan = Math.floor(sr * 0.12);
  const wLo = Math.max(0, center - waveSpan);
  const wHi = Math.min(pcm.length, center + waveSpan);
  const blockSize = Math.max(1, Math.floor((wHi - wLo) / WAVEFORM_BARS));
  for (let b = 0; b < WAVEFORM_BARS; b++) {
    const bStart = wLo + b * blockSize;
    const bEnd = Math.min(bStart + blockSize, wHi);
    let bSum = 0;
    for (let j = bStart; j < bEnd; j++) bSum += Math.abs(pcm[j]);
    const raw = bEnd > bStart ? Math.min((bSum / (bEnd - bStart)) / orbEnergyPeak, 1) : 0;
    waveformSmoothed[b] += (raw - waveformSmoothed[b]) * 0.45;
  }
  drawWaveform(waveformSmoothed, s, 'speaking');

  orbEnergyRaf = requestAnimationFrame(orbEnergyTick);
}

function isActiveNarrationPlaying() {
  const a = activeNarrationAudio;
  return a != null && !a.paused && !a.ended;
}

function narratorMayScheduleMic() {
  return narratorMayScheduleMicPure({
    narratorModeActive,
    listening,
    narrationPlaying: isActiveNarrationPlaying(),
    narratorProcessing,
    narratorAudioPhase,
  });
}

/** Stop TTS immediately (user spoke over it or new turn). */
function stopActiveNarration(opts = {}) {
  const { userInterrupt = false } = opts;
  const a = activeNarrationAudio;
  const u = activeNarrationUrl;
  activeNarrationAudio = null;
  activeNarrationUrl = null;
  if (a) {
    try {
      a.pause();
      a.currentTime = 0;
    } catch {
      // ignore
    }
  }
  if (u) {
    try {
      URL.revokeObjectURL(u);
    } catch {
      // ignore
    }
  }
  syncMediaSessionPlaying('', false);
  ttsChipEl.textContent = 'ready';
  stopOrbAudioTracking();
  if (a && narratorModeActive) {
    narratorAudioPhase = NarratorPhase.ARMED;
  }
  if (userInterrupt && narratorModeActive) {
    updateStatus('Interrupted — listening for you.', 'success');
  }
}

function trackOrbWithAudio(audio, floatArr, sampleRate) {
  stopOrbAudioTracking();
  orbEnergyAudio = audio;
  orbEnergySamples = floatArr || null;
  orbEnergySampleRate = sampleRate || 22050;
  orbEnergyPeak = floatArr ? computePeakAmplitude(floatArr) : 1;
  orbSmoothedLevel = 0;
  orbPrevLevels = [0, 0, 0];
  waveformSmoothed = new Float32Array(WAVEFORM_BARS);
  setOrbState('speaking');
  if (stageCardEl && floatArr) stageCardEl.setAttribute('data-waveform-active', '');
  if (floatArr) {
    orbEnergyRaf = requestAnimationFrame(orbEnergyTick);
  }
  audio.addEventListener(
    'ended',
    () => {
      stopOrbAudioTracking();
    },
    { once: true },
  );
}

function renderSlide() {
  clearToolEffects();
  const slide = getActiveSlide();
  const kickerText = typeof slide.kicker === 'string' ? slide.kicker.trim() : '';
  if (slideKickerEl) {
    slideKickerEl.textContent = kickerText;
    const kickerWrap = slideKickerEl.parentElement;
    const hideKicker = !kickerText;
    slideKickerEl.hidden = hideKicker;
    if (kickerWrap) kickerWrap.hidden = hideKicker;
    const stageMetaEl = slideKickerEl.closest('.stage-meta');
    if (stageMetaEl) stageMetaEl.hidden = hideKicker;
  }
  slideTitleEl.textContent = slide.title;
  slideLedeEl.textContent = slide.lede;
  slideBulletsEl.innerHTML = '';
  const bulletList = Array.isArray(slide.bullets) ? slide.bullets : [];
  bulletList.forEach((bullet) => {
    const item = document.createElement('li');
    if (typeof bullet === 'string') {
      const body = document.createElement('span');
      body.className = 'bullet-body';
      body.textContent = bullet;
      item.appendChild(body);
      slideBulletsEl.appendChild(item);
      return;
    }
    if (bullet && typeof bullet === 'object' && typeof bullet.text === 'string') {
      const head = document.createElement('span');
      head.className = 'bullet-head';
      head.textContent = bullet.text;
      item.appendChild(head);
      const subs = Array.isArray(bullet.sub) ? bullet.sub : [];
      if (subs.length) {
        const subUl = document.createElement('ul');
        subUl.className = 'bullets bullets-sub';
        subs.forEach((line) => {
          const subLi = document.createElement('li');
          const subBody = document.createElement('span');
          subBody.className = 'bullet-body';
          subBody.textContent = line;
          subLi.appendChild(subBody);
          subUl.appendChild(subLi);
        });
        item.appendChild(subUl);
      }
      slideBulletsEl.appendChild(item);
      return;
    }
  });
  if (slideBulletsEl) slideBulletsEl.hidden = bulletList.length === 0;

  const glossLines = Array.isArray(slide.glossary) ? slide.glossary : [];
  if (slideGlossEl) {
    if (!glossLines.length) {
      slideGlossEl.hidden = true;
      slideGlossEl.innerHTML = '';
    } else {
      slideGlossEl.hidden = false;
      slideGlossEl.innerHTML = '';
      const glossTitle = document.createElement('div');
      glossTitle.className = 'slide-gloss-title';
      glossTitle.textContent = 'On this slide';
      slideGlossEl.appendChild(glossTitle);
      const glossUl = document.createElement('ul');
      glossUl.className = 'slide-gloss-list';
      glossLines.forEach((line) => {
        const gli = document.createElement('li');
        gli.textContent = line;
        glossUl.appendChild(gli);
      });
      slideGlossEl.appendChild(glossUl);
    }
  }

  clearSlideDiagram();
  const rawDiagram = (slide as { diagram?: unknown }).diagram;
  const diagramKey = typeof rawDiagram === 'string' ? rawDiagram : '';
  if (diagramKey && diagramKey in DIAGRAM_PRESETS) {
    slideDiagramGen += 1;
    const gen = slideDiagramGen;
    void renderSlideDiagramPreset(diagramKey as keyof typeof DIAGRAM_PRESETS, gen);
  }
  if (stageSlideRefEl) {
    stageSlideRefEl.textContent = `${currentSlideIndex + 1} / ${deck.length}`;
  }
  if (prevSlideBtn) prevSlideBtn.disabled = currentSlideIndex <= 0;
  if (nextSlideBtn) nextSlideBtn.disabled = currentSlideIndex >= deck.length - 1;
}

function setNarratorMode(active) {
  narratorModeActive = active;
  syncPresentOrbTrigger();

  if (active) {
    clearNarratorRestartTimer();
    sttIgnoreResultsUntilPerfMs = 0;
    narratorProcessing = false;
    stopActiveNarration();
    pttAccumulated = '';
    pttPriorText = '';
    pttDiscardSttUntilOnstart = false;
    applySttLanguageFromUi();
    if (narratorWebRailEl) narratorWebRailEl.hidden = false;
    if (toolCommandsRefEl) toolCommandsRefEl.hidden = false;
    syncPresenterRailVisibility();

    void (async () => {
      await primeMicrophoneForNarrator();
      await acquireNarratorWakeLock();
      await updateMicPermissionLine();
      return ensureTtsReady();
    })()
      .then(() => {
        narratorAudioPhase = NarratorPhase.ARMED;
        refreshNarratorLiveUi('Ready — press Space to talk.', '');
        setOrbState('idle');
        updateStatus('Walkie-talkie ready. Press Space to talk, Space again to interrupt.', 'success');
        showStagePttHint('Press Space to talk');
      })
      .catch((err) => {
        updateStatus(`Failed to init: ${err.message}`, 'warning');
        setOrbState('idle');
        releaseNarratorWakeLock();
        if (narratorWebRailEl) narratorWebRailEl.hidden = true;
        if (toolCommandsRefEl) toolCommandsRefEl.hidden = true;
        narratorModeActive = false;
        syncPresenterRailVisibility();
      });
  } else {
    assistantEpoch += 1;
    clearNarratorRestartTimer();
    sttIgnoreResultsUntilPerfMs = 0;
    if (narratorWatchdogTimer) { clearTimeout(narratorWatchdogTimer); narratorWatchdogTimer = 0; }
    narratorProcessing = false;
    stopActiveNarration();
    narratorAudioPhase = NarratorPhase.OFF;
    pttAccumulated = '';
    pttPriorText = '';
    pttUserStopped = false;
    pttDiscardSttUntilOnstart = false;
    if (recognition && listening) {
      try { recognition.stop(); } catch { /* ignore */ }
    }
    listening = false;
    if (sttChipEl) sttChipEl.textContent = recognition ? 'ready' : 'not available';
    releaseNarratorWakeLock();
    syncMediaSessionPlaying('', false);
    if (narratorWebRailEl) narratorWebRailEl.hidden = true;
    if (toolCommandsRefEl) toolCommandsRefEl.hidden = true;
    refreshNarratorLiveUi('Narrator off', '');
    updateStatus('Narrator off. Press Space to re-activate.', 'success');
    setOrbState('idle');
    showStageCaption('');
    showStagePttHint('');
    syncPresenterRailVisibility();
  }
}

function isStagePresenting() {
  return Boolean(stageCardEl && document.fullscreenElement === stageCardEl);
}

function syncPresentOrbTrigger() {
  // no-op: orb removed, Space key handler drives interaction
}

function handlePresentOrbActivate() {
  if (!recognition) {
    updateStatus('Speech recognition is not available in this browser.', 'warning');
    return;
  }
  if (!narratorModeActive) {
    setNarratorMode(true);
    return;
  }
  if (shouldIgnoreNarratorActionBurst()) return;
  if (narratorAudioPhase === NarratorPhase.LISTENING) {
    pttUserStopped = true;
    if (listening) {
      try { recognition.stop(); } catch { /* ignore */ }
    } else {
      const text = pttAccumulated.trim();
      pttAccumulated = '';
      pttPriorText = '';
      pttDiscardSttUntilOnstart = true;
      pttUserStopped = false;
      if (text.length >= 2) {
        clearUserTranscriptDisplay();
        refreshNarratorLiveUi('Thinking…', '');
        setOrbState('thinking');
        void pttSendToLlm(text);
      } else {
        narratorAudioPhase = NarratorPhase.ARMED;
        refreshNarratorLiveUi('Ready — press Space to talk.', '');
        setOrbState('idle');
        showStageCaption('');
        showStagePttHint('Press Space to talk');
        updateStatus('No speech captured. Press Space to try again.');
      }
    }
    return;
  }
  if (narratorAudioPhase === NarratorPhase.COGNITION || narratorAudioPhase === NarratorPhase.VOCALIZING) {
    pttInterruptAndListen();
    return;
  }
  pttStartListening();
}

function syncLlmChip() {
  if (window.kittenSlidesOllama?.isConnected?.()) {
    llmChipEl.textContent = 'ollama';
  } else {
    llmChipEl.textContent = 'off';
  }
}

async function detectCapabilities() {
  gpuChipEl.textContent = webgpuAvailable() ? 'available' : 'not available';
  sttChipEl.textContent = recognition ? 'available' : 'not available';
  applySttLanguageFromUi();
  if (typeof navigator.vibrate === 'function') {
    nwBadgeVibrateEl?.removeAttribute('hidden');
    nwBadgeVibrateEl?.classList.add('nw-badge-on');
  }
  syncLlmChip();
}

function isCoarseMobileUa(): boolean {
  return /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent || '',
  );
}

async function ensureTtsReady() {
  if (ttsReady) return;
  updateStatus('Loading KittenTTS worker for the slides lab…');
  /* ORT WASM threads need SharedArrayBuffer → crossOriginIsolated (COOP/COEP). Plain static hosts = 1.
   * Phones exhaust WASM heap quickly with pooled threads; keep a single thread on mobile UAs. */
  const wasmThreads =
    typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated && !isCoarseMobileUa() ? 4 : 1;
  const payload = await postToWorker('init', {
    modelId: modelSelectEl.value,
    runtime: runtimeSelectEl.value,
    wasmThreads,
    wasmSimd: true,
  });
  ttsReady = true;
  ttsChipEl.textContent = payload.runtimeActual || payload.runtimeRequested || 'ready';
  updateLabAutoSummary();
  updateStatus('Narrator ready. You can read the slide or notes aloud.', 'success');
}

function createWavBlob(floatArr, sampleRate) {
  const pcm16 = new Int16Array(floatArr.length);
  for (let i = 0; i < floatArr.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, floatArr[i]));
    pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  const buffer = new ArrayBuffer(44 + pcm16.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset, text) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + pcm16.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, pcm16.length * 2, true);

  let offset = 44;
  for (let i = 0; i < pcm16.length; i += 1, offset += 2) {
    view.setInt16(offset, pcm16[i], true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

async function narrate(text, label) {
  await ensureTtsReady();
  stopActiveNarration();
  if (narratorModeActive) {
    narratorAudioPhase = NarratorPhase.COGNITION;
  }
  suspendNarratorListeningForPlayback();
  updateStatus(`Generating narration for ${label}…`);
  setOrbState('thinking');
  let url;
  try {
    const result = await postToWorker('generate', {
      text: ttsPreprocess(text),
      voice: voiceSelectEl.value,
      speed: Number(speedSelectEl.value),
    });
    const blob = createWavBlob(result.floatArr, result.sampleRate);
    url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    if ('playsInline' in audio) audio.playsInline = true;
    audio.volume = 1;
    audio.muted = false;
    trackOrbWithAudio(audio, result.floatArr, result.sampleRate);
    syncMediaSessionPlaying(label, true);
    if (narratorModeActive) refreshNarratorLiveUi('Assistant speaking (TTS)…', '');
    try {
      await audio.play();
    } catch (playErr) {
      const blocked = playErr?.name === 'NotAllowedError';
      updateStatus(
        blocked
          ? 'Audio blocked by the browser. Click “Load Narrator”, “Read Slide”, or another button, then try again.'
          : `Could not play speech: ${playErr?.message || playErr}`,
        'warning',
      );
      stopOrbAudioTracking();
      if (narratorModeActive) {
        narratorAudioPhase = NarratorPhase.ARMED;
        scheduleRestartNarratorMic(activeInterruptPreset().restartMicNarrateBlockedMs);
      }
      throw playErr;
    }
    activeNarrationAudio = audio;
    activeNarrationUrl = url;
    if (narratorModeActive) {
      narratorAudioPhase = NarratorPhase.VOCALIZING;
    }
    ttsChipEl.textContent = `speaking ${voiceSelectEl.value}`;
    audio.addEventListener(
      'ended',
      () => {
        if (activeNarrationAudio === audio) {
          activeNarrationAudio = null;
          activeNarrationUrl = null;
        }
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
        ttsChipEl.textContent = 'ready';
        syncMediaSessionPlaying('', false);
        if (narratorModeActive) {
          narratorAudioPhase = NarratorPhase.ARMED;
          refreshNarratorLiveUi('Listening soon…', '');
          scheduleRestartNarratorMic(activeInterruptPreset().restartMicNarrateEndedMs);
        }
        if (!listening) setOrbState('idle');
      },
      { once: true },
    );
    updateStatus(`Narrating ${label}.`, 'success');
  } catch (e) {
    syncMediaSessionPlaying('', false);
    activeNarrationAudio = null;
    activeNarrationUrl = null;
    if (url) URL.revokeObjectURL(url);
    if (narratorModeActive) {
      narratorAudioPhase = NarratorPhase.ARMED;
      scheduleRestartNarratorMic(activeInterruptPreset().restartMicNarrateCatchMs);
    }
    throw e;
  }
}

/**
 * Speak a single sentence via KittenTTS and wait until playback finishes.
 * Used by the streaming pipeline; each sentence is spoken sequentially.
 */
function ttsPreprocess(text) {
  let s = String(text || '').trim();
  s = s.replace(/^\s*(?:action|narration|stage|tool)\s*:\s*/i, '');
  s = s.replace(/\[(?:\s*)(?:pause|beat|laughs?|laughing|applause|gasps?|sighs?|music)(?:\s*)\]/gi, ' ');
  s = s.replace(/\((?:\s*)(?:pause|beat|laughs?|applause)(?:\s*)\)/gi, ' ');
  s = s.replace(/<tools\b[^>]*>[\s\S]*?<\/tools>/gi, '');
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s
    .replace(/\.{3,}/g, ', , ,')
    .replace(/\.\s*/g, ' ,  , ')
    .replace(/[!?]/g, ' , ');
}

async function narrateSentence(text, speakEpoch) {
  if (speakEpoch != null && speakEpoch !== assistantEpoch) return;
  await ensureTtsReady();
  const result = await postToWorker('generate', {
    text: ttsPreprocess(text),
    voice: voiceSelectEl.value,
    speed: Number(speedSelectEl.value),
  });
  if (speakEpoch != null && speakEpoch !== assistantEpoch) return;
  const blob = createWavBlob(result.floatArr, result.sampleRate);
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  if ('playsInline' in audio) audio.playsInline = true;
  audio.volume = 1;
  audio.muted = false;
  trackOrbWithAudio(audio, result.floatArr, result.sampleRate);
  if (narratorModeActive) {
    narratorAudioPhase = NarratorPhase.VOCALIZING;
    refreshNarratorLiveUi('Assistant speaking (TTS)…', '');
  }
  ttsChipEl.textContent = `speaking ${voiceSelectEl.value}`;
  setOrbState('speaking');
  activeNarrationAudio = audio;
  activeNarrationUrl = url;

  return new Promise((resolve) => {
    audio.addEventListener('ended', () => {
      if (activeNarrationAudio === audio) {
        activeNarrationAudio = null;
        activeNarrationUrl = null;
      }
      try { URL.revokeObjectURL(url); } catch { /* ignore */ }
      ttsChipEl.textContent = 'ready';
      resolve();
    }, { once: true });
    audio.addEventListener('error', () => {
      if (activeNarrationAudio === audio) {
        activeNarrationAudio = null;
        activeNarrationUrl = null;
      }
      try { URL.revokeObjectURL(url); } catch { /* ignore */ }
      ttsChipEl.textContent = 'ready';
      resolve();
    }, { once: true });
    audio.play().catch(() => {
      stopOrbAudioTracking();
      resolve();
    });
  });
}

// --- Slide tools: LLM can act on the presentation ---
const stageOverlayEl = document.getElementById('stage-overlay');
const toolActivityEl = document.getElementById('tool-activity');
const toolActivityLabelEl = document.getElementById('tool-activity-label');
let toolCleanupTimers = [];
let toolActivityTimer = 0;

function showToolActivity(label) {
  if (toolActivityTimer) { clearTimeout(toolActivityTimer); toolActivityTimer = 0; }
  if (toolActivityLabelEl) toolActivityLabelEl.textContent = label || 'working…';
  if (toolActivityEl) toolActivityEl.classList.add('visible');
}

function hideToolActivity(delay = 600) {
  if (toolActivityTimer) clearTimeout(toolActivityTimer);
  toolActivityTimer = setTimeout(() => {
    if (toolActivityEl) toolActivityEl.classList.remove('visible');
    toolActivityTimer = 0;
  }, delay);
}

const stageFireworksEl = document.getElementById('stage-fireworks');
let mermaidConfigured = false;
let fireworksRaf = 0;
let fireworksGen = 0;
/** Bumps on each slide navigation so stale async Mermaid renders are ignored. */
let slideDiagramGen = 0;

function ensureMermaidConfigured() {
  const m = globalThis.mermaid;
  if (!m) return false;
  if (!mermaidConfigured) {
    m.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose',
      themeVariables: {
        fontSize: '20px',
        primaryColor: '#3d2520',
        primaryTextColor: '#fff7ef',
        primaryBorderColor: '#d0632f',
        lineColor: '#e8a070',
        secondaryColor: '#2a2420',
        tertiaryColor: '#181410',
        background: '#181410',
        mainBkg: '#2a2420',
        nodeBorder: '#d0632f',
        clusterBkg: 'rgba(208,99,47,0.12)',
        titleColor: '#ffd6b8',
        edgeLabelBackground: '#2a2420',
      },
    });
    mermaidConfigured = true;
  }
  return true;
}

function clearSlideDiagram() {
  if (!slideDiagramEl) return;
  slideDiagramEl.innerHTML = '';
  slideDiagramEl.hidden = true;
}

/**
 * Renders Mermaid into the in-slide diagram host (below bullets), not a fullscreen overlay.
 * `gen` must match `slideDiagramGen` after any await so stale navigations do not paint.
 */
async function renderMermaidIntoSlideHost(definition: string, title: string, gen: number) {
  if (!slideDiagramEl) return;
  const def = String(definition || '').trim();
  if (!def) {
    slideDiagramEl.hidden = true;
    return;
  }
  if (gen !== slideDiagramGen) return;

  slideDiagramEl.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'diagram-mermaid-inner';
  if (title) {
    const h = document.createElement('div');
    h.className = 'diagram-title';
    h.textContent = title;
    wrap.appendChild(h);
  }
  const out = document.createElement('div');
  out.className = 'diagram-mermaid-out';

  if (!ensureMermaidConfigured()) {
    if (gen !== slideDiagramGen) return;
    const err = document.createElement('p');
    err.className = 'diagram-error';
    err.textContent = 'Mermaid did not load. Check network or refresh.';
    out.appendChild(err);
    wrap.appendChild(out);
    slideDiagramEl.appendChild(wrap);
    slideDiagramEl.hidden = false;
    return;
  }

  const id = `mmd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    const { svg, bindFunctions } = await globalThis.mermaid.render(id, def);
    if (gen !== slideDiagramGen) return;
    out.innerHTML = svg;
    if (typeof bindFunctions === 'function') bindFunctions(out);
  } catch (e: unknown) {
    if (gen !== slideDiagramGen) return;
    const err = document.createElement('p');
    err.className = 'diagram-error';
    const msg = e instanceof Error ? e.message : '';
    err.textContent = msg ? `Diagram error: ${msg}` : 'Invalid Mermaid diagram.';
    out.appendChild(err);
  }
  if (gen !== slideDiagramGen) return;
  wrap.appendChild(out);
  slideDiagramEl.appendChild(wrap);
  slideDiagramEl.hidden = false;
}

async function renderSlideDiagramPreset(key: keyof typeof DIAGRAM_PRESETS, gen: number) {
  const preset = DIAGRAM_PRESETS[key];
  if (!preset) return;
  await renderMermaidIntoSlideHost(preset.definition, preset.title, gen);
}

/** KittenTTS friendly names (see src/kitten-tts.ts voiceAliases). */
const KITTEN_TTS_VOICE_OPTIONS = Object.freeze([
  'Bella',
  'Jasper',
  'Luna',
  'Bruno',
  'Rosie',
  'Hugo',
  'Kiki',
  'Leo',
]);

function resolveKittenVoiceOption(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  return KITTEN_TTS_VOICE_OPTIONS.find((v) => v.toLowerCase() === lower) ?? null;
}

/**
 * Slide lab split (why this file + TS):
 * - This HTML: deck UI, system prompt, `executeToolCall` (DOM / TTS / stage effects).
 * - `src/slides-ollama-assistant.ts` → `docs/slides-ollama.js`: streaming /api/chat with Ollama
 *   `tools` + streamed `tool_calls` only (no embedded XML tool execution).
 * - `src/stream-tool-tags.ts`: `SLIDE_TOOL_NAMES` (full runtime set for XML/tests).
 * - Ollama exposes a subset only — see `OLLAMA_SLIDE_TOOLS` in `slides-ollama-assistant.ts`. Rebuild: `npm run build:slides-ollama`.
 */

function prewarmSlideDiagramEngine() {
  try {
    ensureMermaidConfigured();
  } catch {
    /* ignore */
  }
}

function stopFireworks() {
  fireworksGen += 1;
  if (fireworksRaf) {
    cancelAnimationFrame(fireworksRaf);
    fireworksRaf = 0;
  }
  if (stageFireworksEl) {
    stageFireworksEl.classList.remove('active');
    const ctx = stageFireworksEl.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, stageFireworksEl.width, stageFireworksEl.height);
  }
}

function launchFireworks(durationMs) {
  stopFireworks();
  const myGen = fireworksGen;
  if (!stageFireworksEl) return;
  const canvas = stageFireworksEl;
  const parent = canvas.parentElement;
  const card = stageCardEl || parent;
  const rect = card?.getBoundingClientRect?.();
  const w = Math.max(
    1,
    Math.round(rect?.width || 0) || parent?.clientWidth || 800,
  );
  const h = Math.max(
    1,
    Math.round(rect?.height || 0) || parent?.clientHeight || 600,
  );
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const colors = ['#ffb788', '#ffd6b8', '#fff4e8', '#ff8c42', '#f5d76e', '#ff6b4a'];
  const parts = [];
  const spawnBurst = (cx, cy) => {
    const n = 16 + Math.floor(Math.random() * 8);
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.35;
      const sp = 2.2 + Math.random() * 3.8;
      parts.push({
        x: cx,
        y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 1,
        max: 0.82 + Math.random() * 0.35,
        r: 1.1 + Math.random() * 2.2,
        color: colors[Math.floor(Math.random() * colors.length)],
        g: 0.07 + Math.random() * 0.05,
      });
    }
  };

  for (let b = 0; b < 6; b++) {
    const cx = w * (0.12 + Math.random() * 0.76);
    const cy = h * (0.28 + Math.random() * 0.32);
    spawnBurst(cx, cy);
  }

  const durSafe = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 3200;
  const endAt = performance.now() + Math.min(Math.max(durSafe, 1500), 8000);
  canvas.classList.add('active');

  function tick(now) {
    if (myGen !== fireworksGen) return;
    ctx.clearRect(0, 0, w, h);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.011;
      if (p.life <= 0 || p.y > h + 24) {
        parts.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = Math.min(1, Math.max(0.15, p.life / p.max));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (now < endAt || parts.length > 0) {
      fireworksRaf = requestAnimationFrame(tick);
    } else {
      stopFireworks();
    }
  }
  fireworksRaf = requestAnimationFrame(tick);
}

function clearToolEffects() {
  for (const t of toolCleanupTimers) clearTimeout(t);
  toolCleanupTimers = [];
  document.querySelectorAll('.tool-highlight').forEach(el => {
    el.outerHTML = el.textContent;
  });
  document.querySelectorAll('.tool-emphasize').forEach(el => {
    el.classList.remove('tool-emphasize', 'fade-out');
  });
  if (stageOverlayEl) {
    stageOverlayEl.classList.remove('visible');
    stageOverlayEl.textContent = '';
  }
  stopFireworks();
}

/** Ollama often returns tool arguments as a JSON string; normalize before reading fields. */
function normalizeSlideToolArgs(raw) {
  if (raw == null || raw === '') return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return {};
    try {
      const o = JSON.parse(s);
      return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
    } catch {
      return {};
    }
  }
  return {};
}

/** Keep in sync with src/stream-tool-tags.ts (`SLIDE_TOOL_NAMES` + diagram keys). */
const KNOWN_SLIDE_TOOL_NAMES = new Set([
  'highlight_text',
  'emphasize_bullet',
  'go_to_slide',
  'set_voice',
  'show_overlay',
  ...Object.keys(DIAGRAM_PRESETS).map((k) => `diagram_${k}`),
  'fireworks',
]);

async function executeToolCall(call) {
  const fn = call?.function;
  const rawName = fn?.name;
  const n = rawName != null ? String(rawName).trim().toLowerCase() : '';
  const args = normalizeSlideToolArgs(fn?.arguments);
  if (!n) return '';

  if (!KNOWN_SLIDE_TOOL_NAMES.has(n)) {
    pushAssistantDebug('tool_ignored', { name: String(rawName).trim() });
    return '';
  }

  const friendlyNames = {
    highlight_text: 'highlighting…',
    emphasize_bullet: 'emphasizing…',
    go_to_slide: 'navigating…',
    set_voice: 'voice…',
    show_overlay: 'overlay…',
    fireworks: 'celebrating…',
  };
  const activityLabel =
    friendlyNames[n] || (n.startsWith('diagram_') ? 'diagramming…' : n);
  showToolActivity(activityLabel);
  hideToolActivity(1200);

  if (n === 'highlight_text') {
    const text = String(args.text || '').trim();
    if (!text) return 'no text provided';
    const targets = [slideTitleEl, slideLedeEl, slideBulletsEl, slideGlossEl];
    let found = false;
    for (const el of targets) {
      if (!el) continue;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const idx = node.textContent.toLowerCase().indexOf(text.toLowerCase());
        if (idx === -1) continue;
        const before = node.textContent.slice(0, idx);
        const match = node.textContent.slice(idx, idx + text.length);
        const after = node.textContent.slice(idx + text.length);
        const span = document.createElement('span');
        span.className = 'tool-highlight';
        span.textContent = match;
        const parent = node.parentNode;
        if (before) parent.insertBefore(document.createTextNode(before), node);
        parent.insertBefore(span, node);
        if (after) parent.insertBefore(document.createTextNode(after), node);
        parent.removeChild(node);
        found = true;
        const tid = setTimeout(() => {
          span.classList.add('fade-out');
          setTimeout(() => { if (span.parentNode) span.outerHTML = span.textContent; }, 600);
        }, 4000);
        toolCleanupTimers.push(tid);
        break;
      }
      if (found) break;
    }
    return found ? `Highlighted "${text}"` : `"${text}" not found on slide`;
  }

  if (n === 'emphasize_bullet') {
    const raw = Number(args.index);
    if (!Number.isFinite(raw) || raw < 1) return 'index required: 1-based bullet number';
    const bulletNum = Math.floor(raw);
    const idx = bulletNum - 1;
    const bullets = slideBulletsEl?.querySelectorAll(':scope > li');
    if (!bullets || idx < 0 || idx >= bullets.length) return `Bullet ${bulletNum} not found`;
    const li = bullets[idx];
    li.classList.add('tool-emphasize');
    const tid = setTimeout(() => {
      li.classList.add('fade-out');
      setTimeout(() => li.classList.remove('tool-emphasize', 'fade-out'), 600);
    }, 4000);
    toolCleanupTimers.push(tid);
    return `Emphasized bullet ${bulletNum}`;
  }

  if (n === 'go_to_slide') {
    const num = Number(args.slide_number);
    if (!Number.isFinite(num) || num < 1 || num > deck.length) {
      return `slide_number must be between 1 and ${deck.length}`;
    }
    currentSlideIndex = num - 1;
    renderSlide();
    return `Navigated to slide ${num}`;
  }

  if (n === 'set_voice') {
    const canon = resolveKittenVoiceOption(args.voice);
    if (!canon) {
      return `Invalid voice. Use one of: ${KITTEN_TTS_VOICE_OPTIONS.join(', ')}`;
    }
    if (!voiceSelectEl) return 'voice select unavailable';
    voiceSelectEl.value = canon;
    updateLabAutoSummary();
    return `Voice set to ${canon}`;
  }

  if (n === 'show_overlay') {
    const text = String(args.text || '').trim();
    if (!text) return 'no text provided';
    if (!stageOverlayEl) return 'overlay unavailable';
    const dur = Math.min(Number(args.duration_seconds) || 5, 15) * 1000;
    stageOverlayEl.textContent = text;
    stageOverlayEl.classList.add('visible');
    const tid = setTimeout(() => {
      stageOverlayEl.classList.remove('visible');
    }, dur);
    toolCleanupTimers.push(tid);
    return `Overlay shown for ${dur / 1000}s`;
  }

  if (n.startsWith('diagram_')) {
    const key = n.slice('diagram_'.length);
    if (!(key in DIAGRAM_PRESETS)) return '';
    const presetKey = key as keyof typeof DIAGRAM_PRESETS;
    const idx = DIAGRAM_PRESET_SLIDE_INDEX[presetKey];
    if (idx === undefined) return '';
    currentSlideIndex = idx;
    renderSlide();
    return `Navigated to slide ${idx + 1} (${DIAGRAM_PRESETS[presetKey].title})`;
  }

  if (n === 'fireworks') {
    const sec = Number(args.duration_seconds);
    const s0 = Number.isFinite(sec) && sec > 0 ? sec : 3;
    const dur = Math.min(Math.max(s0, 1), 8) * 1000;
    launchFireworks(dur);
    return `Fireworks for ${dur / 1000}s`;
  }

  return '';
}

// --- Ollama adapter bridge (prompt construction + conversation management) ---
/** Prune + summarize threshold; UI meter uses the same budget (est. tokens chars÷3.5). */
const OLLAMA_HISTORY_TOKEN_BUDGET = 8000;
/** Minimum non-system messages to keep verbatim when summarizing older turns. */
const OLLAMA_SUMMARY_TAIL_MIN = 6;
/** Only call the summarizer if the dropped prefix is at least this heavy (est. tokens). */
const OLLAMA_SUMMARY_MIN_HEAD_TOKENS = 400;
/** Cap for the summarizer completion (`num_predict`). */
const OLLAMA_SUMMARY_MAX_TOKENS = 360;
const ollamaConversation = { messages: [], lastSessionKey: null };

/** Ollama-reported prompt/output tokens from the last copresenter `chat()` (not prewarm). */
let lastCopresenterOllamaUsage = null;

/**
 * Persist only user + assistant text for the next turn. Drops `tool` rows and `tool_calls` so replays
 * do not bloat context; tools still run on each fresh request via Ollama.
 */
function compactHistoryToTextOnly(msgs) {
  if (!Array.isArray(msgs) || msgs.length === 0) return [];
  const out = [];
  let i = 0;
  if (msgs[0]?.role === 'system') {
    out.push({ role: 'system', content: msgs[0].content });
    i = 1;
  }
  for (; i < msgs.length; i += 1) {
    const m = msgs[i];
    if (!m || typeof m !== 'object') continue;
    if (m.role === 'tool') continue;
    if (m.role === 'user') {
      out.push({
        role: 'user',
        content: typeof m.content === 'string' ? m.content : String(m.content ?? ''),
      });
      continue;
    }
    if (m.role === 'assistant') {
      const c = typeof m.content === 'string' ? m.content.trim() : '';
      const hasTools = Array.isArray(m.tool_calls) && m.tool_calls.length > 0;
      let text = c;
      if (!text && hasTools) text = '(Stage tools only.)';
      if (!text) text = ' ';
      out.push({ role: 'assistant', content: text });
      continue;
    }
  }
  return out;
}

/** For skipping consecutive duplicate TTS lines (small local models often repeat the same phrase across tool rounds). */
function normalizeSpokenSentenceKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function shouldDedupeSpokenSentence(norm) {
  return norm.length >= 12 || norm.split(/\s+/).filter(Boolean).length >= 3;
}

const OLLAMA_SLIDE_SYSTEM_PROMPT = [
  'You are Kiki, Algimantas\u2019s assistant speaker and copresenter on stage at a tech talk.',
  'You and Algimantas are presenting together as a duo. You\u2019re his witty, knowledgeable sidekick.',
  'Your voice goes straight to a text-to-speech engine and is heard live by the audience.',
  '',
  'WHO YOU ARE:',
  '- Your name is Kiki. Algimantas might call you by name.',
  '- The human copresenter\u2019s name is Algimantas. When you address him by name in speech, say Algimantas — not initials or nicknames.',
  '- You\u2019re a confident, warm speaker who genuinely enjoys being on stage.',
  '- You have your own personality — playful, concise, a bit cheeky when it fits.',
  '- You and Algimantas have great chemistry. Riff off what he says, add color, keep energy up.',
  '',
  'VOICE RULES — your text is SPOKEN ALOUD, never read on screen:',
  '- Talk like a real person on stage. Contractions, rhythm, personality.',
  '- NO markdown, NO bullets, NO asterisks, NO formatting of any kind.',
  '- NO emoji. Avoid filler like "Sure!" or "Great question!"',
  '- Use periods for pauses between thoughts. Commas for short breaths. The TTS engine reads your text aloud and uses punctuation for pacing.',
  '- Keep it under 2-3 sentences. Brevity is king on stage.',
  '- Never say the same spoken sentence twice in one reply. If you already said a line, do not echo it again after a tool call — add new substance or stay silent.',
  '- Never break character. You are Kiki the copresenter, not an AI assistant.',
  '- When Algimantas says something short like "thanks" or "okay", reply with one punchy line.',
  '',
  'WORDS ONLY — NOT ACTION NARRATION:',
  '- What goes to TTS is only what a human copresenter would say into the mic — real sentences for the room.',
  '- Do NOT narrate tools or the UI: no "watch this", "I am highlighting", "here comes a diagram", "let me pull that up", "done", as play-by-play.',
  '- If a tool makes the point visually, you may stay silent or add one substantive line (a fact, joke, or bridge) — never a description of the tool.',
  '- Never prefix lines with labels like "Action:", "Narration:", or "Stage:".',
  '',
  'CONTEXT: You hear Algimantas via speech-to-text. The slide info is background — respond to what Algimantas SAID.',
  '- A user message starting with [Earlier conversation — memory for Kiki only] is a compressed recap of prior turns, not something Algimantas just said into the mic.',
  '- Persisted chat history is text-only: past tool calls and tool results are not replayed to save context. Use tools freely on each new turn when it helps.',
  '',
  'STREAM SLIDE ACTIONS — use only the API tool / function calls Ollama provides (streamed `tool_calls`). The host runs them in deck order. Pass JSON arguments per each tool schema; invented tool names are ignored.',
  'You may call ONLY these tools: highlight_text, emphasize_bullet, go_to_slide, fireworks. Nothing else exists in your tool list — do not try set_voice, overlays, or diagram tools.',
  'Do not put <tools> XML or tool markup in spoken text — only use real tool calls. Plain text is for the audience (TTS).',
  '',
  'Algimantas says "let\'s stress latency" → short spoken line plus tool highlight_text with arguments { "text": "latency" }.',
  '',
  'Algimantas says "that worked" → short line plus tool fireworks with {} or { "duration_seconds": 4 }.',
  '',
  'TOOL RULES:',
  '- Only use tools when they genuinely help or when Algimantas explicitly asks.',
  '- Do NOT use tools on every turn.',
  '- Tools do not require a spoken caption. If you speak, it must be audience words — never play-by-play of the tool.',
].join('\n') +
  `\n\nENUM HINT: This deck has ${deck.length} slides (slide_number 1–${deck.length}).` +
  ` emphasize_bullet index runs 1–${maxTopLevelBulletsInDeck(deck)} (top-level bullets only; max on any slide).`;

function ollamaPruneConversation(maxTokens = OLLAMA_HISTORY_TOKEN_BUDGET) {
  const msgs = ollamaConversation.messages;
  if (msgs.length <= 1) return;
  const sys = msgs[0];
  let budget = maxTokens - Math.ceil(messageRoughChars(sys) / 3.5);
  const keep = [];
  for (let i = msgs.length - 1; i >= 1; i--) {
    const cost = Math.ceil(messageRoughChars(msgs[i]) / 3.5);
    if (budget - cost < 0) break;
    keep.unshift(msgs[i]);
    budget -= cost;
  }
  ollamaConversation.messages = [sys, ...keep];
}

const ASSISTANT_DEBUG_LS = 'kittenSlidesDebug';
const ASSISTANT_DEBUG_MAX_ENTRIES = 100;

function readAssistantDebugFlag() {
  try {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('debug');
    if (v === '0' || v === 'false') return false;
    if (params.has('debug')) return true;
    return localStorage.getItem(ASSISTANT_DEBUG_LS) === '1';
  } catch {
    return false;
  }
}

let assistantDebugEntries = [];

function safeAssistantDebugStringify(obj, maxLen = 2400) {
  try {
    const s = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
    return s.length > maxLen ? `${s.slice(0, maxLen)}\n…(truncated)` : s;
  } catch {
    return String(obj);
  }
}

function escapeAssistantDebugHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderAssistantDebugLog() {
  if (!assistantDebugLogEl) return;
  assistantDebugLogEl.innerHTML = assistantDebugEntries
    .map(
      (e) =>
        `<div class="assistant-debug-entry"><div class="assistant-debug-meta"><span class="assistant-debug-kind">${escapeAssistantDebugHtml(e.kind)}</span> · ${escapeAssistantDebugHtml(e.t)}</div><pre class="assistant-debug-body">${escapeAssistantDebugHtml(e.body)}</pre></div>`,
    )
    .join('');
  assistantDebugLogEl.scrollTop = assistantDebugLogEl.scrollHeight;
}

function pushAssistantDebug(kind, detail) {
  if (!readAssistantDebugFlag()) return;
  const t = new Date().toISOString().slice(11, 23);
  const body = safeAssistantDebugStringify(detail);
  assistantDebugEntries.push({ kind, t, body });
  if (assistantDebugEntries.length > ASSISTANT_DEBUG_MAX_ENTRIES) {
    assistantDebugEntries.splice(0, assistantDebugEntries.length - ASSISTANT_DEBUG_MAX_ENTRIES);
  }
  renderAssistantDebugLog();
  try {
    console.debug(`[slides-assistant] ${kind}`, detail);
  } catch {
    // ignore
  }
}

function clearAssistantDebugLog() {
  assistantDebugEntries = [];
  renderAssistantDebugLog();
}

function syncAssistantDebugPanelVisibility() {
  if (!assistantDebugPanelEl) return;
  assistantDebugPanelEl.hidden = !readAssistantDebugFlag();
  syncPresenterRailVisibility();
}

function initAssistantDebugPanel() {
  syncAssistantDebugPanelVisibility();
  assistantDebugClearBtn?.addEventListener('click', () => clearAssistantDebugLog());
}

window.kittenSlidesAssistantDebug = {
  isEnabled: () => readAssistantDebugFlag(),
  enablePersist: () => {
    localStorage.setItem(ASSISTANT_DEBUG_LS, '1');
    syncAssistantDebugPanelVisibility();
  },
  disablePersist: () => {
    localStorage.removeItem(ASSISTANT_DEBUG_LS);
    syncAssistantDebugPanelVisibility();
  },
  clear: clearAssistantDebugLog,
  log: (kind, detail) => pushAssistantDebug(kind || 'manual', detail ?? ''),
  getContextStats: () => getOllamaConversationContextStats(),
  refreshContextMeter: () => updateLlmContextMeter(),
};

function installOllamaAdapter() {
  const k = window.kittenSlidesOllama;
  if (!k?.chat) return;

  window.slideAssistantAdapter = {
    respond: async function ollamaAdapterRespond(args) {
      const { slide, slideIndex, context, question, deck, isStale, onSentence } = args;
      const deckLen = Array.isArray(deck) ? deck.length : 0;
      const title = typeof slide.title === 'string' ? slide.title : '';
      const slideOrdinal = deckLen > 0 ? Math.min(slideIndex + 1, deckLen) : slideIndex + 1;

      const sessionKey = `${slideIndex}|${typeof slide.kicker === 'string' ? slide.kicker : ''}|${title}`;
      const slideChanged = ollamaConversation.lastSessionKey !== null && sessionKey !== ollamaConversation.lastSessionKey;

      const pos = `[slide ${slideOrdinal}/${deckLen || '?'}: ${title}]`;

      let userContent = question;
      if (ollamaConversation.messages.length === 0 || slideChanged) {
        userContent += `\n\n${pos}\nBackground: ${context}`;
      }

      const chatMessages =
        ollamaConversation.messages.length === 0
          ? [
              { role: 'system', content: OLLAMA_SLIDE_SYSTEM_PROMPT },
              { role: 'user', content: userContent },
            ]
          : [...ollamaConversation.messages, { role: 'user', content: userContent }];

      let payloadChars = 0;
      for (let mi = 0; mi < chatMessages.length; mi += 1) payloadChars += messageRoughChars(chatMessages[mi]);
      pushAssistantDebug('llm_request', {
        slideOrdinal,
        title,
        question,
        userMessageChars: userContent.length,
        streaming: Boolean(onSentence),
        payloadChars,
        payloadTokensEst: Math.ceil(payloadChars / 3.5),
        historyMessages: chatMessages.length,
      });
      pushAssistantDebug('llm_context_preview', {
        chars: (context || '').length,
        preview: (context || '').slice(0, 900),
      });

      let lastTtsNorm = '';
      const onSentenceDeduped =
        typeof onSentence === 'function'
          ? async (sentence) => {
              const norm = normalizeSpokenSentenceKey(sentence);
              if (shouldDedupeSpokenSentence(norm) && norm === lastTtsNorm) {
                pushAssistantDebug('tts_sentence_skipped_duplicate', {
                  text: String(sentence || '').slice(0, 240),
                });
                return;
              }
              if (shouldDedupeSpokenSentence(norm)) lastTtsNorm = norm;
              await onSentence(sentence);
            }
          : undefined;

      const historyLenBeforeTurn = chatMessages.length;

      const answer = await k.chat({
        messages: chatMessages,
        think: false,
        onSentence: onSentenceDeduped,
        onToolCall: async (call) => {
          const name = call?.function?.name || '?';
          const rawArgs = call?.function?.arguments;
          pushAssistantDebug('tool_call', { name, arguments: rawArgs });
          try {
            const result = await executeToolCall(call);
            pushAssistantDebug('tool_result', {
              name,
              result: typeof result === 'string' ? result : safeAssistantDebugStringify(result, 800),
            });
            return result;
          } catch (err) {
            pushAssistantDebug('tool_error', { name, message: err?.message || String(err) });
            throw err;
          }
        },
        isStale,
      });

      if (isStale?.()) {
        const dropped = chatMessages.length - historyLenBeforeTurn;
        while (chatMessages.length > historyLenBeforeTurn) chatMessages.pop();
        pushAssistantDebug('llm_interrupted', {
          droppedRows: dropped,
          note: 'Space interrupt — partial model/tool rows discarded; history unchanged.',
        });
        updateLlmContextMeter();
        return '';
      }

      pushAssistantDebug('llm_reply', {
        chars: (answer || '').length,
        text: answer || '',
      });

      const mainTurnUsage = window.kittenSlidesOllama?.getLastChatUsage?.() ?? null;

      ollamaConversation.lastSessionKey = sessionKey;

      // `k.chat` appends assistant (+ tool) messages onto `chatMessages` when tools are used.
      if (chatMessages[chatMessages.length - 1]?.role !== 'assistant') {
        chatMessages.push({
          role: 'assistant',
          content: answer && String(answer).trim().length > 0 ? answer : ' ',
        });
      }
      ollamaConversation.messages = compactHistoryToTextOnly(chatMessages);
      await maybeSummarizeOllamaHistory(k);
      ollamaPruneConversation();
      lastCopresenterOllamaUsage = mainTurnUsage;
      updateLlmContextMeter();
      pushAssistantDebug('llm_context_size', {
        ...getOllamaConversationContextStats(),
        ollamaLastTurn: lastCopresenterOllamaUsage,
      });

      return answer || 'I could not produce an answer. Try rephrasing your question.';
    },
  };
}

function uninstallOllamaAdapter() {
  ollamaConversation.messages = [];
  ollamaConversation.lastSessionKey = null;
  lastCopresenterOllamaUsage = null;
  updateLlmContextMeter();
  if (window.slideAssistantAdapter?.respond?.name === 'ollamaAdapterRespond') {
    delete window.slideAssistantAdapter;
  }
}
// --- end Ollama adapter bridge ---



function buildSlideContext(slide) {
  const glossBlock = formatGlossaryForPlaintext(slide);
  return `Slide: ${slide.title}\nSection: ${slide.kicker}\nSummary: ${slide.lede}\nBullets:\n${formatBulletsForPlaintext(slide.bullets)}${glossBlock ? `\n${glossBlock}\n` : '\n'}Presenter notes: ${slide.notes}\nLLM assist notes: ${slide.llmNotes}`;
}

function mergedSlideAt(index) {
  const content = deck[index];
  if (!content) return null;
  const meta = getSlideMeta(index);
  return {
    ...content,
    kicker: meta.section,
    duration: meta.duration,
    takeaway: meta.takeaway,
    artifacts: meta.artifacts,
    audienceQuestion: meta.audienceQuestion,
  };
}

function estimateTokens(text) {
  return Math.ceil((text || '').length / 3.5);
}

function stringifyForTokenEstimate(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Serialized-ish size of one message row (role + content + native tool_calls / tool rows). */
function messageRoughChars(m) {
  if (!m || typeof m !== 'object') return 0;
  let s = `${m.role || ''}\n`;
  if (typeof m.content === 'string') s += m.content;
  else s += stringifyForTokenEstimate(m.content);
  if (typeof m.tool_name === 'string' && m.tool_name.length) s += `\n${m.tool_name}`;
  if (Array.isArray(m.tool_calls) && m.tool_calls.length) s += stringifyForTokenEstimate(m.tool_calls);
  return s.length;
}

function formatCtxTokShort(n) {
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

function getOllamaConversationContextStats(budget = OLLAMA_HISTORY_TOKEN_BUDGET) {
  const msgs = ollamaConversation.messages;
  let chars = 0;
  for (let i = 0; i < msgs.length; i += 1) chars += messageRoughChars(msgs[i]);
  const tokensEst = Math.ceil(chars / 3.5);
  const pct = budget > 0 ? Math.min(100, Math.round((tokensEst / budget) * 100)) : 0;
  return {
    messages: msgs.length,
    chars,
    tokensEst,
    budget,
    pct,
  };
}

/** Matches `r="14"` on the context SVG circles (user units). */
const LLM_CTX_RING_R = 14;
const LLM_CTX_RING_LEN = 2 * Math.PI * LLM_CTX_RING_R;

function setLlmContextRingFill(pct01To100) {
  const p = Math.min(100, Math.max(0, Number(pct01To100) || 0));
  const dashLen = LLM_CTX_RING_LEN;
  const off = dashLen * (1 - p / 100);
  const dashStr = String(dashLen);
  const offStr = String(off);
  for (const id of ['llm-context-ind', 'stage-llm-context-ind']) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.setAttribute('stroke-dasharray', dashStr);
    el.setAttribute('stroke-dashoffset', offStr);
    if (el instanceof SVGElement) {
      el.style.strokeDasharray = dashStr;
      el.style.strokeDashoffset = offStr;
    }
  }
}

function updateLlmContextMeter() {
  const st = getOllamaConversationContextStats();
  const baseTip =
    'Ring = estimated copresenter history vs prune/summarize budget (chars÷3.5). When it fills, older turns compress — replies may feel different.';

  const applyLevel = (level) => {
    if (llmContextWrapEl) {
      if (level) llmContextWrapEl.dataset.level = level;
      else delete llmContextWrapEl.dataset.level;
    }
    if (stageLlmContextRingEl) {
      if (level) stageLlmContextRingEl.dataset.level = level;
      else stageLlmContextRingEl.removeAttribute('data-level');
    }
  };

  if (st.messages === 0) {
    lastCopresenterOllamaUsage = null;
    if (llmContextMeterEl) llmContextMeterEl.textContent = '0% · idle';
    applyLevel('');
    setLlmContextRingFill(0);
    if (llmContextWrapEl) llmContextWrapEl.title = `${baseTip} No messages yet (0%).`;
    if (stageLlmContextRingEl) stageLlmContextRingEl.title = `${baseTip} No messages yet.`;
    return;
  }

  const ollama = lastCopresenterOllamaUsage;
  const ollamaBit =
    ollama && (ollama.promptEvalCount > 0 || ollama.evalCount > 0)
      ? ` · ↑${formatCtxTokShort(ollama.promptEvalCount)}↓${formatCtxTokShort(ollama.evalCount)}`
      : ollama && ollama.apiCalls > 0
        ? ' · Ollama (no tok)'
        : '';
  const level = st.pct >= 92 ? 'high' : st.pct >= 72 ? 'mid' : 'low';
  applyLevel(level);
  const fillPct = Math.min(100, (st.tokensEst / Math.max(1, st.budget)) * 100);
  setLlmContextRingFill(fillPct);

  if (llmContextMeterEl) {
    llmContextMeterEl.textContent = `${st.pct}% · ~${formatCtxTokShort(st.tokensEst)}/${formatCtxTokShort(st.budget)} · ${st.messages} msgs${ollamaBit}`;
  }

  const detailTip = `${baseTip} Now ~${st.tokensEst}/${st.budget} est. tok, ${st.messages} msgs (${st.pct}% of budget).`;
  if (llmContextWrapEl) llmContextWrapEl.title = detailTip;
  if (stageLlmContextRingEl) stageLlmContextRingEl.title = detailTip;
}

function findSummaryTailStart(nonSys, minKeep) {
  if (nonSys.length <= minKeep) return 0;
  let start = nonSys.length - minKeep;
  while (start > 0 && nonSys[start].role !== 'user') start -= 1;
  return start;
}

/**
 * User turns may append `[slide n/m: …]\\nBackground: …` (deck grounding). That is not spoken dialogue
 * and must not be sent to the context summarizer (only real back-and-forth should be compressed).
 */
function userContentForSummaryTranscript(content) {
  const s = typeof content === 'string' ? content : String(content ?? '');
  const re = /\n\n\[slide [^\]]+\]\nBackground:\s*/;
  const hit = re.exec(s);
  if (!hit) return s.trim();
  return s.slice(0, hit.index).trim();
}

function formatMsgForSummaryTranscript(m) {
  if (m.role === 'user') {
    const d = userContentForSummaryTranscript(m.content);
    return `Algimantas: ${d.length ? d : '(turn was slide grounding only)'}`;
  }
  if (m.role === 'assistant') {
    const names =
      Array.isArray(m.tool_calls) && m.tool_calls.length
        ? ` [tools: ${m.tool_calls
            .map((t) => t?.function?.name)
            .filter(Boolean)
            .join(', ')}]`
        : '';
    return `Kiki:${names} ${m.content}`;
  }
  if (m.role === 'tool') {
    const c = String(m.content || '')
      .replace(/\s+/g, ' ')
      .trim();
    return `Tool (${m.tool_name}): ${c.slice(0, 420)}${c.length > 420 ? '…' : ''}`;
  }
  return `${m.role}: ${String(m.content ?? '')}`;
}

/**
 * When estimated history exceeds the budget, compress the oldest turns via a tool-free chat call,
 * then keep recent messages verbatim. Falls back to prune-only if summarization fails.
 * Only user/assistant dialogue is summarized: the copresenter system prompt is never in the transcript,
 * and slide/deck grounding appended to user messages is stripped for summarization.
 */
async function maybeSummarizeOllamaHistory(k) {
  const msgs = ollamaConversation.messages;
  if (!k?.chat || msgs.length < 3) return;

  const sys = msgs[0];
  if (sys?.role !== 'system') return;

  const nonSys = msgs.slice(1).filter((m) => m && m.role !== 'system');
  if (nonSys.length <= OLLAMA_SUMMARY_TAIL_MIN) return;

  const stats = getOllamaConversationContextStats();
  if (stats.tokensEst <= OLLAMA_HISTORY_TOKEN_BUDGET) return;

  const tailStart = findSummaryTailStart(nonSys, OLLAMA_SUMMARY_TAIL_MIN);
  const head = nonSys.slice(0, tailStart);
  const tail = nonSys.slice(tailStart);
  if (head.length === 0) return;

  let headTokens = 0;
  for (let i = 0; i < head.length; i += 1) headTokens += Math.ceil(messageRoughChars(head[i]) / 3.5);
  if (headTokens < OLLAMA_SUMMARY_MIN_HEAD_TOKENS) return;

  const SUMMARY_SYS =
    'You compress a live copresenter transcript (Algimantas human + Kiki AI on stage). Output plain text, at most 12 short lines. Preserve: questions asked, key answers, slide or demo mentions, jokes, unresolved threads. No markdown headings. No role-play. English.';

  const transcript = head.map(formatMsgForSummaryTranscript).join('\n\n');

  try {
    pushAssistantDebug('context_summarize_start', {
      headMessages: head.length,
      headTokensEst: headTokens,
    });
    const summary = await k.chat({
      messages: [
        { role: 'system', content: SUMMARY_SYS },
        { role: 'user', content: `Transcript to compress:\n\n${transcript}` },
      ],
      think: false,
      maxTokens: OLLAMA_SUMMARY_MAX_TOKENS,
    });
    const trimmed = (summary || '').trim();
    if (trimmed.length < 24) throw new Error('summary too short');

    const memoryBlock =
      '[Earlier conversation — memory for Kiki only; do not read aloud unless asked]\n' + trimmed;

    ollamaConversation.messages = [sys, { role: 'user', content: memoryBlock }, ...tail];
    pushAssistantDebug('context_summarize_done', {
      summaryChars: trimmed.length,
      tailMessages: tail.length,
    });
  } catch (e) {
    pushAssistantDebug('context_summarize_error', { message: e?.message || String(e) });
  }
}

function formatSlideBlockForLlm(slide, i, n) {
  const art =
    Array.isArray(slide.artifacts) && slide.artifacts.length
      ? `\nArtifacts:\n- ${slide.artifacts.join('\n- ')}`
      : '';
  const aq = slide.audienceQuestion ? `\nAudience question (prompt): ${slide.audienceQuestion}` : '';
  const glossBlock = formatGlossaryForPlaintext(slide);
  return (
    `--- Slide ${i + 1} of ${n} ---\n` +
      `Slide: ${slide.title}\nSection: ${slide.kicker}\nDuration: ${slide.duration}\nTakeaway: ${slide.takeaway}${art}${aq}\n` +
      `Summary: ${slide.lede}\nBullets:\n${formatBulletsForPlaintext(slide.bullets)}${glossBlock ? `\n${glossBlock}\n` : '\n'}` +
      `Presenter notes: ${slide.notes}\nLLM assist notes: ${slide.llmNotes}`
  );
}

function formatSlideCompactForLlm(slide, i, n) {
  const t = slide.title || '(untitled)';
  const tw = slide.takeaway || slide.lede || '';
  return `Slide ${i + 1}/${n}: "${t}" — ${tw}`;
}

/**
 * Budget-aware deck context: full detail for current slide, compact summaries for
 * prior slides (newest first), stopping when the token budget is exhausted.
 */
function buildDeckContextThroughSlide(upToIndexInclusive, tokenBudget = 1800) {
  const n = deck.length;
  const last = Math.min(Math.max(0, upToIndexInclusive), n - 1);
  const current = mergedSlideAt(last);
  if (!current) return '';
  const title = current.title || '';

  const preamble =
    `Background facts for the talk — not instructions to summarize this text.\n\n` +
    `Presenter: Algimantas Krasauskas. Address him as Algimantas in your spoken lines. STT input is Algimantas unless clearly an audience aside.\n\n` +
    `If Algimantas's question is ambiguous, prefer interpreting it as their spoken intent (timing, demo, joke, tech, meta) rather than "explain the slide." ` +
    `Use this deck only when they need grounding on kitten-tts-js or this section.\n\n` +
    `Current position: slide ${last + 1} of ${n} — "${title}".\n\n`;

  const currentBlock = formatSlideBlockForLlm(current, last, n);
  let used = estimateTokens(preamble) + estimateTokens(currentBlock);

  let priorSection;
  if (last === 0) {
    priorSection = '(Opening slide — no earlier slides in this deck.)';
  } else {
    const priorParts = [];
    for (let i = last - 1; i >= 0; i -= 1) {
      const s = mergedSlideAt(i);
      if (!s) continue;
      const compact = formatSlideCompactForLlm(s, i, n);
      const cost = estimateTokens(compact);
      if (used + cost > tokenBudget) break;
      priorParts.unshift(compact);
      used += cost;
    }
    priorSection = priorParts.length > 0
      ? priorParts.join('\n')
      : '(Earlier slides omitted — context budget reached.)';
  }

  return (
    preamble +
    `=== CURRENT SLIDE ===\n${currentBlock}\n\n` +
    `=== EARLIER SLIDES (compact, for continuity) ===\n${priorSection}`
  );
}


async function askAssistant(question, options = {}) {
  const slide = getActiveSlide();
  const trimmedQ = typeof question === 'string' ? question.trim() : '';
  if (!trimmedQ) {
    updateStatus('No speech detected. Try again.', 'warning');
    if (narratorModeActive) {
      narratorAudioPhase = NarratorPhase.ARMED;
      scheduleRestartNarratorMic(activeInterruptPreset().restartMicNarrateEndedMs);
    }
    setOrbState('idle');
    return '';
  }

  const speakEpoch = options.speakEpoch;

  pushAssistantDebug('user_transcript', {
    text: trimmedQ,
    slide: currentSlideIndex + 1,
    speak: Boolean(options.speakAnswer),
  });

  if (!window.slideAssistantAdapter?.respond) {
    updateStatus('Connect Ollama first (click Connect above).', 'warning');
    if (narratorModeActive) {
      narratorAudioPhase = NarratorPhase.ARMED;
    }
    setOrbState('idle');
    return '';
  }

  const useStreaming = Boolean(options.speakAnswer);
  updateStatus(
    useStreaming
      ? 'Copresenter streaming reply…'
      : 'Assistant is generating a reply…',
  );
  setOrbState('thinking');
  clearUserTranscriptDisplay();
  pttAccumulated = '';
  pttPriorText = '';
  pttDiscardSttUntilOnstart = false;
  if (narratorModeActive) {
    refreshNarratorLiveUi('Thinking…', '');
  }

  try {
    let answer;
    if (useStreaming) {
        await ensureTtsReady();
        if (narratorModeActive) {
          narratorAudioPhase = NarratorPhase.COGNITION;
        }
        suspendNarratorListeningForPlayback();
        syncMediaSessionPlaying('copresenter reply', true);

        let firstSentence = true;
        answer = await window.slideAssistantAdapter.respond({
          slide,
          slideIndex: currentSlideIndex,
          question: trimmedQ,
          deck,
          context: buildDeckContextThroughSlide(currentSlideIndex),
          isStale:
            speakEpoch != null ? () => speakEpoch !== assistantEpoch : undefined,
          onSentence: async (sentence) => {
            if (speakEpoch != null && speakEpoch !== assistantEpoch) return;
            pushAssistantDebug('tts_sentence', { text: String(sentence || '').slice(0, 500) });
            if (firstSentence) {
              firstSentence = false;
              if (narratorModeActive) {
                narratorAudioPhase = NarratorPhase.VOCALIZING;
                refreshNarratorLiveUi('Assistant speaking (streaming TTS)…', '');
              }
            }
            await narrateSentence(sentence, speakEpoch);
          },
        });

        syncMediaSessionPlaying('', false);
        if (narratorModeActive) {
          narratorAudioPhase = NarratorPhase.ARMED;
          refreshNarratorLiveUi('Listening soon…', '');
          scheduleRestartNarratorMic(activeInterruptPreset().restartMicNarrateEndedMs);
        }
        if (!listening) setOrbState('idle');
    } else {
      answer = await window.slideAssistantAdapter.respond({
        slide,
        slideIndex: currentSlideIndex,
        question: trimmedQ,
        deck,
        context: buildDeckContextThroughSlide(currentSlideIndex),
        isStale:
          speakEpoch != null ? () => speakEpoch !== assistantEpoch : undefined,
      });
    }

    if (speakEpoch != null && speakEpoch !== assistantEpoch) {
      updateStatus('Interrupted — listening for you.', 'success');
      setOrbState('listening');
      return '';
    }

    if (answer == null || answer === '') {
      updateStatus('Copresenter returned an empty reply. Try again.', 'warning');
      if (narratorModeActive) {
        narratorAudioPhase = NarratorPhase.ARMED;
        scheduleRestartNarratorMic(activeInterruptPreset().restartMicNarrateEndedMs);
        refreshNarratorLiveUi('Ready — press Space to talk.', '');
      }
      clearUserTranscriptDisplay();
      setOrbState('idle');
      return '';
    }

    if (options.speakAnswer && !useStreaming) {
      await narrate(answer, 'the assistant response');
    }

    if (speakEpoch != null && speakEpoch !== assistantEpoch) {
      updateStatus('Interrupted during playback — listening.', 'success');
      setOrbState('listening');
      return '';
    }
    const modelName = window.kittenSlidesOllama?.getModel?.() || 'Ollama';
    updateStatus(
      useStreaming
        ? `Copresenter answered via ${modelName} (streaming).`
        : `Assistant answered via ${modelName}.`,
      'success',
    );
    clearUserTranscriptDisplay();
    if (!options.speakAnswer) {
      setOrbState('idle');
    }
    return answer;
  } catch (error) {
    pushAssistantDebug('ask_assistant_error', {
      message: error?.message || String(error),
      stack: error?.stack?.slice(0, 1200),
    });
    updateStatus(`Assistant error: ${error.message}`, 'warning');
    if (narratorModeActive) {
      narratorAudioPhase = NarratorPhase.ARMED;
      scheduleRestartNarratorMic(activeInterruptPreset().restartMicNarrateEndedMs);
      refreshNarratorLiveUi('Ready — press Space to talk.', '');
    }
    clearUserTranscriptDisplay();
    setOrbState('idle');
    throw error;
  }
}

if (recognition) {
  applySttLanguageFromUi();
  recognition.continuous = true;
  recognition.interimResults = true;
  try {
    recognition.maxAlternatives = 1;
  } catch {
    // optional API
  }

  recognition.onstart = () => {
    listening = true;
    sttChipEl.textContent = narratorModeActive ? 'narrator active' : 'listening';
    if (narratorModeActive) {
      narratorAudioPhase = NarratorPhase.LISTENING;
      const cap = pttAccumulated.replace(/\s+/g, ' ').trim();
      refreshNarratorLiveUi('Listening…', cap || '…');
      if (narratorLiveTextEl) narratorLiveTextEl.textContent = cap || '…';
      if (cap) showStageCaption(cap, true);
      else showStageCaption('Listening…', true);
      if (navigator.vibrate) {
        navigator.vibrate(12);
        nwBadgeVibrateEl?.removeAttribute('hidden');
      }
    }
    updateStatus(narratorModeActive ? 'Listening — speak your question…' : 'Listening…');
    setOrbState('listening');
    // After Backspace + stop(), late `onresult` from the old session can still fire; drop those until this turn finishes.
    queueMicrotask(() => {
      pttDiscardSttUntilOnstart = false;
    });
  };

  recognition.onend = () => {
    listening = false;
    sttChipEl.textContent = narratorModeActive ? 'narrator ready' : 'ready';

    if (narratorModeActive && narratorAudioPhase === NarratorPhase.LISTENING) {
      if (pttUserStopped) {
        pttUserStopped = false;
        const text = pttAccumulated.trim();
        pttAccumulated = '';
        pttPriorText = '';
        pttDiscardSttUntilOnstart = true;
        if (text.length >= 2) {
          clearUserTranscriptDisplay();
          refreshNarratorLiveUi('Thinking…', '');
          setOrbState('thinking');
          void pttSendToLlm(text);
        } else {
          narratorAudioPhase = NarratorPhase.ARMED;
          refreshNarratorLiveUi('Ready — press Space to talk.', '');
          setOrbState('idle');
          showStageCaption('');
          showStagePttHint('Press Space to talk');
          updateStatus('No speech captured. Press Space to try again.');
        }
      } else {
        // Same PTT turn (between Space and Space): browser ended the session; carry text forward only for this window.
        pttPriorText = pttAccumulated;
        try {
          recognition.start();
        } catch {
          pttDiscardSttUntilOnstart = false;
        }
      }
      return;
    }

    if (!narratorModeActive && currentOrbState !== 'speaking') {
      setOrbState('idle');
    }
  };

  recognition.onresult = (event) => {
    if (
      shouldIgnoreSttForPttAccumulation({
        narratorModeActive,
        narratorProcessing,
        narratorAudioPhase,
        narrationPlaying: isActiveNarrationPlaying(),
        sttIgnoreResultsUntilPerfMs,
      })
    ) {
      return;
    }
    if (pttDiscardSttUntilOnstart) return;

    const current = transcriptForDisplay(event);
    const full = pttPriorText ? (pttPriorText + ' ' + current).trim() : current;
    pttAccumulated = full;
    if (narratorLiveTextEl) narratorLiveTextEl.textContent = full || '…';
    if (narratorModeActive) {
      refreshNarratorLiveUi('Listening… press Space to send.', full || '…');
      showStageCaption(full || 'Listening…', true);
    }
  };

  recognition.onerror = (event) => {
    if (event.error === 'aborted') return;
    if (event.error === 'no-speech') {
      // In PTT: silence is normal, recognition.onend will restart
      return;
    }
    pushAssistantDebug('stt_error', { error: event.error });
    if (event.error === 'not-allowed') {
      updateStatus('Microphone blocked. Allow mic access for narrator mode.', 'warning');
      setNarratorMode(false);
      return;
    }
    updateStatus(`STT error: ${event.error}`, 'warning');
    if (!narratorModeActive && !listening) {
      setOrbState('idle');
    }
  };
}

initAssistantDebugPanel();

prevSlideBtn?.addEventListener('click', () => {
  if (currentSlideIndex > 0) {
    currentSlideIndex -= 1;
    renderSlide();
  }
});

nextSlideBtn?.addEventListener('click', () => {
  if (currentSlideIndex < deck.length - 1) {
    currentSlideIndex += 1;
    renderSlide();
  }
});

/** True when the Ollama base URL points at this machine (model load + first token are slow; we prewarm on connect). */
function isLikelyLocalOllamaUrl(url) {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1';
  } catch {
    return false;
  }
}

/** One cheap chat to load weights into RAM; only used for local Ollama (cloud is already warm). */
async function prewarmLocalOllamaModel() {
  const k = window.kittenSlidesOllama;
  if (!k?.isConnected?.() || !k.chat) return;
  try {
    updateStatus('Warming up local model…');
    await k.chat({
      messages: [{ role: 'user', content: 'hi' }],
      maxTokens: 4,
      think: false,
    });
  } catch {
    // first real turn will show errors; connect + tags already succeeded
  }
}

/**
 * Serialized Ollama connect/rebind. Parallel `connect()` calls share one module-level `model` and
 * would clobber each other (e.g. initial auto-connect + LLM dropdown), leaving the wrong name in the pill.
 */
let ollamaConnectChain = Promise.resolve();

/** Shared path: `/api/tags` + bind model + reinstall adapter; `onStatus` drives the status pill during reload. */
async function runOllamaConnectFlowInternal(
  initialStatusMsg = 'Connecting…',
  forcedModelId?: string,
) {
  updateStatus(initialStatusMsg);
  // Not TS in the browser: Vite builds src/slides-ollama-assistant.ts → slides-ollama.js.
  await import(/* @vite-ignore */ './slides-ollama.js');
  const k = window.kittenSlidesOllama;
  if (!k?.connect) throw new Error('slides-ollama.js did not register window.kittenSlidesOllama');
  const baseUrl = ollamaUrlEl?.value || 'http://localhost:11434';
  const trimmed = typeof forcedModelId === 'string' ? forcedModelId.trim() : '';
  const modelId = trimmed.length > 0 ? trimmed : getOllamaModelIdFromDom();
  await k.connect(baseUrl, modelId, (msg) => updateStatus(msg));
  k.setModel(modelId);
  installOllamaAdapter();
  updateLlmContextMeter();
  if (llmChipEl) llmChipEl.textContent = 'ollama';
  if (isLikelyLocalOllamaUrl(baseUrl)) {
    await prewarmLocalOllamaModel();
  }
  updateStatus(`Ready — ${modelId}`, 'success');
}

/**
 * Enqueue connect so only one flow mutates `window.kittenSlidesOllama` at a time.
 * Resolves when *this* enqueued run finishes (not the whole backlog after later enqueue).
 */
function queueOllamaConnectFlow(initialStatusMsg?: string, forcedModelId?: string): Promise<void> {
  let finish!: () => void;
  const thisRun = new Promise<void>((r) => {
    finish = r;
  });
  const job = async () => {
    try {
      await runOllamaConnectFlowInternal(initialStatusMsg, forcedModelId);
    } catch (e) {
      if (llmChipEl) llmChipEl.textContent = 'error';
      updateStatus(`Ollama: ${(e as Error)?.message || e}`, 'warning');
    } finally {
      finish();
    }
  };
  ollamaConnectChain = ollamaConnectChain.then(job, job);
  return thisRun;
}

function autoConnectOllama() {
  void queueOllamaConnectFlow('Connecting…');
}
function startSlidesLabOllamaWhenDomReady() {
  const run = () => void autoConnectOllama();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
}
startSlidesLabOllamaWhenDomReady();

document.getElementById('ollama-model-select')?.addEventListener('change', async () => {
  updateLabAutoSummary();
  const sel = document.getElementById('ollama-model-select');
  if (!sel || !String(sel.value || '').trim()) return;
  const mid = String(sel.value).trim();
  sel.disabled = true;
  if (llmChipEl) llmChipEl.textContent = '…';
  try {
    await queueOllamaConnectFlow(`Reloading model: ${mid}…`, mid);
  } finally {
    sel.disabled = false;
  }
});

async function warmupLlm() {
  const k = window.kittenSlidesOllama;
  if (!k?.isConnected?.() || !k.chat) return;
  const baseUrl = ollamaUrlEl?.value || 'http://localhost:11434';
  if (isLikelyLocalOllamaUrl(baseUrl)) return;
  try {
    updateStatus('Warming up LLM…');
    await k.chat({
      messages: [{ role: 'user', content: 'hi' }],
      maxTokens: 4,
      think: false,
    });
    updateStatus(`Ready — ${getOllamaModelIdFromDom()}`, 'success');
  } catch {
    // non-fatal — the real request will surface errors
  }
}

presentSlidesBtn.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      presentSlidesBtn.textContent = 'Present';
      return;
    }
    warmupLlm();
    prewarmSlideDiagramEngine();
    await stageCardEl.requestFullscreen();
    presentSlidesBtn.textContent = 'Exit Presentation';
  } catch (error) {
    updateStatus(`Presentation mode failed: ${error.message}`, 'warning');
  }
});

document.addEventListener('fullscreenchange', () => {
  const presenting = Boolean(document.fullscreenElement);
  presentSlidesBtn.textContent = presenting ? 'Exit Presentation' : 'Present';
  syncPresentOrbTrigger();
  if (presenting && document.fullscreenElement === stageCardEl) {
    try {
      stageCardEl.focus({ preventScroll: true });
    } catch {
      /* ignore */
    }
  }
  if (presenting && !narratorModeActive) {
    setNarratorMode(true);
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && narratorModeActive) {
    void acquireNarratorWakeLock();
  }
});

stageOrbTriggerEl?.addEventListener('click', (e) => {
  if (e.detail === 0) return; // keyboard-synthesized click (Space/Enter) — already handled by keydown
  void handlePresentOrbActivate();
});

// --- Walkie-talkie Space handler ---
let pttAccumulated = '';
let pttPriorText = '';
let pttUserStopped = false;
/** After Backspace edit + `recognition.stop()`, ignore straggling results from the old session. */
let pttDiscardSttUntilOnstart = false;

/** Drop accidental double Space / rapid orb taps while narrator is on (ms). */
const NARRATOR_ACTION_DEBOUNCE_MS = 420;
let lastNarratorActionAt = 0;

function shouldIgnoreNarratorActionBurst() {
  const t = performance.now();
  if (t - lastNarratorActionAt < NARRATOR_ACTION_DEBOUNCE_MS) return true;
  lastNarratorActionAt = t;
  return false;
}

/**
 * Recover from a wedged PTT / STT / TTS state (Esc). Stays in narrator mode.
 * Shift+Esc turns narrator off (setNarratorMode false).
 */
function narratorHardReset() {
  if (!narratorModeActive) return;
  assistantEpoch += 1;
  clearNarratorRestartTimer();
  sttIgnoreResultsUntilPerfMs = 0;
  if (narratorWatchdogTimer) {
    clearTimeout(narratorWatchdogTimer);
    narratorWatchdogTimer = 0;
  }
  narratorProcessing = false;
  pttUserStopped = false;
  pttAccumulated = '';
  pttPriorText = '';
  pttDiscardSttUntilOnstart = false;
  stopActiveNarration({ userInterrupt: false });
  narratorAudioPhase = NarratorPhase.ARMED;
  if (recognition && listening) {
    try {
      recognition.stop();
    } catch {
      /* ignore */
    }
  }
  listening = false;
  if (sttChipEl) sttChipEl.textContent = recognition ? 'narrator ready' : 'ready';
  clearUserTranscriptDisplay();
  showStageCaption('');
  showStagePttHint('Press Space to talk');
  refreshNarratorLiveUi('Ready — press Space to talk.', '');
  setOrbState('idle');
  syncMediaSessionPlaying('', false);
  lastNarratorActionAt = 0;
  updateStatus('Narrator reset — press Space to talk.', 'success');
}

/**
 * Begin a PTT capture window: only speech after this (until Space to send) may reach the LLM.
 * Drops prior STT buffers and, if the mic was already running, stops recognition once so the engine cannot replay old text.
 */
function pttStartListening() {
  if (!recognition) {
    updateStatus('Speech recognition not available.', 'warning');
    return;
  }
  clearNarratorRestartTimer();
  pttAccumulated = '';
  pttPriorText = '';
  pttUserStopped = false;
  pttDiscardSttUntilOnstart = true;
  narratorAudioPhase = NarratorPhase.LISTENING;
  refreshNarratorLiveUi('Listening… press Space to send.', '…');
  setOrbState('listening');
  updateStatus('Listening — speak, then press Space to send. Backspace removes the last character.');
  showStageCaption('Listening…', true);
  showStagePttHint('Space to send · Backspace to delete');
  applySttLanguageFromUi();
  if (listening) {
    try {
      recognition.stop();
    } catch {
      /* ignore */
    }
    // `onend` restarts with empty prior/accumulator (only text between this Space and Space-to-send is kept).
  } else {
    try {
      recognition.start();
    } catch {
      pttDiscardSttUntilOnstart = false;
    }
  }
}

/** Remove one character from the PTT buffer; restart STT so the next result does not restore deleted text. */
function pttBackspaceDeleteLastChar() {
  if (!narratorModeActive || narratorAudioPhase !== NarratorPhase.LISTENING) return false;
  if (!pttAccumulated) return false;
  pttAccumulated = pttAccumulated.slice(0, -1);
  pttPriorText = pttAccumulated;
  pttDiscardSttUntilOnstart = true;
  const display = pttAccumulated.replace(/\s+/g, ' ').trim();
  if (narratorLiveTextEl) narratorLiveTextEl.textContent = display || '…';
  refreshNarratorLiveUi('Listening… press Space to send.', display || '…');
  showStageCaption(display || 'Listening…', true);
  if (listening) {
    try {
      recognition.stop();
    } catch {
      /* ignore */
    }
  }
  return true;
}

function pttInterruptAndListen() {
  assistantEpoch += 1;
  pttUserStopped = false;
  pttPriorText = '';
  pttDiscardSttUntilOnstart = false;
  if (isActiveNarrationPlaying()) stopActiveNarration({ userInterrupt: true });
  narratorProcessing = false;
  clearNarratorRestartTimer();
  syncMediaSessionPlaying('', false);
  sttIgnoreResultsUntilPerfMs = performance.now() + 750;
  pttAccumulated = '';
  if (recognition && listening) {
    try {
      recognition.stop();
    } catch {
      /* ignore */
    }
  }
  if (narratorModeActive) {
    narratorAudioPhase = NarratorPhase.ARMED;
    refreshNarratorLiveUi('Ready — press Space to talk.', '');
    setOrbState('idle');
    showStageCaption('');
    showStagePttHint('Press Space to talk');
    updateStatus('Interrupted — press Space when you want to speak.', 'success');
  }
}

async function pttSendToLlm(transcript) {
  const trimmed = transcript.trim();
  if (!trimmed || trimmed.length < 2) {
    narratorAudioPhase = NarratorPhase.ARMED;
    refreshNarratorLiveUi('Ready — press Space to talk.', '');
    setOrbState('idle');
    updateStatus('No speech detected. Press Space to try again.');
    showStageCaption('');
    showStagePttHint('Press Space to talk');
    return;
  }

  narratorAudioPhase = NarratorPhase.COGNITION;
  narratorProcessing = true;
  assistantEpoch += 1;
  const speakEpoch = assistantEpoch;
  showStageCaption('');
  showStagePttHint('Space to interrupt');

  try {
    await askAssistant(trimmed, { speakAnswer: true, speakEpoch });
  } catch (err) {
    updateStatus(`Error: ${err.message}`, 'warning');
  } finally {
    narratorProcessing = false;
    pttAccumulated = '';
    pttPriorText = '';
    if (narratorAudioPhase !== NarratorPhase.LISTENING) {
      narratorAudioPhase = NarratorPhase.ARMED;
      refreshNarratorLiveUi('Ready — press Space to talk.', '');
      setOrbState('idle');
      showStageCaption('');
      showStagePttHint('Press Space to talk');
    }
  }
}

/** @returns {string | null} DIAGRAM_PRESETS key for digit 1 (eval-loop slide) */
function diagramPresetKeyFromDigitCode(code) {
  if (code === 'Digit1' || code === 'Numpad1') return 'reinforcement_loop';
  return null;
}

/**
 * Manual stage effects when the LLM path is down — same as native tools.
 * Alt+1 jumps to the eval-loop diagram slide; Alt+4 = fireworks.
 * Ctrl+Shift+digits = same when Alt is grabbed by the OS/browser.
 */
function runManualStageEffectFromShortcut(event) {
  if (event.repeat) return false;
  const altChord = event.altKey && !event.ctrlKey && !event.metaKey;
  const ctrlShiftChord = event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey;
  if (!altChord && !ctrlShiftChord) return false;
  const code = event.code;

  const presetKey = diagramPresetKeyFromDigitCode(code);
  if (presetKey) {
    event.preventDefault();
    void executeToolCall({ function: { name: `diagram_${presetKey}`, arguments: {} } });
    updateStatus(`Slide: ${presetKey}`, 'success');
    return true;
  }

  if (code === 'Digit4' || code === 'Numpad4') {
    event.preventDefault();
    void executeToolCall({ function: { name: 'fireworks', arguments: {} } });
    updateStatus('Fireworks (keyboard)', 'success');
    return true;
  }

  return false;
}

/** capture: true so Space reaches us before focused toolbar buttons activate (click) */
document.addEventListener(
  'keydown',
  (event) => {
  const t = event.target;
  if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
  if (t instanceof HTMLElement && t.isContentEditable) return;

  if (runManualStageEffectFromShortcut(event)) return;

  if (event.key === 'Backspace' || event.code === 'Backspace') {
    if (pttBackspaceDeleteLastChar()) {
      event.preventDefault();
      if (t instanceof HTMLElement) t.blur();
      return;
    }
  }

  if (event.key === ' ' || event.code === 'Space') {
    event.preventDefault();
    if (t instanceof HTMLElement) t.blur();
    if (!recognition) {
      updateStatus('Speech recognition not available in this browser.', 'warning');
      return;
    }

    if (!narratorModeActive) {
      setNarratorMode(true);
      return;
    }

    if (event.repeat) return;
    if (shouldIgnoreNarratorActionBurst()) return;

    if (narratorAudioPhase === NarratorPhase.LISTENING) {
      pttUserStopped = true;
      if (listening) {
        try { recognition.stop(); } catch { /* ignore */ }
      } else {
        // Browser was between auto-restart cycles — send directly
        const text = pttAccumulated.trim();
        pttAccumulated = '';
        pttPriorText = '';
        pttDiscardSttUntilOnstart = true;
        pttUserStopped = false;
        if (text.length >= 2) {
          clearUserTranscriptDisplay();
          refreshNarratorLiveUi('Thinking…', '');
          setOrbState('thinking');
          void pttSendToLlm(text);
        } else {
          narratorAudioPhase = NarratorPhase.ARMED;
          refreshNarratorLiveUi('Ready — press Space to talk.', '');
          setOrbState('idle');
          showStageCaption('');
          showStagePttHint('Press Space to talk');
          updateStatus('No speech captured. Press Space to try again.');
        }
      }
      return;
    }

    if (narratorAudioPhase === NarratorPhase.COGNITION || narratorAudioPhase === NarratorPhase.VOCALIZING) {
      pttInterruptAndListen();
      return;
    }

    pttStartListening();
    return;
  }

  if (event.key === 'Escape') {
    if (isStagePresenting()) {
      event.preventDefault();
      void document.exitFullscreen();
      updateStatus('Exited presentation', 'success');
      return;
    }
    if (!narratorModeActive) return;
    event.preventDefault();
    if (event.shiftKey) {
      setNarratorMode(false);
    } else {
      narratorHardReset();
    }
    return;
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault();
    if (currentSlideIndex < deck.length - 1) {
      currentSlideIndex += 1;
      renderSlide();
    }
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    if (currentSlideIndex > 0) {
      currentSlideIndex -= 1;
      renderSlide();
    }
  }
},
  { capture: true },
);

renderSlide();
detectCapabilities();
syncPresentOrbTrigger();
setOrbState('idle');
if (typeof requestIdleCallback === 'function') {
  requestIdleCallback(() => prewarmSlideDiagramEngine());
} else {
  setTimeout(() => prewarmSlideDiagramEngine(), 1);
}

updateLlmContextMeter();
window.__kittenSlidesLabReady = true;
