/**
 * Full-screen slide deck + speaker notes + KittenTTS read-aloud (index-style voice controls).
 * No LLM, STT, or copresenter — Jasper (or any voice) reads slide copy and presenter notes.
 */
import {
  deck,
  deckMeta,
  DIAGRAM_PRESETS,
  formatBulletsForPlaintext,
} from './slides-deck-data.js';

type DeckSlideContent = (typeof deck)[number];

type ActiveSlide = DeckSlideContent & {
  kicker: string;
  duration: string;
  takeaway: string;
  artifacts: string[];
  audienceQuestion: string | null;
};

const EMPTY_SLIDE_META = {
  section: '',
  duration: '',
  takeaway: '',
  artifacts: [] as string[],
  audienceQuestion: '' as string | null,
};

const worker = new Worker('./worker.js', { type: 'module' });
const pendingRequests = new Map<
  string,
  { resolve: (v: unknown) => void; reject: (e: Error) => void }
>();

worker.onmessage = (event: MessageEvent) => {
  const { type, id, payload } = event.data as { type: string; id: string; payload?: string };
  const request = pendingRequests.get(id);
  if (!request) return;
  if (type === 'error') {
    request.reject(new Error(String(payload)));
  } else {
    request.resolve(payload);
  }
  pendingRequests.delete(id);
};

function postToWorker(type: string, payload: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = `${Date.now()}-${Math.random()}`;
    pendingRequests.set(id, { resolve, reject });
    worker.postMessage({ type, id, payload });
  });
}

function isCoarseMobileUa(): boolean {
  return /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent || '',
  );
}

function webgpuAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator && Boolean(navigator.gpu);
}

