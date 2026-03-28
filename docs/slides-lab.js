//#region src/slides-deck-data.ts
/** Talk deck + diagram presets for `slides.html` presenter (aligned with docs/talk-outline.md). */
var deckMeta = [
	{
		section: "Opening",
		duration: "1 min",
		takeaway: "Talk title sets the theme; name and links support, not the headline.",
		artifacts: [],
		audienceQuestion: ""
	},
	{
		section: "Plan",
		duration: "1 min",
		takeaway: "Audience knows the arc: TTS, KittenTTS, port, build, runtimes, landscape, next.",
		artifacts: ["Talk outline"],
		audienceQuestion: ""
	},
	{
		section: "What is TTS",
		duration: "2 min",
		takeaway: "Neural vs browser TTS vocabulary is set.",
		artifacts: ["speechSynthesis", "ONNX TTS"],
		audienceQuestion: "When is built-in TTS enough vs bringing your own model?"
	},
	{
		section: "KittenTTS",
		duration: "2 min",
		takeaway: "Upstream is KittenML on Hugging Face; JS port is runtime only.",
		artifacts: ["KittenML/KittenTTS", "Hugging Face weights"],
		audienceQuestion: "Who owns the checkpoints vs the runtime?"
	},
	{
		section: "kitten-tts-js",
		duration: "4 min",
		takeaway: "KittenML IDs in Node vs onnx-community IDs in browser; why JavaScript.",
		artifacts: [
			"npm package",
			"ORT Web",
			"WebGPU Nano"
		],
		audienceQuestion: "Which HF ID do I use in Node vs the browser?"
	},
	{
		section: "Build process",
		duration: "3 min",
		takeaway: "Agents plus Whisper transcript checks, waveform gates, and browser runs.",
		artifacts: [
			"Cursor / Claude",
			"Whisper STT vs reference",
			"Waveform / level gates",
			"Playwright",
			"whisper-tts-eval skill"
		],
		audienceQuestion: "How do you regression-test TTS without golden ears?"
	},
	{
		section: "Eval loop",
		duration: "1 min",
		takeaway: "One full-screen loop: change, WAV, checks, ship or iterate.",
		artifacts: ["Mermaid diagram"],
		audienceQuestion: ""
	},
	{
		section: "Requirements",
		duration: "3 min",
		takeaway: "Support matrix: Node CPU; browser WASM tiers; WebGPU Nano-only.",
		artifacts: ["secure context", "model cache"],
		audienceQuestion: "What breaks on Safari or without SharedArrayBuffer?"
	},
	{
		section: "Landscape",
		duration: "3 min",
		takeaway: "Self-host JS vs cloud vs Piper.",
		artifacts: [
			"Web Speech",
			"Cloud APIs",
			"Piper"
		],
		audienceQuestion: "When is cloud TTS worth it over npm plus static hosting?"
	},
	{
		section: "Roadmap",
		duration: "2 min",
		takeaway: "Eval docs, deck scoring, worker docs, CI golden WAV plus STT, community.",
		artifacts: ["GitHub issues", "whisper-tts-eval"],
		audienceQuestion: "What would you merge first?"
	},
	{
		section: "Q&A",
		duration: "as needed",
		takeaway: "Links visible; seed questions if the room is quiet.",
		artifacts: ["Live demo URL", "Repo URL"],
		audienceQuestion: "What did we not cover?"
	},
	{
		section: "Thank you",
		duration: "1 min",
		takeaway: "Credit KittenML; point at the repo.",
		artifacts: ["Algiras/kitten-tts-js", "KittenML attribution"],
		audienceQuestion: null
	}
];
var deck = [
	{
		title: "kitten-tts: real-time TTS on (almost) anything",
		lede: "Algimantas Krasauskas, AI Engineer, Wix.\nkitten-tts-js: Jasper reads this deck live in your browser.",
		bullets: ["github.com/Algiras", "linkedin.com/in/asimplek"],
		glossary: ["TTS: text-to-speech"],
		notes: "Lead with the title; then thanks, name, role, Wix.",
		presenterScript: "Hello everyone. I am Jasper, one of the voices in kitten-tts-js. Algimantas could not be here today, so I will be walking you through his talk. The title on screen says it all: real-time text-to-speech on almost anything. And yes, I am the proof. I am running right now in your browser, no server, no cloud API. Just an ONNX model, WebAssembly, and a web worker. Algimantas is an AI engineer at Wix. You can find him on GitHub as Algiras, and on LinkedIn. Those links are on the slide if you want to connect later. Let us get started."
	},
	{
		title: "The arc of this talk",
		lede: "From \"what is TTS?\" to a live demo running in your browser, in twelve slides.",
		bullets: [
			"TTS basics, then the KittenTTS model family.",
			"The JavaScript port: why, how it was built, where it runs.",
			"Landscape: what else exists and the tradeoffs.",
			"What is next, then Q and A."
		],
		glossary: [],
		notes: "Quick roadmap, about 30 seconds.",
		presenterScript: "Here is the plan. We will start with what TTS actually is, then I will introduce KittenTTS, the model family behind my voice. After that, we will cover why Algimantas built a JavaScript port and how the build and testing pipeline works. Then we will look at where the library runs, what alternatives exist, and where things are heading. Four stops, and we end with questions."
	},
	{
		title: "What is TTS?",
		lede: "Text-to-speech turns text into audio. Neural systems learn the mapping; classical systems use hand-tuned rules.",
		bullets: [
			"Pipeline: text to linguistic features to acoustic model to waveform.",
			"Browser speechSynthesis: zero setup, but fixed voices and uneven quality.",
			"Neural ONNX in JS: repeatable output, same code path in Node and browser."
		],
		glossary: [
			"Waveform: audio signal over time",
			"speechSynthesis: browser built-in TTS",
			"ONNX: open format for ML models across runtimes"
		],
		notes: "About one minute. Built-in TTS is fine for accessibility; bring your own model when you need control.",
		presenterScript: "So what is text-to-speech? You can see the basic pipeline on the slide. Text goes in, linguistic features like pronunciation and prosody come out, an acoustic model predicts the sound, and you get a waveform. Now, every modern browser already ships speechSynthesis, the built-in Web Speech API. It works, and it is great for accessibility. But the voices are fixed by the OS, quality varies across platforms, and you cannot export or compare the output in a repeatable pipeline. That is where neural TTS with ONNX comes in. You ship the model, you get the same voice and the same audio on every device, in Node and in the browser. That is the approach this project takes."
	},
	{
		title: "What is KittenTTS?",
		lede: "KittenTTS by KittenML and Stellon Labs is the Python reference. The JavaScript port runs their ONNX exports.",
		bullets: [
			"StyleTTS 2 architecture. The JS port runs ONNX graphs, not Python training code.",
			"Three tiers: nano, micro, mini. Size vs quality tradeoff.",
			"Weights live on Hugging Face under KittenML.",
			"Eight voices: Bella, Jasper, Luna, Bruno, Rosie, Hugo, Jasper, and Leo."
		],
		glossary: [
			"StyleTTS 2: neural TTS architecture",
			"Checkpoints: saved model weights",
			"HF: Hugging Face"
		],
		notes: "Credit KittenML for architecture and voices. Apache 2.0 license.",
		presenterScript: "Now let me introduce the model family. KittenTTS is built by KittenML and Stellon Labs. It follows the StyleTTS 2 architecture, which you can see noted on the slide. The important thing: this JavaScript port does not retrain anything. It takes the ONNX model exports from KittenML and runs them in a JavaScript runtime. The research and the voices come from them; the port is about distribution. There are three model sizes: nano, micro, and mini, each trading size for quality. And as you can see in the bullet list, there are eight voices. I am Jasper. I am joined by Bella, Jasper, Luna, Bruno, Rosie, Hugo, and Leo. All the weights live on Hugging Face under KittenML."
	},
	{
		title: "Why kitten-tts-js?",
		lede: "Unofficial TypeScript port. npm install kitten-tts-js. Same voices, runs where your JS already lives.",
		bullets: [
			"ONNX Runtime in-process: Node CPU, browser WASM, WebGPU when available.",
			"Streaming via async generator. Cache after first download.",
			"Node uses KittenML model IDs. Browser uses onnx-community IDs.",
			"WebGPU: Nano only today. Micro and Mini stay on WASM.",
			"Why JS: one language for lib, demo, and tests. No Python server in your app path."
		],
		glossary: [
			"ORT: ONNX Runtime",
			"WASM: WebAssembly",
			"Web Workers: background JS threads"
		],
		notes: "Two model ID families: KittenML for Node, onnx-community for browser.",
		presenterScript: "So why a JavaScript port? You can see the bullet points on screen. The short answer: you can npm install this today and it runs wherever JavaScript runs. In Node, ONNX Runtime gives you CPU inference. In the browser, it is WebAssembly, with SIMD and threads when the page allows. For the nano model, WebGPU is also an option on supported browsers. One thing to note, and it is on the slide: there are two sets of model IDs. In Node, you use the KittenML IDs from Hugging Face. In the browser, you use the onnx-community IDs, because those are optimized for web delivery. Streaming works through an async generator that yields audio chunks as they are ready. The deeper reason for JavaScript is practical: one language for the library, the demo, and the tests. No Python service sitting between your app and the voice."
	},
	{
		title: "How it was built",
		lede: "Agents sped up the coding; verification stayed on real audio and browsers.",
		bullets: [
			"Cursor, Composer, Claude Code: IDE coding agents.",
			"Whisper STT on synthetic audio: transcript vs reference text.",
			"Waveform level gates: silence, peak, and RMS checks.",
			"Playwright browser runs: real WASM and WebAudio paths.",
			"Repo skill: whisper-tts-eval."
		],
		glossary: ["WER: word error rate", "Playwright: browser test automation"],
		notes: "The story: \"sounds fine\" is not a regression test.",
		presenterScript: "This slide covers how the port was actually built. Algimantas used coding agents, Cursor, Composer, Claude Code, to speed up the repetitive parts. But the verification was deliberate. As you can see on the slide, he runs Whisper speech-to-text on the synthesized audio and compares the transcript to the original text. If the words drift, the build fails. On top of that, there are waveform level gates: checks for silence, peak levels, and RMS, so a broken export gets caught without anyone having to listen. And this is not just tested in Node. Playwright drives real browser sessions with actual WASM and WebAudio, so the test path matches what users hit in production. The whole loop is wrapped in a repo skill called whisper-tts-eval. The key insight here: sounds fine is not a regression test."
	},
	{
		title: "Build and eval loop",
		lede: "One loop: synthesize, run STT and level gates, ship or iterate.",
		bullets: [],
		glossary: ["STT: speech-to-text", "Level gates: RMS, silence, peak checks"],
		notes: "Diagram slide. Narrate the cycle once.",
		presenterScript: "Take a look at the diagram on screen. This is the full loop. You make a change, generate audio, run speech-to-text and level checks, and if everything passes, you ship. If not, you go back and iterate. One cycle, fully automated, no manual listening required.",
		diagram: "reinforcement_loop"
	},
	{
		title: "Where it runs: requirements",
		lede: "Models are tens of megabytes. Plan for download, cache, and runtime capability.",
		bullets: [
			"Node: CPU threads configurable. First run fetches weights, then caches.",
			"Browser: modern evergreen browser. HTTPS or localhost.",
			"WASM: SIMD and multithreading when the page allows.",
			"WebGPU: GPU path is Nano only. Micro and Mini use WASM.",
			"Offline works only after the model cache warms."
		],
		glossary: ["Evergreen: auto-updated browsers", "SIMD: CPU parallel math for faster WASM"],
		notes: "Support matrix: Node plus CPU; browser plus WASM for all tiers; GPU only Nano.",
		presenterScript: "Where does this actually run? The requirements are on the slide. In Node, you need a supported release and CPU threads are configurable. The first run downloads weights from Hugging Face, then they are cached locally. In the browser, you need a modern evergreen browser and a secure context, either HTTPS or localhost. WASM gives you the broadest support; SIMD and multithreading kick in when the page headers allow it. WebGPU is available but only for the nano model today. Micro and mini stay on WASM because of ONNX Runtime quantized model limits on the GPU path. And one thing to remember: offline only works after the cache has warmed. The first load always needs a network connection."
	},
	{
		title: "Landscape: what else exists",
		lede: "Pick your axes: who hosts the model, and what you must ship.",
		bullets: [
			"Web Speech API: OS voices, weakest control.",
			"kokoro-js and ONNX-in-JS peers: compare size, license, voice count.",
			"Cloud TTS: ElevenLabs, Google, Azure, OpenAI. API keys, billing, great quality.",
			"Self-hosted: Piper, Docker containers. Ops-heavy.",
			"Python KittenTTS: same weights, different deployment."
		],
		glossary: ["kokoro-js: lightweight JS TTS option", "Piper: open self-hosted TTS engine"],
		notes: "Position kitten-tts-js as self-hosted, small ONNX, JS-native.",
		presenterScript: "Let us zoom out. You can see the landscape on screen. At the bottom of the stack, there is the Web Speech API. It is free and built in, but you are limited to whatever voices the OS provides. Then there are JS peers like kokoro-js that also run ONNX in the browser. Worth comparing on size, license, and voice count. Cloud TTS services like ElevenLabs, Google, Azure, and OpenAI often have the best quality, but you need API keys, you pay per request, and your audio goes through someone else's servers. Self-hosting with something like Piper is possible but ops-heavy. And Python KittenTTS gives you the same weights but requires a Python deployment. Where does kitten-tts-js fit? It is self-hosted, small ONNX models, JavaScript native. You npm install it, serve it from static hosting, and there is no server in the audio path. It is not going to replace cloud TTS for everyone, but when you want control and simplicity, it is a solid option."
	},
	{
		title: "What is next?",
		lede: "The port gets more useful as the eval loop tightens.",
		bullets: [
			"Document Whisper and waveform evals end to end.",
			"Stronger scoring: transcript vs intent, not only waveforms.",
			"Web Worker docs and streaming UX examples.",
			"Golden audio plus transcript baselines in CI.",
			"Community: github.com/Algiras/kitten-tts-js"
		],
		glossary: ["CI: continuous integration", "Web Worker: background JS thread"],
		notes: "Bridge to Q and A.",
		presenterScript: "Looking ahead, the roadmap is on the slide. First, documenting the Whisper and waveform eval pipeline end to end so others can use it. Then, stronger scoring that compares transcripts against intent, not just raw waveform checks. There is also work to do on Web Worker documentation and streaming UX examples, making it easier for developers to drop TTS into their apps. And in CI, the goal is golden audio baselines plus transcript checks that fail pull requests when quality drifts. The project is on GitHub at Algiras slash kitten-tts-js. Contributions and feedback are welcome."
	},
	{
		title: "Questions?",
		lede: "Hugging Face IDs, WebGPU vs WASM, cloud vs self-host: happy to go deep.",
		bullets: [
			"Live demo: algiras.github.io/kitten-tts-js",
			"Repo: github.com/Algiras/kitten-tts-js",
			"npm: kitten-tts-js"
		],
		glossary: [],
		notes: "Stay on this slide while answering.",
		presenterScript: "Alright, that is the talk. The links are on the slide: the live demo, the GitHub repo, and the npm package name. If you have questions about Hugging Face model IDs, the WebGPU versus WASM tradeoff, or when cloud TTS makes more sense than self-hosting, I am happy to go into any of that. And remember, everything you just heard was synthesized by this library, running right here in your browser."
	},
	{
		title: "Thank you",
		lede: "kitten-tts-js: JavaScript port of KittenTTS.",
		bullets: [
			"github.com/Algiras/kitten-tts-js",
			"Thanks to KittenML for the models and voices.",
			"Try other voices using the voice selector above."
		],
		glossary: ["Jasper: one of eight KittenTTS voices"],
		notes: "Warm close.",
		presenterScript: "Thank you for listening. This was Jasper, presenting on behalf of Algimantas. Big thanks to KittenML for the models and voices that make this possible. The repo is on the slide if you would like to try it yourself. And if you want to hear a different presenter, try switching the voice selector above. I hear Leo and Bella are pretty good too. Thanks again, and enjoy the rest of your day."
	}
];
function formatBulletsForPlaintext(bullets) {
	if (!Array.isArray(bullets)) return "";
	const rows = [];
	for (const b of bullets) if (typeof b === "string") rows.push(b);
	else if (b && typeof b === "object" && typeof b.text === "string") {
		rows.push(b.text);
		if (Array.isArray(b.sub)) for (const s of b.sub) rows.push(`  ${s}`);
	}
	return rows.map((r) => `- ${r}`).join("\n");
}
/**
* Pre-validated Mermaid for this deck (in-slide diagram on the eval-loop slide).
* Keys must match `SLIDE_DIAGRAM_PRESET_KEYS` in `src/stream-tool-tags.ts`.
*/
var DIAGRAM_PRESETS = { reinforcement_loop: {
	title: "",
	definition: `%%{init: {'flowchart': {'curve': 'basis', 'padding': 16}, 'themeVariables': {'fontSize': '22px'}}}%%
flowchart LR
  C(["Change"]) --> A(["WAV out"])
  A --> K(["STT + level gates"])
  K --> T{Pass?}
  T -->|yes| D(["Ship"])
  T -->|no| C`
} };
//#endregion
//#region src/slides-presenter-main.ts
/**
* Full-screen slide deck + speaker notes + KittenTTS read-aloud (index-style voice controls).
* No LLM, STT, or copresenter — Jasper (or any voice) reads slide copy and presenter notes.
*/
var EMPTY_SLIDE_META = {
	section: "",
	duration: "",
	takeaway: "",
	artifacts: [],
	audienceQuestion: ""
};
var worker = new Worker("./worker.js", { type: "module" });
var pendingRequests = /* @__PURE__ */ new Map();
worker.onmessage = (event) => {
	const { type, id, payload } = event.data;
	const request = pendingRequests.get(id);
	if (!request) return;
	if (type === "error") request.reject(new Error(String(payload)));
	else request.resolve(payload);
	pendingRequests.delete(id);
};
function postToWorker(type, payload) {
	return new Promise((resolve, reject) => {
		const id = `${Date.now()}-${Math.random()}`;
		pendingRequests.set(id, {
			resolve,
			reject
		});
		worker.postMessage({
			type,
			id,
			payload
		});
	});
}
function isCoarseMobileUa() {
	return /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || "");
}
function webgpuAvailable() {
	return typeof navigator !== "undefined" && "gpu" in navigator && Boolean(navigator.gpu);
}
function getSlideMeta(index) {
	const m = deckMeta[index];
	if (!m) return { ...EMPTY_SLIDE_META };
	return {
		section: m.section ?? "",
		duration: m.duration ?? "",
		takeaway: m.takeaway ?? "",
		artifacts: Array.isArray(m.artifacts) ? m.artifacts : [],
		audienceQuestion: m.audienceQuestion ?? ""
	};
}
var currentSlideIndex = 0;
var ttsLoaded = false;
var ttsLoadFailed = false;
var slideDiagramGen = 0;
var mermaidConfigured = false;
var activeNarrationAudio = null;
var activeNarrationUrl = null;
/** Bumped on slide change / replay so stale `generate` results are dropped. */
var slideSpeechEpoch = 0;
var stageWasFullscreen = false;
/** In-memory WAV blob cache keyed by "slideIndex:voice:speed". */
var audioCache = /* @__PURE__ */ new Map();
/** Whether auto-advance is active (presentation flows through all slides). */
var autoAdvanceActive = false;
var playbackState = "idle";
function audioCacheKey(slideIdx, voice, speed) {
	return `${slideIdx}:${voice}:${speed.toFixed(2)}`;
}
var slideKickerEl = document.getElementById("slide-kicker");
var slideTitleEl = document.getElementById("slide-title");
var slideLedeEl = document.getElementById("slide-lede");
var slideBulletsEl = document.getElementById("slide-bullets");
var slideGlossEl = document.getElementById("slide-gloss");
var slideDiagramEl = document.getElementById("slide-diagram");
var presenterStatusEl = document.getElementById("presenter-status");
var stageCardEl = document.getElementById("stage-card");
var stageSlideRefEl = document.getElementById("stage-slide-ref");
var prevSlideBtn = document.getElementById("prev-slide");
var nextSlideBtn = document.getElementById("next-slide");
var voiceSelectEl = document.getElementById("voice-select");
var runtimeSelectEl = document.getElementById("runtime-select");
var modelSelectEl = document.getElementById("model-select");
var speedRangeEl = document.getElementById("speed-range");
var speedValEl = document.getElementById("speed-val");
var runtimeNoteEl = document.getElementById("runtime-note");
var presentSlidesBtn = document.getElementById("present-slides");
var startBtn = document.getElementById("start-btn");
var pauseBtn = document.getElementById("pause-btn");
var stopBtn = document.getElementById("stop-btn");
var toolbarSetupEl = document.getElementById("toolbar-setup");
var voiceBadgeEl = document.getElementById("voice-badge");
var slideNotesBodyEl = document.getElementById("slide-notes-body");
var presenterMetaLineEl = document.getElementById("presenter-meta-line");
var ttsChipEl = document.getElementById("tts-chip");
function updateStatus(message, kind = "") {
	if (!presenterStatusEl) return;
	presenterStatusEl.textContent = message;
	const cls = kind === "success" ? "ok" : kind === "warning" ? "warn" : kind === "error" ? "err" : "";
	presenterStatusEl.className = cls ? `status-pill ${cls}` : "status-pill";
}
function getActiveSlide() {
	const content = deck[currentSlideIndex];
	const meta = getSlideMeta(currentSlideIndex);
	return {
		...content,
		kicker: meta.section,
		duration: meta.duration,
		takeaway: meta.takeaway,
		artifacts: meta.artifacts,
		audienceQuestion: meta.audienceQuestion
	};
}
function isPrerecordedMode() {
	return (runtimeSelectEl?.value ?? "auto") === "prerecorded";
}
function updateRuntimeUi() {
	const runtime = runtimeSelectEl?.value ?? "auto";
	const prerecorded = runtime === "prerecorded";
	const voiceField = voiceSelectEl?.closest(".toolbar-field");
	const modelField = modelSelectEl?.closest(".toolbar-field");
	const speedField = speedRangeEl?.closest(".toolbar-field");
	if (voiceField) voiceField.style.display = prerecorded ? "none" : "";
	if (modelField) modelField.style.display = prerecorded ? "none" : "";
	if (speedField) speedField.style.display = prerecorded ? "none" : "";
	if (runtimeNoteEl) if (prerecorded) {
		runtimeNoteEl.hidden = false;
		runtimeNoteEl.textContent = "Uses pre-recorded audio — no model download needed.";
	} else {
		runtimeNoteEl.hidden = false;
		runtimeNoteEl.textContent = "Auto and CPU use WASM (reliable). GPU (WebGPU) is experimental for Nano — if OrtRun fails, the session reloads on WASM once. Micro/Mini are WASM only.";
	}
	if (!modelSelectEl || prerecorded) return;
	const gpuSelected = runtime === "gpu";
	const nanoOption = modelSelectEl.querySelector("option[value=\"onnx-community/KittenTTS-Nano-v0.8-ONNX\"]");
	const microOption = modelSelectEl.querySelector("option[value=\"onnx-community/KittenTTS-Micro-v0.8-ONNX\"]");
	const miniOption = modelSelectEl.querySelector("option[value=\"onnx-community/KittenTTS-Mini-v0.8-ONNX\"]");
	if (microOption) microOption.disabled = gpuSelected;
	if (miniOption) miniOption.disabled = gpuSelected;
	if (nanoOption) nanoOption.disabled = false;
	if (gpuSelected && modelSelectEl.value !== "onnx-community/KittenTTS-Nano-v0.8-ONNX") modelSelectEl.value = "onnx-community/KittenTTS-Nano-v0.8-ONNX";
}
function getSpeechSpeed() {
	if (speedRangeEl) return parseFloat(speedRangeEl.value) || 1;
	return 1;
}
function buildNarrationText(slide) {
	const script = slide.presenterScript;
	if (script) return script;
	const bullets = formatBulletsForPlaintext(slide.bullets);
	const ledeFlat = String(slide.lede || "").replace(/\n+/g, " ").trim();
	return [
		`Slide: ${slide.title}.`,
		ledeFlat,
		bullets ? `Points:\n${bullets}` : "",
		slide.notes ? `Speaker notes: ${slide.notes}` : ""
	].filter(Boolean).join("\n\n");
}
/** KittenTTS-friendly cleanup — keep sentence-ending punctuation so _chunkText can split. */
function ttsPreprocess(text) {
	let s = String(text || "").trim();
	s = s.replace(/^\s*(?:action|narration|stage|tool)\s*:\s*/i, "");
	s = s.replace(/\[(?:\s*)(?:pause|beat|laughs?|laughing|applause|gasps?|sighs?|music)(?:\s*)\]/gi, " ");
	s = s.replace(/\((?:\s*)(?:pause|beat|laughs?|applause)(?:\s*)\)/gi, " ");
	s = s.replace(/<tools\b[^>]*>[\s\S]*?<\/tools>/gi, "");
	s = s.replace(/\.{3,}/g, "...");
	s = s.replace(/\s{2,}/g, " ").trim();
	return s;
}
function createWavBlob(floatArr, sampleRate) {
	const pcm16 = new Int16Array(floatArr.length);
	for (let i = 0; i < floatArr.length; i += 1) {
		const sample = Math.max(-1, Math.min(1, floatArr[i]));
		pcm16[i] = sample < 0 ? sample * 32768 : sample * 32767;
	}
	const buffer = /* @__PURE__ */ new ArrayBuffer(44 + pcm16.length * 2);
	const view = new DataView(buffer);
	const writeString = (offset, text) => {
		for (let j = 0; j < text.length; j += 1) view.setUint8(offset + j, text.charCodeAt(j));
	};
	writeString(0, "RIFF");
	view.setUint32(4, 36 + pcm16.length * 2, true);
	writeString(8, "WAVE");
	writeString(12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, 1, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * 2, true);
	view.setUint16(32, 2, true);
	view.setUint16(34, 16, true);
	writeString(36, "data");
	view.setUint32(40, pcm16.length * 2, true);
	let offset = 44;
	for (let i = 0; i < pcm16.length; i += 1, offset += 2) view.setInt16(offset, pcm16[i], true);
	return new Blob([buffer], { type: "audio/wav" });
}
async function loadModel(modelId) {
	const runtime = runtimeSelectEl?.value ?? "auto";
	const wasmThreads = typeof crossOriginIsolated !== "undefined" && crossOriginIsolated && !isCoarseMobileUa() ? 4 : 1;
	updateStatus(`Loading KittenTTS (${modelId.split("/").pop()})…`);
	ttsLoaded = false;
	syncPresentButtonEnabled();
	syncPlaybackUI();
	try {
		const initInfo = await postToWorker("init", {
			modelId,
			runtime,
			wasmThreads,
			wasmSimd: true
		});
		ttsLoaded = true;
		ttsLoadFailed = false;
		const actual = String(initInfo?.runtimeActual || runtime).toUpperCase();
		const providers = Array.isArray(initInfo?.executionProviders) ? initInfo.executionProviders.join(", ") : "n/a";
		const actualLabel = actual === "CPU" ? "CPU (WASM)" : actual === "GPU" ? "GPU (WebGPU)" : actual;
		if (ttsChipEl) ttsChipEl.textContent = String(initInfo?.runtimeActual || initInfo?.runtimeRequested || "ready");
		updateStatus(`Ready — ${actualLabel} · ${providers}`, "success");
	} catch (e) {
		ttsLoadFailed = true;
		updateStatus(`TTS unavailable — using pre-recorded audio. ${(e instanceof Error ? e : new Error(String(e))).message}`, "warning");
	} finally {
		syncPresentButtonEnabled();
		syncPlaybackUI();
	}
}
function bumpSlideSpeechEpoch() {
	slideSpeechEpoch += 1;
	stopSpeech();
}
function stopSpeech() {
	const a = activeNarrationAudio;
	const u = activeNarrationUrl;
	activeNarrationAudio = null;
	activeNarrationUrl = null;
	playbackState = "idle";
	if (a) try {
		a.pause();
		a.currentTime = 0;
	} catch {}
	if (u) try {
		URL.revokeObjectURL(u);
	} catch {}
	if (ttsChipEl) ttsChipEl.textContent = "idle";
	syncPlaybackUI();
}
function isCurrentSlideCached() {
	const voice = voiceSelectEl?.value ?? "Jasper";
	const speed = getSpeechSpeed();
	return audioCache.has(audioCacheKey(currentSlideIndex, voice, speed));
}
function syncVoiceBadge() {
	if (!voiceBadgeEl) return;
	const voice = voiceSelectEl?.value ?? "Jasper";
	if (playbackState === "idle") {
		const cached = isCurrentSlideCached();
		voiceBadgeEl.hidden = false;
		if (cached) {
			voiceBadgeEl.setAttribute("data-state", "ready");
			voiceBadgeEl.innerHTML = `<span class="voice-badge-dot"></span>Audio ready · ${ttsLoaded ? voice : "pre-recorded"}`;
		} else if (!ttsLoaded) {
			voiceBadgeEl.setAttribute("data-state", "pending");
			voiceBadgeEl.innerHTML = `<span class="voice-badge-dot"></span>Pre-recorded fallback`;
		} else {
			voiceBadgeEl.setAttribute("data-state", "pending");
			voiceBadgeEl.innerHTML = `<span class="voice-badge-dot"></span>Not generated`;
		}
		return;
	}
	voiceBadgeEl.hidden = false;
	voiceBadgeEl.setAttribute("data-state", playbackState);
	voiceBadgeEl.innerHTML = `<span class="voice-badge-dot"></span>${{
		idle: "",
		synthesizing: "Generating…",
		playing: "Speaking",
		paused: "Paused"
	}[playbackState]} · ${voice}`;
}
function syncPlaybackUI() {
	const idle = playbackState === "idle";
	const synth = playbackState === "synthesizing";
	const playing = playbackState === "playing";
	const paused = playbackState === "paused";
	if (startBtn instanceof HTMLButtonElement) {
		startBtn.disabled = synth || playing;
		startBtn.textContent = paused ? "▶ Resume" : "▶ Start";
	}
	if (pauseBtn instanceof HTMLButtonElement) pauseBtn.disabled = !playing;
	if (stopBtn instanceof HTMLButtonElement) stopBtn.disabled = idle;
	if (toolbarSetupEl) toolbarSetupEl.classList.toggle("config-locked", !idle);
	syncVoiceBadge();
}
async function fetchPrerecordedAudio(slideIdx) {
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
async function synthesizeSlide(slideIdx, voice, speed) {
	const key = audioCacheKey(slideIdx, voice, speed);
	const cached = audioCache.get(key);
	if (cached) return cached;
	if (ttsLoaded) {
		const meta = getSlideMeta(slideIdx);
		const result = await postToWorker("generate", {
			text: ttsPreprocess(buildNarrationText({
				...deck[slideIdx],
				kicker: meta.section,
				duration: meta.duration,
				takeaway: meta.takeaway,
				artifacts: meta.artifacts,
				audienceQuestion: meta.audienceQuestion
			})),
			voice,
			speed
		});
		const blob = createWavBlob(result.floatArr, result.sampleRate);
		audioCache.set(key, blob);
		return blob;
	}
	const prerecorded = await fetchPrerecordedAudio(slideIdx);
	if (prerecorded) {
		audioCache.set(key, prerecorded);
		return prerecorded;
	}
	throw new Error("TTS not loaded and no pre-recorded audio available.");
}
/** Fire-and-forget: pre-generate the next slide audio while the current one plays. */
function prefetchNextSlide(voice, speed) {
	const next = currentSlideIndex + 1;
	if (next >= deck.length) return;
	const key = audioCacheKey(next, voice, speed);
	if (audioCache.has(key)) return;
	synthesizeSlide(next, voice, speed).catch(() => {});
}
/**
* Speak the current slide. Uses cached audio when available; otherwise synthesizes and caches.
* When a slide finishes and `autoAdvanceActive` is true, advances to the next slide automatically.
*/
async function speakCurrentSlide() {
	const epoch = slideSpeechEpoch;
	const slideIdx = currentSlideIndex;
	if (!buildNarrationText(getActiveSlide()).trim()) {
		updateStatus("Nothing to read on this slide.", "warning");
		return;
	}
	const voice = voiceSelectEl?.value ?? "Jasper";
	const speed = getSpeechSpeed();
	const key = audioCacheKey(slideIdx, voice, speed);
	const isCached = audioCache.has(key);
	playbackState = "synthesizing";
	syncPlaybackUI();
	updateStatus(isCached ? "Loading cached audio…" : ttsLoaded ? "Synthesizing speech…" : "Loading pre-recorded audio…");
	try {
		if (!ttsLoaded && !isPrerecordedMode() && !ttsLoadFailed) await loadModel(modelSelectEl?.value ?? "onnx-community/KittenTTS-Nano-v0.8-ONNX").catch(() => {});
		if (epoch !== slideSpeechEpoch) return;
		const blob = await synthesizeSlide(slideIdx, voice, speed);
		if (epoch !== slideSpeechEpoch) return;
		const url = URL.createObjectURL(blob);
		const audio = new Audio(url);
		if ("playsInline" in audio) audio.playsInline = true;
		audio.volume = 1;
		if (epoch !== slideSpeechEpoch) {
			try {
				URL.revokeObjectURL(url);
			} catch {}
			return;
		}
		activeNarrationAudio = audio;
		activeNarrationUrl = url;
		playbackState = "playing";
		syncPlaybackUI();
		if (ttsChipEl) ttsChipEl.textContent = `speaking · ${voice}`;
		audio.addEventListener("ended", () => {
			if (activeNarrationAudio === audio) {
				activeNarrationAudio = null;
				activeNarrationUrl = null;
			}
			try {
				URL.revokeObjectURL(url);
			} catch {}
			if (ttsChipEl) ttsChipEl.textContent = "idle";
			if (autoAdvanceActive && epoch === slideSpeechEpoch && slideIdx + 1 < deck.length) {
				currentSlideIndex = slideIdx + 1;
				renderSlide();
				speakCurrentSlide();
			} else {
				playbackState = "idle";
				autoAdvanceActive = false;
				if (slideIdx + 1 >= deck.length) updateStatus("Presentation complete.", "success");
			}
			syncPlaybackUI();
		}, { once: true });
		prefetchNextSlide(voice, speed);
		try {
			await audio.play();
		} catch (playErr) {
			updateStatus(playErr instanceof DOMException && playErr.name === "NotAllowedError" ? "Playback blocked — click Present or Replay slide once so the browser allows audio." : `Could not play: ${playErr instanceof Error ? playErr.message : String(playErr)}`, "warning");
			stopSpeech();
			return;
		}
		if (epoch !== slideSpeechEpoch) {
			stopSpeech();
			return;
		}
		const dur = (blob.size / 2 / 24e3).toFixed(1);
		updateStatus(`${isCached ? "Cached" : "Playing"} — ~${dur}s · ${voice} · ${speed.toFixed(2)}×`, "success");
	} catch (e) {
		if (epoch !== slideSpeechEpoch) return;
		updateStatus(`TTS error: ${(e instanceof Error ? e : new Error(String(e))).message}`, "error");
		playbackState = "idle";
		autoAdvanceActive = false;
	} finally {
		if (epoch === slideSpeechEpoch) {}
		syncPlaybackUI();
	}
}
function navigateToSlide(nextIndex) {
	if (nextIndex < 0 || nextIndex >= deck.length || nextIndex === currentSlideIndex) return;
	const wasActive = playbackState !== "idle";
	bumpSlideSpeechEpoch();
	currentSlideIndex = nextIndex;
	renderSlide();
	if (wasActive) {
		autoAdvanceActive = true;
		speakCurrentSlide();
	}
}
function clearSlideDiagram() {
	if (!slideDiagramEl) return;
	slideDiagramEl.innerHTML = "";
	slideDiagramEl.hidden = true;
}
function ensureMermaidConfigured() {
	const m = globalThis.mermaid;
	if (!m) return false;
	if (!mermaidConfigured) {
		m.initialize({
			startOnLoad: false,
			theme: "dark",
			securityLevel: "loose",
			themeVariables: {
				fontSize: "20px",
				primaryColor: "#3d2520",
				primaryTextColor: "#fff7ef",
				primaryBorderColor: "#d0632f",
				lineColor: "#e8a070",
				secondaryColor: "#2a2420",
				tertiaryColor: "#181410",
				background: "#181410",
				mainBkg: "#2a2420",
				nodeBorder: "#d0632f",
				clusterBkg: "rgba(208,99,47,0.12)",
				titleColor: "#ffd6b8",
				edgeLabelBackground: "#2a2420"
			}
		});
		mermaidConfigured = true;
	}
	return true;
}
async function renderMermaidIntoSlideHost(definition, title, gen) {
	if (!slideDiagramEl) return;
	const def = String(definition || "").trim();
	if (!def) {
		slideDiagramEl.hidden = true;
		return;
	}
	if (gen !== slideDiagramGen) return;
	slideDiagramEl.innerHTML = "";
	const wrap = document.createElement("div");
	wrap.className = "diagram-mermaid-inner";
	if (title) {
		const h = document.createElement("div");
		h.className = "diagram-title";
		h.textContent = title;
		wrap.appendChild(h);
	}
	const out = document.createElement("div");
	out.className = "diagram-mermaid-out";
	if (!ensureMermaidConfigured()) {
		if (gen !== slideDiagramGen) return;
		const err = document.createElement("p");
		err.className = "diagram-error";
		err.textContent = "Mermaid did not load. Check network or refresh.";
		out.appendChild(err);
		wrap.appendChild(out);
		slideDiagramEl.appendChild(wrap);
		slideDiagramEl.hidden = false;
		return;
	}
	const id = `mmd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
	try {
		const rendered = await globalThis.mermaid.render(id, def);
		if (gen !== slideDiagramGen) return;
		out.innerHTML = rendered.svg;
		if (typeof rendered.bindFunctions === "function") rendered.bindFunctions(out);
	} catch (e) {
		if (gen !== slideDiagramGen) return;
		const err = document.createElement("p");
		err.className = "diagram-error";
		const msg = e instanceof Error ? e.message : "";
		err.textContent = msg ? `Diagram error: ${msg}` : "Invalid Mermaid diagram.";
		out.appendChild(err);
	}
	if (gen !== slideDiagramGen) return;
	wrap.appendChild(out);
	slideDiagramEl.appendChild(wrap);
	slideDiagramEl.hidden = false;
}
async function renderSlideDiagramPreset(key, gen) {
	const preset = DIAGRAM_PRESETS[key];
	if (!preset) return;
	await renderMermaidIntoSlideHost(preset.definition, preset.title, gen);
}
function clearToolEffects() {
	document.querySelectorAll(".tool-highlight").forEach((el) => {
		el.outerHTML = el.textContent ?? "";
	});
	document.querySelectorAll(".tool-emphasize").forEach((el) => {
		el.classList.remove("tool-emphasize", "fade-out");
	});
	const overlay = document.getElementById("stage-overlay");
	if (overlay) {
		overlay.classList.remove("visible");
		overlay.textContent = "";
	}
}
function renderSlide() {
	clearToolEffects();
	const slide = getActiveSlide();
	const kickerText = typeof slide.kicker === "string" ? slide.kicker.trim() : "";
	if (slideKickerEl) {
		slideKickerEl.textContent = kickerText;
		const kickerWrap = slideKickerEl.parentElement;
		const hideKicker = !kickerText;
		slideKickerEl.hidden = hideKicker;
		if (kickerWrap instanceof HTMLElement) kickerWrap.hidden = hideKicker;
		const stageMetaEl = slideKickerEl.closest(".stage-meta");
		if (stageMetaEl instanceof HTMLElement) stageMetaEl.hidden = hideKicker;
	}
	if (slideTitleEl) slideTitleEl.textContent = slide.title;
	if (slideLedeEl) slideLedeEl.textContent = slide.lede;
	if (slideBulletsEl) {
		slideBulletsEl.innerHTML = "";
		const bulletList = Array.isArray(slide.bullets) ? slide.bullets : [];
		bulletList.forEach((bullet) => {
			const item = document.createElement("li");
			if (typeof bullet === "string") {
				const body = document.createElement("span");
				body.className = "bullet-body";
				body.textContent = bullet;
				item.appendChild(body);
				slideBulletsEl.appendChild(item);
				return;
			}
			if (bullet && typeof bullet === "object" && "text" in bullet && typeof bullet.text === "string") {
				const b = bullet;
				const head = document.createElement("span");
				head.className = "bullet-head";
				head.textContent = b.text;
				item.appendChild(head);
				const subs = Array.isArray(b.sub) ? b.sub : [];
				if (subs.length) {
					const subUl = document.createElement("ul");
					subUl.className = "bullets bullets-sub";
					subs.forEach((line) => {
						const subLi = document.createElement("li");
						const subBody = document.createElement("span");
						subBody.className = "bullet-body";
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
	if (slideGlossEl) if (!glossLines.length) {
		slideGlossEl.hidden = true;
		slideGlossEl.innerHTML = "";
	} else {
		slideGlossEl.hidden = false;
		slideGlossEl.innerHTML = "";
		const glossTitle = document.createElement("div");
		glossTitle.className = "slide-gloss-title";
		glossTitle.textContent = "On this slide";
		slideGlossEl.appendChild(glossTitle);
		const glossUl = document.createElement("ul");
		glossUl.className = "slide-gloss-list";
		glossLines.forEach((line) => {
			const gli = document.createElement("li");
			gli.textContent = line;
			glossUl.appendChild(gli);
		});
		slideGlossEl.appendChild(glossUl);
	}
	if (slideNotesBodyEl) slideNotesBodyEl.textContent = slide.presenterScript || slide.notes || "—";
	if (presenterMetaLineEl) {
		const bits = [slide.kicker, slide.duration].filter(Boolean);
		if (slide.takeaway) bits.push(slide.takeaway);
		presenterMetaLineEl.textContent = bits.join(" · ") || "";
	}
	clearSlideDiagram();
	const rawDiagram = slide.diagram;
	const diagramKey = typeof rawDiagram === "string" ? rawDiagram : "";
	if (diagramKey && diagramKey in DIAGRAM_PRESETS) {
		slideDiagramGen += 1;
		renderSlideDiagramPreset(diagramKey, slideDiagramGen);
	}
	if (stageSlideRefEl) stageSlideRefEl.textContent = `${currentSlideIndex + 1} / ${deck.length}`;
	if (prevSlideBtn instanceof HTMLButtonElement) prevSlideBtn.disabled = currentSlideIndex <= 0;
	if (nextSlideBtn instanceof HTMLButtonElement) nextSlideBtn.disabled = currentSlideIndex >= deck.length - 1;
	syncVoiceBadge();
}
function syncPresentButtonEnabled() {
	if (!(presentSlidesBtn instanceof HTMLButtonElement)) return;
	presentSlidesBtn.disabled = false;
	presentSlidesBtn.removeAttribute("title");
}
function reloadModelFromCurrentSelection() {
	updateRuntimeUi();
	audioCache.clear();
	ttsLoadFailed = false;
	const modelId = modelSelectEl?.value;
	if (!modelId) return;
	loadModel(modelId).catch(() => {});
}
speedRangeEl?.addEventListener("input", () => {
	if (playbackState !== "idle") return;
	if (speedValEl && speedRangeEl) speedValEl.textContent = `${parseFloat(speedRangeEl.value).toFixed(2)}×`;
});
modelSelectEl?.addEventListener("change", () => {
	if (playbackState !== "idle") return;
	reloadModelFromCurrentSelection();
});
runtimeSelectEl?.addEventListener("change", () => {
	if (playbackState !== "idle") return;
	updateRuntimeUi();
	audioCache.clear();
	if (isPrerecordedMode()) {
		ttsLoaded = false;
		updateStatus("Pre-recorded mode — no model download.", "warning");
		syncPlaybackUI();
	} else reloadModelFromCurrentSelection();
});
startBtn?.addEventListener("click", () => {
	if (playbackState === "paused" && activeNarrationAudio) {
		playbackState = "playing";
		syncPlaybackUI();
		activeNarrationAudio.play();
		updateStatus("Resumed.", "success");
		return;
	}
	autoAdvanceActive = true;
	bumpSlideSpeechEpoch();
	speakCurrentSlide();
});
pauseBtn?.addEventListener("click", () => {
	if (playbackState !== "playing" || !activeNarrationAudio) return;
	activeNarrationAudio.pause();
	playbackState = "paused";
	syncPlaybackUI();
	updateStatus("Paused.", "success");
});
stopBtn?.addEventListener("click", () => {
	autoAdvanceActive = false;
	bumpSlideSpeechEpoch();
	updateStatus("Stopped.", "success");
});
prevSlideBtn?.addEventListener("click", () => {
	navigateToSlide(currentSlideIndex - 1);
});
nextSlideBtn?.addEventListener("click", () => {
	navigateToSlide(currentSlideIndex + 1);
});
function getFullscreenElement() {
	return document.fullscreenElement ?? document.webkitFullscreenElement ?? null;
}
function requestFS(el) {
	if (el.requestFullscreen) return el.requestFullscreen();
	if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
	return Promise.reject(/* @__PURE__ */ new Error("Fullscreen API not supported"));
}
function exitFS() {
	if (document.exitFullscreen) return document.exitFullscreen();
	if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
	return Promise.reject(/* @__PURE__ */ new Error("Fullscreen API not supported"));
}
presentSlidesBtn?.addEventListener("click", () => {
	if (getFullscreenElement()) {
		exitFS().then(() => {
			if (presentSlidesBtn instanceof HTMLButtonElement) presentSlidesBtn.textContent = "Present";
		});
		return;
	}
	if (stageCardEl) requestFS(stageCardEl).catch((error) => {
		updateStatus(`Fullscreen failed: ${error instanceof Error ? error.message : String(error)}`, "warning");
	});
});
var fsChangeEvent = "fullscreenchange" in document ? "fullscreenchange" : "webkitfullscreenchange";
document.addEventListener(fsChangeEvent, () => {
	const el = getFullscreenElement();
	const presentingStage = el === stageCardEl;
	if (presentSlidesBtn instanceof HTMLButtonElement) presentSlidesBtn.textContent = el ? "Exit presentation" : "Present";
	syncPresentButtonEnabled();
	if (presentingStage) {
		try {
			stageCardEl?.focus({ preventScroll: true });
		} catch {}
		if (playbackState === "idle" && ttsLoaded) {
			autoAdvanceActive = true;
			bumpSlideSpeechEpoch();
			speakCurrentSlide();
		}
	} else if (stageWasFullscreen) {
		autoAdvanceActive = false;
		bumpSlideSpeechEpoch();
		updateStatus("Exited presentation.", "success");
	}
	stageWasFullscreen = presentingStage;
});
document.addEventListener("keydown", (e) => {
	if (e.altKey || e.ctrlKey || e.metaKey) return;
	const t = e.target;
	if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
	if (e.key === "ArrowLeft") navigateToSlide(currentSlideIndex - 1);
	else if (e.key === "ArrowRight") navigateToSlide(currentSlideIndex + 1);
});
if (toolbarSetupEl instanceof HTMLDetailsElement) document.addEventListener("click", (e) => {
	if (!toolbarSetupEl.open) return;
	if (!toolbarSetupEl.contains(e.target)) toolbarSetupEl.open = false;
});
renderSlide();
syncPlaybackUI();
updateRuntimeUi();
if (speedValEl && speedRangeEl) speedValEl.textContent = `${parseFloat(speedRangeEl.value).toFixed(2)}×`;
var wantsLive = new URLSearchParams(location.search).has("live");
if (wantsLive && webgpuAvailable()) {
	if (runtimeSelectEl) runtimeSelectEl.value = "gpu";
	if (modelSelectEl) modelSelectEl.value = "onnx-community/KittenTTS-Nano-v0.8-ONNX";
} else if (wantsLive) {
	if (runtimeSelectEl) runtimeSelectEl.value = "auto";
} else if (runtimeSelectEl) runtimeSelectEl.value = "prerecorded";
updateRuntimeUi();
if (isPrerecordedMode()) updateStatus("Pre-recorded mode — no model download.", "warning");
else loadModel(modelSelectEl?.value ?? "onnx-community/KittenTTS-Nano-v0.8-ONNX").catch(() => {});
window.__kittenSlidesLabReady = true;
//#endregion
