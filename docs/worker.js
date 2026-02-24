// worker.js
// Dedicated Web Worker for KittenTTS inferences.

let KittenTTS = null;
let tts = null;

// The worker listens for multi-step commands
self.onmessage = async (e) => {
    const { type, payload, id = Date.now() } = e.data;

    try {
        if (type === 'init') {
            // 1. Import the pre-built library. In dev, this is the adjacent `bundle.js`.
            // When inlined for standalone, the bundle.js script is pushed to the worker blob FIRST.
            if (!KittenTTS) {
                if (self.__KittenTTS) {
                    KittenTTS = self.__KittenTTS;
                } else {
                    const mod = await import('./bundle.js');
                    KittenTTS = mod.KittenTTS;
                }
            }

            // 2. Download and load the HuggingFace model into ONNX
            tts = await KittenTTS.from_pretrained(payload.modelId);

            self.postMessage({ type: 'init-done', id });
        }
        else if (type === 'generate') {
            if (!tts) throw new Error("TTS Model not loaded yet.");

            const { text, ...opts } = payload;

            // 3. Generate audio using ONNX Runtime Wasm in the background thread
            const audio = await tts.generate(text, opts);

            // audio.data is a Float32Array. We can transfer it to the main thread efficiently.
            const floatArr = audio.data;
            const sampleRate = audio.sampling_rate;

            self.postMessage(
                { type: 'generate-done', id, payload: { floatArr, sampleRate } },
                [floatArr.buffer] // Transfer ownership to avoid copying megabytes
            );
        }
    } catch (err) {
        self.postMessage({ type: 'error', id, payload: err.message });
    }
};