function getSlideMeta(index: number) {
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

let currentSlideIndex = 0;
let ttsLoaded = false;
let ttsLoadFailed = false;
let slideDiagramGen = 0;
let mermaidConfigured = false;

let activeNarrationAudio: HTMLAudioElement | null = null;
let activeNarrationUrl: string | null = null;
let narrationInFlight = false;
/** Bumped on slide change / replay so stale `generate` results are dropped. */
let slideSpeechEpoch = 0;
let stageWasFullscreen = false;

/** In-memory WAV blob cache keyed by "slideIndex:voice:speed". */
const audioCache = new Map<string, Blob>();
/** Whether auto-advance is active (presentation flows through all slides). */
let autoAdvanceActive = false;

type PlaybackState = 'idle' | 'synthesizing' | 'playing' | 'paused';
let playbackState: PlaybackState = 'idle';

function audioCacheKey(slideIdx: number, voice: string, speed: number): string {
  return `${slideIdx}:${voice}:${speed.toFixed(2)}`;
}

const slideKickerEl = document.getElementById('slide-kicker');
const slideTitleEl = document.getElementById('slide-title');
const slideLedeEl = document.getElementById('slide-lede');
const slideBulletsEl = document.getElementById('slide-bullets');
const slideGlossEl = document.getElementById('slide-gloss');
const slideDiagramEl = document.getElementById('slide-diagram');
const presenterStatusEl = document.getElementById('presenter-status');
const stageCardEl = document.getElementById('stage-card');
const stageSlideRefEl = document.getElementById('stage-slide-ref');
const prevSlideBtn = document.getElementById('prev-slide');
const nextSlideBtn = document.getElementById('next-slide');
const voiceSelectEl = document.getElementById('voice-select') as HTMLSelectElement | null;
const runtimeSelectEl = document.getElementById('runtime-select') as HTMLSelectElement | null;
const modelSelectEl = document.getElementById('model-select') as HTMLSelectElement | null;
const speedRangeEl = document.getElementById('speed-range') as HTMLInputElement | null;
const speedValEl = document.getElementById('speed-val');
const runtimeNoteEl = document.getElementById('runtime-note');
const presentSlidesBtn = document.getElementById('present-slides');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const stopBtn = document.getElementById('stop-btn');
const toolbarSetupEl = document.getElementById('toolbar-setup');
const voiceBadgeEl = document.getElementById('voice-badge');
const slideNotesBodyEl = document.getElementById('slide-notes-body');
const presenterMetaLineEl = document.getElementById('presenter-meta-line');
const ttsChipEl = document.getElementById('tts-chip');

function updateStatus(message: string, kind: '' | 'success' | 'warning' | 'error' = '') {
  if (!presenterStatusEl) return;
  presenterStatusEl.textContent = message;
  const cls =
    kind === 'success' ? 'ok' : kind === 'warning' ? 'warn' : kind === 'error' ? 'err' : '';
  presenterStatusEl.className = cls ? `status-pill ${cls}` : 'status-pill';
}

function getActiveSlide(): ActiveSlide {
  const content = deck[currentSlideIndex] as DeckSlideContent;
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

function isPrerecordedMode(): boolean {
  return (runtimeSelectEl?.value ?? 'auto') === 'prerecorded';
}

function updateRuntimeUi(): void {
  const runtime = runtimeSelectEl?.value ?? 'auto';
  const prerecorded = runtime === 'prerecorded';

  const voiceField = voiceSelectEl?.closest('.toolbar-field') as HTMLElement | null;
  const modelField = modelSelectEl?.closest('.toolbar-field') as HTMLElement | null;
  const speedField = speedRangeEl?.closest('.toolbar-field') as HTMLElement | null;
  if (voiceField) voiceField.style.display = prerecorded ? 'none' : '';
  if (modelField) modelField.style.display = prerecorded ? 'none' : '';
  if (speedField) speedField.style.display = prerecorded ? 'none' : '';

  if (runtimeNoteEl) {
    if (prerecorded) {
      runtimeNoteEl.hidden = false;
      runtimeNoteEl.textContent = 'Uses pre-recorded audio — no model download needed.';
    } else {
      runtimeNoteEl.hidden = false;
      runtimeNoteEl.textContent =
        'Auto and CPU use WASM (reliable). GPU (WebGPU) is experimental for Nano — if OrtRun fails, the session reloads on WASM once. Micro/Mini are WASM only.';
    }
  }
  if (!modelSelectEl || prerecorded) return;
  const gpuSelected = runtime === 'gpu';
  const nanoOption = modelSelectEl.querySelector<HTMLOptionElement>(
    'option[value="onnx-community/KittenTTS-Nano-v0.8-ONNX"]',
  );
  const microOption = modelSelectEl.querySelector<HTMLOptionElement>(
    'option[value="onnx-community/KittenTTS-Micro-v0.8-ONNX"]',
  );
  const miniOption = modelSelectEl.querySelector<HTMLOptionElement>(
    'option[value="onnx-community/KittenTTS-Mini-v0.8-ONNX"]',
  );
  if (microOption) microOption.disabled = gpuSelected;
  if (miniOption) miniOption.disabled = gpuSelected;
  if (nanoOption) nanoOption.disabled = false;
  if (gpuSelected && modelSelectEl.value !== 'onnx-community/KittenTTS-Nano-v0.8-ONNX') {
    modelSelectEl.value = 'onnx-community/KittenTTS-Nano-v0.8-ONNX';
  }
}

function getSpeechSpeed(): number {
  if (speedRangeEl) return parseFloat(speedRangeEl.value) || 1;
  return 1;
}

function buildNarrationText(slide: ActiveSlide): string {
  const script = (slide as { presenterScript?: string }).presenterScript;
  if (script) return script;
  const bullets = formatBulletsForPlaintext(slide.bullets);
  const ledeFlat = String(slide.lede || '').replace(/\n+/g, ' ').trim();
  const parts = [
    `Slide: ${slide.title}.`,
    ledeFlat,
    bullets ? `Points:\n${bullets}` : '',
    slide.notes ? `Speaker notes: ${slide.notes}` : '',
  ].filter(Boolean);
  return parts.join('\n\n');
}

/** KittenTTS-friendly cleanup — keep sentence-ending punctuation so _chunkText can split. */
function ttsPreprocess(text: string): string {
  let s = String(text || '').trim();
  s = s.replace(/^\s*(?:action|narration|stage|tool)\s*:\s*/i, '');
  s = s.replace(/\[(?:\s*)(?:pause|beat|laughs?|laughing|applause|gasps?|sighs?|music)(?:\s*)\]/gi, ' ');
  s = s.replace(/\((?:\s*)(?:pause|beat|laughs?|applause)(?:\s*)\)/gi, ' ');
  s = s.replace(/<tools\b[^>]*>[\s\S]*?<\/tools>/gi, '');
  s = s.replace(/\.{3,}/g, '...');
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s;
}

function createWavBlob(floatArr: Float32Array, sampleRate: number): Blob {
  const pcm16 = new Int16Array(floatArr.length);
  for (let i = 0; i < floatArr.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, floatArr[i]));
    pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  const buffer = new ArrayBuffer(44 + pcm16.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, text: string) => {
    for (let j = 0; j < text.length; j += 1) view.setUint8(offset + j, text.charCodeAt(j));
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

async function loadModel(modelId: string): Promise<void> {
  const runtime = runtimeSelectEl?.value ?? 'auto';
  const wasmThreads =
    typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated && !isCoarseMobileUa()
      ? 4
      : 1;

  updateStatus(`Loading KittenTTS (${modelId.split('/').pop()})…`);
  ttsLoaded = false;
  syncPresentButtonEnabled();
  syncPlaybackUI();

  try {
    const initInfo = (await postToWorker('init', {
      modelId,
      runtime,
      wasmThreads,
      wasmSimd: true,
    })) as {
      runtimeActual?: string;
      runtimeRequested?: string;
      executionProviders?: string[];
    };
    ttsLoaded = true;
    ttsLoadFailed = false;
    const actual = String(initInfo?.runtimeActual || runtime).toUpperCase();
    const providers = Array.isArray(initInfo?.executionProviders)
      ? initInfo.executionProviders.join(', ')
      : 'n/a';
    const actualLabel = actual === 'CPU' ? 'CPU (WASM)' : actual === 'GPU' ? 'GPU (WebGPU)' : actual;
    if (ttsChipEl) ttsChipEl.textContent = String(initInfo?.runtimeActual || initInfo?.runtimeRequested || 'ready');
    updateStatus(`Ready — ${actualLabel} · ${providers}`, 'success');
  } catch (e) {
    ttsLoadFailed = true;
    const err = e instanceof Error ? e : new Error(String(e));
    updateStatus(`TTS unavailable — using pre-recorded audio. ${err.message}`, 'warning');
  } finally {
    syncPresentButtonEnabled();
    syncPlaybackUI();
  }
}

async function ensureTtsReady(): Promise<void> {
  if (ttsLoaded) return;
  const modelId = modelSelectEl?.value;
  if (!modelId) throw new Error('No model selected');
  await loadModel(modelId);
}

function bumpSlideSpeechEpoch(): void {
  slideSpeechEpoch += 1;
  stopSpeech();
}

function stopSpeech(): void {
  const a = activeNarrationAudio;
  const u = activeNarrationUrl;
  activeNarrationAudio = null;
  activeNarrationUrl = null;
  narrationInFlight = false;
  playbackState = 'idle';
  if (a) {
    try {
      a.pause();
      a.currentTime = 0;
    } catch {
      /* ignore */
    }
  }
  if (u) {
    try {
      URL.revokeObjectURL(u);
    } catch {
      /* ignore */
    }
  }
  if (ttsChipEl) ttsChipEl.textContent = 'idle';
  syncPlaybackUI();
}

function isCurrentSlideCached(): boolean {
  const voice = voiceSelectEl?.value ?? 'Jasper';
  const speed = getSpeechSpeed();
  return audioCache.has(audioCacheKey(currentSlideIndex, voice, speed));
}

function syncVoiceBadge(): void {
  if (!voiceBadgeEl) return;
  const voice = voiceSelectEl?.value ?? 'Jasper';

  if (playbackState === 'idle') {
    const cached = isCurrentSlideCached();
    voiceBadgeEl.hidden = false;
    if (cached) {
      voiceBadgeEl.setAttribute('data-state', 'ready');
      voiceBadgeEl.innerHTML = `<span class="voice-badge-dot"></span>Audio ready · ${ttsLoaded ? voice : 'pre-recorded'}`;
    } else if (!ttsLoaded) {
      voiceBadgeEl.setAttribute('data-state', 'pending');
      voiceBadgeEl.innerHTML = `<span class="voice-badge-dot"></span>Pre-recorded fallback`;
    } else {
      voiceBadgeEl.setAttribute('data-state', 'pending');
      voiceBadgeEl.innerHTML = `<span class="voice-badge-dot"></span>Not generated`;
    }
    return;
  }

  voiceBadgeEl.hidden = false;
  voiceBadgeEl.setAttribute('data-state', playbackState);
  const labels: Record<PlaybackState, string> = {
    idle: '',
    synthesizing: 'Generating…',
    playing: 'Speaking',
    paused: 'Paused',
  };
  voiceBadgeEl.innerHTML =
    `<span class="voice-badge-dot"></span>${labels[playbackState]} · ${voice}`;
}

function syncPlaybackUI(): void {
  const idle = playbackState === 'idle';
  const synth = playbackState === 'synthesizing';
  const playing = playbackState === 'playing';
  const paused = playbackState === 'paused';

  if (startBtn instanceof HTMLButtonElement) {
    startBtn.disabled = synth || playing;
    startBtn.textContent = paused ? '▶ Resume' : '▶ Start';
  }
  if (pauseBtn instanceof HTMLButtonElement) {
    pauseBtn.disabled = !playing;
  }
  if (stopBtn instanceof HTMLButtonElement) {
    stopBtn.disabled = idle;
  }

  if (toolbarSetupEl) {
    toolbarSetupEl.classList.toggle('config-locked', !idle);
  }
  syncVoiceBadge();
}


async function fetchPrerecordedAudio(slideIdx: number): Promise<Blob | null> {
  try {
    const resp = await fetch(`./audio/slide-${slideIdx}.wav`);
    if (!resp.ok) return null;
    return await resp.blob();
  } catch {
    return null;
  }
}

/**
 * Synthesize (or fetch from cache) the WAV blob for a given slide index + voice + speed.
 * Falls back to pre-recorded audio in docs/audio/ if TTS is unavailable.
 */
async function synthesizeSlide(
  slideIdx: number,
  voice: string,
  speed: number,
): Promise<Blob> {
  const key = audioCacheKey(slideIdx, voice, speed);
  const cached = audioCache.get(key);
  if (cached) return cached;

  if (ttsLoaded) {
    const meta = getSlideMeta(slideIdx);
    const slide: ActiveSlide = {
      ...deck[slideIdx],
      kicker: meta.section,
      duration: meta.duration,
      takeaway: meta.takeaway,
      artifacts: meta.artifacts,
      audienceQuestion: meta.audienceQuestion,
    };
    const text = ttsPreprocess(buildNarrationText(slide));
    const result = (await postToWorker('generate', { text, voice, speed })) as {
      floatArr: Float32Array;
      sampleRate: number;
    };
    const blob = createWavBlob(result.floatArr, result.sampleRate);
    audioCache.set(key, blob);
    return blob;
  }

  const prerecorded = await fetchPrerecordedAudio(slideIdx);
  if (prerecorded) {
    audioCache.set(key, prerecorded);
    return prerecorded;
  }

  throw new Error('TTS not loaded and no pre-recorded audio available.');
}

/** Fire-and-forget: pre-generate the next slide audio while the current one plays. */
function prefetchNextSlide(voice: string, speed: number): void {
  const next = currentSlideIndex + 1;
  if (next >= deck.length) return;
  const key = audioCacheKey(next, voice, speed);
  if (audioCache.has(key)) return;
  void synthesizeSlide(next, voice, speed).catch(() => {
    /* best-effort; will be generated on navigate if this fails */
  });
}

/**
 * Speak the current slide. Uses cached audio when available; otherwise synthesizes and caches.
 * When a slide finishes and `autoAdvanceActive` is true, advances to the next slide automatically.
 */
async function speakCurrentSlide(): Promise<void> {
  const epoch = slideSpeechEpoch;
  const slideIdx = currentSlideIndex;
  const slide = getActiveSlide();
  const text = buildNarrationText(slide);
  if (!text.trim()) {
    updateStatus('Nothing to read on this slide.', 'warning');
    return;
  }
  const voice = voiceSelectEl?.value ?? 'Jasper';
  const speed = getSpeechSpeed();

  const key = audioCacheKey(slideIdx, voice, speed);
  const isCached = audioCache.has(key);

  narrationInFlight = true;
  playbackState = 'synthesizing';
  syncPlaybackUI();
  updateStatus(isCached ? 'Loading cached audio…' : ttsLoaded ? 'Synthesizing speech…' : 'Loading pre-recorded audio…');

  try {
    if (!ttsLoaded && !isPrerecordedMode() && !ttsLoadFailed) {
      await loadModel(modelSelectEl?.value ?? 'onnx-community/KittenTTS-Nano-v0.8-ONNX').catch(() => {});
    }
    if (epoch !== slideSpeechEpoch) return;

    const blob = await synthesizeSlide(slideIdx, voice, speed);
    if (epoch !== slideSpeechEpoch) return;

    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    if ('playsInline' in audio) (audio as HTMLAudioElement & { playsInline: boolean }).playsInline = true;
    audio.volume = 1;

    if (epoch !== slideSpeechEpoch) {
      try { URL.revokeObjectURL(url); } catch { /* ignore */ }
      return;
    }

    activeNarrationAudio = audio;
    activeNarrationUrl = url;
    narrationInFlight = false;
    playbackState = 'playing';
    syncPlaybackUI();
    if (ttsChipEl) ttsChipEl.textContent = `speaking · ${voice}`;

    audio.addEventListener(
      'ended',
      () => {
        if (activeNarrationAudio === audio) {
          activeNarrationAudio = null;
          activeNarrationUrl = null;
        }
        try { URL.revokeObjectURL(url); } catch { /* ignore */ }
        if (ttsChipEl) ttsChipEl.textContent = 'idle';

        if (autoAdvanceActive && epoch === slideSpeechEpoch && slideIdx + 1 < deck.length) {
          currentSlideIndex = slideIdx + 1;
          renderSlide();
          void speakCurrentSlide();
        } else {
          playbackState = 'idle';
          autoAdvanceActive = false;
          if (slideIdx + 1 >= deck.length) {
            updateStatus('Presentation complete.', 'success');
          }
        }
        syncPlaybackUI();
      },
      { once: true },
    );

    prefetchNextSlide(voice, speed);

    try {
      await audio.play();
    } catch (playErr) {
      const blocked = playErr instanceof DOMException && playErr.name === 'NotAllowedError';
      updateStatus(
        blocked
          ? 'Playback blocked — click Present or Replay slide once so the browser allows audio.'
          : `Could not play: ${playErr instanceof Error ? playErr.message : String(playErr)}`,
        'warning',
      );
      stopSpeech();
      return;
    }

    if (epoch !== slideSpeechEpoch) {
      stopSpeech();
      return;
    }

    const dur = (blob.size / 2 / 24000).toFixed(1);
    updateStatus(
      `${isCached ? 'Cached' : 'Playing'} — ~${dur}s · ${voice} · ${speed.toFixed(2)}×`,
      'success',
    );
  } catch (e) {
    if (epoch !== slideSpeechEpoch) return;
    const err = e instanceof Error ? e : new Error(String(e));
    updateStatus(`TTS error: ${err.message}`, 'error');
    playbackState = 'idle';
    autoAdvanceActive = false;
  } finally {
    if (epoch === slideSpeechEpoch) {
      narrationInFlight = false;
    }
    syncPlaybackUI();
  }
}

function navigateToSlide(nextIndex: number): void {
  if (nextIndex < 0 || nextIndex >= deck.length || nextIndex === currentSlideIndex) return;
  const wasActive = playbackState !== 'idle';
  bumpSlideSpeechEpoch();
  currentSlideIndex = nextIndex;
  renderSlide();
  if (wasActive) {
    autoAdvanceActive = true;
    void speakCurrentSlide();
  }
}

function clearSlideDiagram(): void {
  if (!slideDiagramEl) return;
  slideDiagramEl.innerHTML = '';
  slideDiagramEl.hidden = true;
}

function ensureMermaidConfigured(): boolean {
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

async function renderMermaidIntoSlideHost(definition: string, title: string, gen: number): Promise<void> {
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
    const rendered = await globalThis.mermaid!.render(id, def);
    if (gen !== slideDiagramGen) return;
    out.innerHTML = rendered.svg;
    if (typeof rendered.bindFunctions === 'function') rendered.bindFunctions(out);
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

async function renderSlideDiagramPreset(
  key: keyof typeof DIAGRAM_PRESETS,
  gen: number,
): Promise<void> {
  const preset = DIAGRAM_PRESETS[key];
  if (!preset) return;
  await renderMermaidIntoSlideHost(preset.definition, preset.title, gen);
}

function clearToolEffects(): void {
  document.querySelectorAll('.tool-highlight').forEach((el) => {
    el.outerHTML = el.textContent ?? '';
  });
  document.querySelectorAll('.tool-emphasize').forEach((el) => {
    el.classList.remove('tool-emphasize', 'fade-out');
  });
  const overlay = document.getElementById('stage-overlay');
  if (overlay) {
    overlay.classList.remove('visible');
    overlay.textContent = '';
  }
}

function renderSlide(): void {
  clearToolEffects();
  const slide = getActiveSlide();
  const kickerText = typeof slide.kicker === 'string' ? slide.kicker.trim() : '';
  if (slideKickerEl) {
    slideKickerEl.textContent = kickerText;
    const kickerWrap = slideKickerEl.parentElement;
    const hideKicker = !kickerText;
    slideKickerEl.hidden = hideKicker;
    if (kickerWrap instanceof HTMLElement) kickerWrap.hidden = hideKicker;
    const stageMetaEl = slideKickerEl.closest('.stage-meta');
    if (stageMetaEl instanceof HTMLElement) stageMetaEl.hidden = hideKicker;
  }
  if (slideTitleEl) slideTitleEl.textContent = slide.title;
  if (slideLedeEl) slideLedeEl.textContent = slide.lede;
  if (slideBulletsEl) {
    slideBulletsEl.innerHTML = '';
    const bulletList: unknown[] = Array.isArray(slide.bullets) ? slide.bullets : [];
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
      if (bullet && typeof bullet === 'object' && 'text' in bullet && typeof (bullet as { text: unknown }).text === 'string') {
        const b = bullet as { text: string; sub?: string[] };
        const head = document.createElement('span');
        head.className = 'bullet-head';
        head.textContent = b.text;
        item.appendChild(head);
        const subs = Array.isArray(b.sub) ? b.sub : [];
        if (subs.length) {
          const subUl = document.createElement('ul');
          subUl.className = 'bullets bullets-sub';
          subs.forEach((line: string) => {
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
      }
    });
    slideBulletsEl.hidden = bulletList.length === 0;
  }

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

  if (slideNotesBodyEl) {
    const script = (slide as { presenterScript?: string }).presenterScript;
    slideNotesBodyEl.textContent = script || slide.notes || '—';
  }
  if (presenterMetaLineEl) {
    const bits = [slide.kicker, slide.duration].filter(Boolean);
    if (slide.takeaway) bits.push(slide.takeaway);
    presenterMetaLineEl.textContent = bits.join(' · ') || '';
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
  if (prevSlideBtn instanceof HTMLButtonElement) prevSlideBtn.disabled = currentSlideIndex <= 0;
  if (nextSlideBtn instanceof HTMLButtonElement) nextSlideBtn.disabled = currentSlideIndex >= deck.length - 1;
  syncVoiceBadge();
}

function syncPresentButtonEnabled(): void {
  if (!(presentSlidesBtn instanceof HTMLButtonElement)) return;
  presentSlidesBtn.disabled = false;
  presentSlidesBtn.removeAttribute('title');
}

function reloadModelFromCurrentSelection(): void {
  updateRuntimeUi();
  audioCache.clear();
  ttsLoadFailed = false;
  const modelId = modelSelectEl?.value;
  if (!modelId) return;
  void loadModel(modelId).catch(() => {
    /* status already set */
  });
}

// --- Wire UI ---
speedRangeEl?.addEventListener('input', () => {
  if (playbackState !== 'idle') return;
  if (speedValEl && speedRangeEl) {
    speedValEl.textContent = `${parseFloat(speedRangeEl.value).toFixed(2)}×`;
  }
});

modelSelectEl?.addEventListener('change', () => {
  if (playbackState !== 'idle') return;
  reloadModelFromCurrentSelection();
});

runtimeSelectEl?.addEventListener('change', () => {
  if (playbackState !== 'idle') return;
  updateRuntimeUi();
  audioCache.clear();
  if (isPrerecordedMode()) {
    ttsLoaded = false;
    updateStatus('Pre-recorded mode — no model download.', 'warning');
    syncPlaybackUI();
  } else {
    reloadModelFromCurrentSelection();
  }
});

startBtn?.addEventListener('click', () => {
  if (playbackState === 'paused' && activeNarrationAudio) {
    playbackState = 'playing';
    syncPlaybackUI();
    void activeNarrationAudio.play();
    updateStatus('Resumed.', 'success');
    return;
  }
  autoAdvanceActive = true;
  bumpSlideSpeechEpoch();
  void speakCurrentSlide();
});

pauseBtn?.addEventListener('click', () => {
  if (playbackState !== 'playing' || !activeNarrationAudio) return;
  activeNarrationAudio.pause();
  playbackState = 'paused';
  syncPlaybackUI();
  updateStatus('Paused.', 'success');
});

stopBtn?.addEventListener('click', () => {
  autoAdvanceActive = false;
  bumpSlideSpeechEpoch();
  updateStatus('Stopped.', 'success');
});

prevSlideBtn?.addEventListener('click', () => {
  navigateToSlide(currentSlideIndex - 1);
});

nextSlideBtn?.addEventListener('click', () => {
  navigateToSlide(currentSlideIndex + 1);
});

function getFullscreenElement(): Element | null {
  return document.fullscreenElement
    ?? (document as any).webkitFullscreenElement
    ?? null;
}

function requestFS(el: HTMLElement): Promise<void> {
  if (el.requestFullscreen) return el.requestFullscreen();
  if ((el as any).webkitRequestFullscreen) return (el as any).webkitRequestFullscreen();
  return Promise.reject(new Error('Fullscreen API not supported'));
}

function exitFS(): Promise<void> {
  if (document.exitFullscreen) return document.exitFullscreen();
  if ((document as any).webkitExitFullscreen) return (document as any).webkitExitFullscreen();
  return Promise.reject(new Error('Fullscreen API not supported'));
}

presentSlidesBtn?.addEventListener('click', () => {
  if (getFullscreenElement()) {
    void exitFS().then(() => {
      if (presentSlidesBtn instanceof HTMLButtonElement) presentSlidesBtn.textContent = 'Present';
    });
    return;
  }
  if (stageCardEl) {
    void requestFS(stageCardEl).catch((error: unknown) => {
      updateStatus(`Fullscreen failed: ${error instanceof Error ? error.message : String(error)}`, 'warning');
    });
  }
});

const fsChangeEvent = 'fullscreenchange' in document ? 'fullscreenchange' : 'webkitfullscreenchange';
document.addEventListener(fsChangeEvent, () => {
  const el = getFullscreenElement();
  const presentingStage = el === stageCardEl;
  stageCardEl?.classList.toggle('is-fullscreen', !!el);
  if (presentSlidesBtn instanceof HTMLButtonElement) {
    presentSlidesBtn.textContent = el ? 'Exit presentation' : 'Present';
  }
  syncPresentButtonEnabled();
  if (presentingStage) {
    try {
      stageCardEl?.focus({ preventScroll: true });
    } catch {
      /* ignore */
    }
    if (playbackState === 'idle' && ttsLoaded) {
      autoAdvanceActive = true;
      bumpSlideSpeechEpoch();
      void speakCurrentSlide();
    }
  } else if (stageWasFullscreen) {
    autoAdvanceActive = false;
    bumpSlideSpeechEpoch();
    updateStatus('Exited presentation.', 'success');
  }
  stageWasFullscreen = presentingStage;
});

document.addEventListener('keydown', (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
  if (e.key === 'ArrowLeft') {
    navigateToSlide(currentSlideIndex - 1);
  } else if (e.key === 'ArrowRight') {
    navigateToSlide(currentSlideIndex + 1);
  }
});

// --- Swipe navigation for touch devices ---
if (stageCardEl) {
  let touchStartX = 0;
  let touchStartY = 0;
  const SWIPE_THRESHOLD = 50;

  stageCardEl.addEventListener('touchstart', (e) => {
    const touch = (e as TouchEvent).touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  }, { passive: true });

  stageCardEl.addEventListener('touchend', (e) => {
    const touch = (e as TouchEvent).changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dy) > Math.abs(dx)) return;
    if (dx < 0) {
      navigateToSlide(currentSlideIndex + 1);
    } else {
      navigateToSlide(currentSlideIndex - 1);
    }
  }, { passive: true });
}

if (toolbarSetupEl instanceof HTMLDetailsElement) {
  document.addEventListener('click', (e) => {
    if (!toolbarSetupEl.open) return;
    if (!toolbarSetupEl.contains(e.target as Node)) {
      toolbarSetupEl.open = false;
    }
  });
}

// --- Boot ---
renderSlide();
syncPlaybackUI();

updateRuntimeUi();
if (speedValEl && speedRangeEl) {
  speedValEl.textContent = `${parseFloat(speedRangeEl.value).toFixed(2)}×`;
}

const wantsLive = new URLSearchParams(location.search).has('live');
if (wantsLive && webgpuAvailable()) {
  if (runtimeSelectEl) runtimeSelectEl.value = 'gpu';
  if (modelSelectEl) modelSelectEl.value = 'onnx-community/KittenTTS-Nano-v0.8-ONNX';
} else if (wantsLive) {
  if (runtimeSelectEl) runtimeSelectEl.value = 'auto';
} else {
  if (runtimeSelectEl) runtimeSelectEl.value = 'prerecorded';
}
updateRuntimeUi();

if (isPrerecordedMode()) {
  updateStatus('Pre-recorded mode — no model download.', 'warning');
} else {
  const initialModel = modelSelectEl?.value ?? 'onnx-community/KittenTTS-Nano-v0.8-ONNX';
  void loadModel(initialModel).catch(() => {
    /* surfaced in status */
  });
}

window.__kittenSlidesLabReady = true;
