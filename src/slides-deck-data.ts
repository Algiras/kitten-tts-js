/** Talk deck + diagram presets for `slides.html` presenter (aligned with docs/talk-outline.md). */
export const deckMeta = [
  { section: 'Opening', duration: '1 min', takeaway: 'Talk title sets the theme; name and links support, not the headline.', artifacts: [], audienceQuestion: '' },
  { section: 'Plan', duration: '1 min', takeaway: 'Audience knows the arc: TTS, KittenTTS, port, build, runtimes, landscape, next.', artifacts: ['Talk outline'], audienceQuestion: '' },
  { section: 'What is TTS', duration: '2 min', takeaway: 'Neural vs browser TTS vocabulary is set.', artifacts: ['speechSynthesis', 'ONNX TTS'], audienceQuestion: 'When is built-in TTS enough vs bringing your own model?' },
  { section: 'KittenTTS', duration: '2 min', takeaway: 'Upstream is KittenML on Hugging Face; JS port is runtime only.', artifacts: ['KittenML/KittenTTS', 'Hugging Face weights'], audienceQuestion: 'Who owns the checkpoints vs the runtime?' },
  { section: 'kitten-tts-js', duration: '4 min', takeaway: 'KittenML IDs in Node vs onnx-community IDs in browser; why JavaScript.', artifacts: ['npm package', 'ORT Web', 'WebGPU Nano'], audienceQuestion: 'Which HF ID do I use in Node vs the browser?' },
  {
    section: 'Build process',
    duration: '3 min',
    takeaway: 'Agents plus Whisper transcript checks, waveform gates, and browser runs.',
    artifacts: ['Cursor / Claude', 'Whisper STT vs reference', 'Waveform / level gates', 'Playwright', 'whisper-tts-eval skill'],
    audienceQuestion: 'How do you regression-test TTS without golden ears?',
  },
  {
    section: 'Eval loop',
    duration: '1 min',
    takeaway: 'One full-screen loop: change, WAV, checks, ship or iterate.',
    artifacts: ['Mermaid diagram'],
    audienceQuestion: '',
  },
  { section: 'Requirements', duration: '3 min', takeaway: 'Support matrix: Node CPU; browser WASM tiers; WebGPU Nano-only.', artifacts: ['secure context', 'model cache'], audienceQuestion: 'What breaks on Safari or without SharedArrayBuffer?' },
  { section: 'Landscape', duration: '3 min', takeaway: 'Self-host JS vs cloud vs Piper.', artifacts: ['Web Speech', 'Cloud APIs', 'Piper'], audienceQuestion: 'When is cloud TTS worth it over npm plus static hosting?' },
  {
    section: 'Roadmap',
    duration: '2 min',
    takeaway: 'Eval docs, deck scoring, worker docs, CI golden WAV plus STT, community.',
    artifacts: ['GitHub issues', 'whisper-tts-eval'],
    audienceQuestion: 'What would you merge first?',
  },
  { section: 'Q&A', duration: 'as needed', takeaway: 'Links visible; seed questions if the room is quiet.', artifacts: ['Live demo URL', 'Repo URL'], audienceQuestion: 'What did we not cover?' },
  { section: 'Thank you', duration: '1 min', takeaway: 'Credit KittenML; point at the repo.', artifacts: ['Algiras/kitten-tts-js', 'KittenML attribution'], audienceQuestion: null },
];

export const deck = [
  {
    title: 'kitten-tts: real-time TTS on (almost) anything',
    lede: 'Algimantas Krasauskas, AI Engineer, Wix.\nkitten-tts-js: Jasper reads this deck live in your browser.',
    bullets: ['github.com/Algiras', 'linkedin.com/in/asimplek'],
    glossary: ['TTS: text-to-speech'],
    notes: 'Lead with the title; then thanks, name, role, Wix.',
    presenterScript:
      'Hello everyone. I am Jasper, one of the voices in kitten-tts-js. ' +
      'Algimantas could not be here today, so I will be walking you through his talk. ' +
      'The title on screen says it all: real-time text-to-speech on almost anything. ' +
      'And yes, I am the proof. I am running right now in your browser, no server, no cloud API. ' +
      'Just an ONNX model, WebAssembly, and a web worker. ' +
      'Algimantas is an AI engineer at Wix. You can find him on GitHub as Algiras, and on LinkedIn. ' +
      'Those links are on the slide if you want to connect later. Let us get started.',
  },
  {
    title: 'The arc of this talk',
    lede: 'From "what is TTS?" to a live demo running in your browser, in twelve slides.',
    bullets: [
      'TTS basics, then the KittenTTS model family.',
      'The JavaScript port: why, how it was built, where it runs.',
      'Landscape: what else exists and the tradeoffs.',
      'What is next, then Q and A.',
    ],
    glossary: [],
    notes: 'Quick roadmap, about 30 seconds.',
    presenterScript:
      'Here is the plan. We will start with what TTS actually is, then I will introduce KittenTTS, the model family behind my voice. ' +
      'After that, we will cover why Algimantas built a JavaScript port and how the build and testing pipeline works. ' +
      'Then we will look at where the library runs, what alternatives exist, and where things are heading. ' +
      'Four stops, and we end with questions.',
  },
  {
    title: 'What is TTS?',
    lede: 'Text-to-speech turns text into audio. Neural systems learn the mapping; classical systems use hand-tuned rules.',
    bullets: [
      'Pipeline: text to linguistic features to acoustic model to waveform.',
      'Browser speechSynthesis: zero setup, but fixed voices and uneven quality.',
      'Neural ONNX in JS: repeatable output, same code path in Node and browser.',
    ],
    glossary: [
      'Waveform: audio signal over time',
      'speechSynthesis: browser built-in TTS',
      'ONNX: open format for ML models across runtimes',
    ],
    notes: 'About one minute. Built-in TTS is fine for accessibility; bring your own model when you need control.',
    presenterScript:
      'So what is text-to-speech? You can see the basic pipeline on the slide. ' +
      'Text goes in, linguistic features like pronunciation and prosody come out, ' +
      'an acoustic model predicts the sound, and you get a waveform. ' +
      'Now, every modern browser already ships speechSynthesis, the built-in Web Speech API. ' +
      'It works, and it is great for accessibility. ' +
      'But the voices are fixed by the OS, quality varies across platforms, ' +
      'and you cannot export or compare the output in a repeatable pipeline. ' +
      'That is where neural TTS with ONNX comes in. ' +
      'You ship the model, you get the same voice and the same audio on every device, in Node and in the browser. ' +
      'That is the approach this project takes.',
  },
  {
    title: 'What is KittenTTS?',
    lede: 'KittenTTS by KittenML and Stellon Labs is the Python reference. The JavaScript port runs their ONNX exports.',
    bullets: [
      'StyleTTS 2 architecture. The JS port runs ONNX graphs, not Python training code.',
      'Three tiers: nano, micro, mini. Size vs quality tradeoff.',
      'Weights live on Hugging Face under KittenML.',
      'Eight voices: Bella, Jasper, Luna, Bruno, Rosie, Hugo, Jasper, and Leo.',
    ],
    glossary: [
      'StyleTTS 2: neural TTS architecture',
      'Checkpoints: saved model weights',
      'HF: Hugging Face',
    ],
    notes: 'Credit KittenML for architecture and voices. Apache 2.0 license.',
    presenterScript:
      'Now let me introduce the model family. KittenTTS is built by KittenML and Stellon Labs. ' +
      'It follows the StyleTTS 2 architecture, which you can see noted on the slide. ' +
      'The important thing: this JavaScript port does not retrain anything. ' +
      'It takes the ONNX model exports from KittenML and runs them in a JavaScript runtime. ' +
      'The research and the voices come from them; the port is about distribution. ' +
      'There are three model sizes: nano, micro, and mini, each trading size for quality. ' +
      'And as you can see in the bullet list, there are eight voices. I am Jasper. ' +
      'I am joined by Bella, Jasper, Luna, Bruno, Rosie, Hugo, and Leo. ' +
      'All the weights live on Hugging Face under KittenML.',
  },
  {
    title: 'Why kitten-tts-js?',
    lede: 'Unofficial TypeScript port. npm install kitten-tts-js. Same voices, runs where your JS already lives.',
    bullets: [
      'ONNX Runtime in-process: Node CPU, browser WASM, WebGPU when available.',
      'Streaming via async generator. Cache after first download.',
      'Node uses KittenML model IDs. Browser uses onnx-community IDs.',
      'WebGPU: Nano only today. Micro and Mini stay on WASM.',
      'Why JS: one language for lib, demo, and tests. No Python server in your app path.',
    ],
    glossary: [
      'ORT: ONNX Runtime',
      'WASM: WebAssembly',
      'Web Workers: background JS threads',
    ],
    notes: 'Two model ID families: KittenML for Node, onnx-community for browser.',
    presenterScript:
      'So why a JavaScript port? You can see the bullet points on screen. ' +
      'The short answer: you can npm install this today and it runs wherever JavaScript runs. ' +
      'In Node, ONNX Runtime gives you CPU inference. ' +
      'In the browser, it is WebAssembly, with SIMD and threads when the page allows. ' +
      'For the nano model, WebGPU is also an option on supported browsers. ' +
      'One thing to note, and it is on the slide: there are two sets of model IDs. ' +
      'In Node, you use the KittenML IDs from Hugging Face. ' +
      'In the browser, you use the onnx-community IDs, because those are optimized for web delivery. ' +
      'Streaming works through an async generator that yields audio chunks as they are ready. ' +
      'The deeper reason for JavaScript is practical: ' +
      'one language for the library, the demo, and the tests. No Python service sitting between your app and the voice.',
  },
  {
    title: 'How it was built',
    lede: 'Agents sped up the coding; verification stayed on real audio and browsers.',
    bullets: [
      'Cursor, Composer, Claude Code: IDE coding agents.',
      'Whisper STT on synthetic audio: transcript vs reference text.',
      'Waveform level gates: silence, peak, and RMS checks.',
      'Playwright browser runs: real WASM and WebAudio paths.',
      'Repo skill: whisper-tts-eval.',
    ],
    glossary: [
      'WER: word error rate',
      'Playwright: browser test automation',
    ],
    notes: 'The story: "sounds fine" is not a regression test.',
    presenterScript:
      'This slide covers how the port was actually built. ' +
      'Algimantas used coding agents, Cursor, Composer, Claude Code, to speed up the repetitive parts. ' +
      'But the verification was deliberate. ' +
      'As you can see on the slide, he runs Whisper speech-to-text on the synthesized audio ' +
      'and compares the transcript to the original text. If the words drift, the build fails. ' +
      'On top of that, there are waveform level gates: checks for silence, peak levels, and RMS, ' +
      'so a broken export gets caught without anyone having to listen. ' +
      'And this is not just tested in Node. ' +
      'Playwright drives real browser sessions with actual WASM and WebAudio, ' +
      'so the test path matches what users hit in production. ' +
      'The whole loop is wrapped in a repo skill called whisper-tts-eval. ' +
      'The key insight here: sounds fine is not a regression test.',
  },
  {
    title: 'Build and eval loop',
    lede: 'One loop: synthesize, run STT and level gates, ship or iterate.',
    bullets: [],
    glossary: ['STT: speech-to-text', 'Level gates: RMS, silence, peak checks'],
    notes: 'Diagram slide. Narrate the cycle once.',
    presenterScript:
      'Take a look at the diagram on screen. This is the full loop. ' +
      'You make a change, generate audio, run speech-to-text and level checks, ' +
      'and if everything passes, you ship. If not, you go back and iterate. ' +
      'One cycle, fully automated, no manual listening required.',
    diagram: 'reinforcement_loop',
  },
  {
    title: 'Where it runs: requirements',
    lede: 'Models are tens of megabytes. Plan for download, cache, and runtime capability.',
    bullets: [
      'Node: CPU threads configurable. First run fetches weights, then caches.',
      'Browser: modern evergreen browser. HTTPS or localhost.',
      'WASM: SIMD and multithreading when the page allows.',
      'WebGPU: GPU path is Nano only. Micro and Mini use WASM.',
      'Offline works only after the model cache warms.',
    ],
    glossary: [
      'Evergreen: auto-updated browsers',
      'SIMD: CPU parallel math for faster WASM',
    ],
    notes: 'Support matrix: Node plus CPU; browser plus WASM for all tiers; GPU only Nano.',
    presenterScript:
      'Where does this actually run? The requirements are on the slide. ' +
      'In Node, you need a supported release and CPU threads are configurable. ' +
      'The first run downloads weights from Hugging Face, then they are cached locally. ' +
      'In the browser, you need a modern evergreen browser and a secure context, either HTTPS or localhost. ' +
      'WASM gives you the broadest support; SIMD and multithreading kick in when the page headers allow it. ' +
      'WebGPU is available but only for the nano model today. ' +
      'Micro and mini stay on WASM because of ONNX Runtime quantized model limits on the GPU path. ' +
      'And one thing to remember: offline only works after the cache has warmed. ' +
      'The first load always needs a network connection.',
  },
  {
    title: 'Landscape: what else exists',
    lede: 'Pick your axes: who hosts the model, and what you must ship.',
    bullets: [
      'Web Speech API: OS voices, weakest control.',
      'kokoro-js and ONNX-in-JS peers: compare size, license, voice count.',
      'Cloud TTS: ElevenLabs, Google, Azure, OpenAI. API keys, billing, great quality.',
      'Self-hosted: Piper, Docker containers. Ops-heavy.',
      'Python KittenTTS: same weights, different deployment.',
    ],
    glossary: [
      'kokoro-js: lightweight JS TTS option',
      'Piper: open self-hosted TTS engine',
    ],
    notes: 'Position kitten-tts-js as self-hosted, small ONNX, JS-native.',
    presenterScript:
      'Let us zoom out. You can see the landscape on screen. ' +
      'At the bottom of the stack, there is the Web Speech API. It is free and built in, ' +
      'but you are limited to whatever voices the OS provides. ' +
      'Then there are JS peers like kokoro-js that also run ONNX in the browser. ' +
      'Worth comparing on size, license, and voice count. ' +
      'Cloud TTS services like ElevenLabs, Google, Azure, and OpenAI often have the best quality, ' +
      'but you need API keys, you pay per request, and your audio goes through someone else\'s servers. ' +
      'Self-hosting with something like Piper is possible but ops-heavy. ' +
      'And Python KittenTTS gives you the same weights but requires a Python deployment. ' +
      'Where does kitten-tts-js fit? It is self-hosted, small ONNX models, JavaScript native. ' +
      'You npm install it, serve it from static hosting, and there is no server in the audio path. ' +
      'It is not going to replace cloud TTS for everyone, but when you want control and simplicity, it is a solid option.',
  },
  {
    title: 'What is next?',
    lede: 'The port gets more useful as the eval loop tightens.',
    bullets: [
      'Document Whisper and waveform evals end to end.',
      'Stronger scoring: transcript vs intent, not only waveforms.',
      'Web Worker docs and streaming UX examples.',
      'Golden audio plus transcript baselines in CI.',
      'Community: github.com/Algiras/kitten-tts-js',
    ],
    glossary: [
      'CI: continuous integration',
      'Web Worker: background JS thread',
    ],
    notes: 'Bridge to Q and A.',
    presenterScript:
      'Looking ahead, the roadmap is on the slide. ' +
      'First, documenting the Whisper and waveform eval pipeline end to end so others can use it. ' +
      'Then, stronger scoring that compares transcripts against intent, not just raw waveform checks. ' +
      'There is also work to do on Web Worker documentation and streaming UX examples, ' +
      'making it easier for developers to drop TTS into their apps. ' +
      'And in CI, the goal is golden audio baselines plus transcript checks ' +
      'that fail pull requests when quality drifts. ' +
      'The project is on GitHub at Algiras slash kitten-tts-js. Contributions and feedback are welcome.',
  },
  {
    title: 'Questions?',
    lede: 'Hugging Face IDs, WebGPU vs WASM, cloud vs self-host: happy to go deep.',
    bullets: [
      'Live demo: algiras.github.io/kitten-tts-js',
      'Repo: github.com/Algiras/kitten-tts-js',
      'npm: kitten-tts-js',
    ],
    glossary: [],
    notes: 'Stay on this slide while answering.',
    presenterScript:
      'Alright, that is the talk. The links are on the slide: the live demo, the GitHub repo, and the npm package name. ' +
      'If you have questions about Hugging Face model IDs, the WebGPU versus WASM tradeoff, ' +
      'or when cloud TTS makes more sense than self-hosting, I am happy to go into any of that. ' +
      'And remember, everything you just heard was synthesized by this library, running right here in your browser.',
  },
  {
    title: 'Thank you',
    lede: 'kitten-tts-js: JavaScript port of KittenTTS.',
    bullets: [
      'github.com/Algiras/kitten-tts-js',
      'Thanks to KittenML for the models and voices.',
      'Try other voices using the voice selector above.',
    ],
    glossary: ['Jasper: one of eight KittenTTS voices'],
    notes: 'Warm close.',
    presenterScript:
      'Thank you for listening. This was Jasper, presenting on behalf of Algimantas. ' +
      'Big thanks to KittenML for the models and voices that make this possible. ' +
      'The repo is on the slide if you would like to try it yourself. ' +
      'And if you want to hear a different presenter, try switching the voice selector above. ' +
      'I hear Leo and Bella are pretty good too. Thanks again, and enjoy the rest of your day.',
  },
];

type Bullet = string | { text: string; sub?: string[] };

export function formatBulletsForPlaintext(bullets: unknown): string {
  if (!Array.isArray(bullets)) return '';
  const rows: string[] = [];
  for (const b of bullets as Bullet[]) {
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

export function formatGlossaryForPlaintext(slide: { glossary?: unknown } | null | undefined): string {
  const g = slide && Array.isArray(slide.glossary) ? (slide.glossary as string[]) : [];
  if (!g.length) return '';
  return `Glossary (this slide):\n${g.map((line) => `- ${line}`).join('\n')}`;
}

/**
 * Pre-validated Mermaid for this deck (in-slide diagram on the eval-loop slide).
 * Keys must match `SLIDE_DIAGRAM_PRESET_KEYS` in `src/stream-tool-tags.ts`.
 */
export const DIAGRAM_PRESETS = {
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
export const DIAGRAM_PRESET_SLIDE_INDEX: Record<keyof typeof DIAGRAM_PRESETS, number> = {
  reinforcement_loop: 6,
};
