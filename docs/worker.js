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
                const mod = await import('./bundle.js');
                KittenTTS = mod.KittenTTS;
            }

            // 2. Clear old model memory if one exists, then download and load the HuggingFace model into ONNX
            if (tts && typeof tts.release === 'function') {
                await tts.release();
            }
            tts = await KittenTTS.from_pretrained(payload.modelId);

            self.postMessage({ type: 'init-done', id });
        }
        else if (type === 'generate') {
            if (!tts) throw new Error("TTS Model not loaded yet.");

            const { text, ...opts } = payload;

            // 3. Generate audio using ONNX Runtime Wasm in the background thread
            const audio = await tts.generate(text, opts);

            // Create a perfectly sized copy of the array because the underlying .buffer 
            // from ONNX Runtime often contains trailing unallocated WASM memory (silence)
            const exactSizedArr = new Float32Array(audio.data);
            const sampleRate = audio.sampling_rate;

            self.postMessage(
                { type: 'generate-done', id, payload: { floatArr: exactSizedArr, sampleRate } },
                [exactSizedArr.buffer] // Transfer ownership of the copied buffer
            );
        }
    } catch (err) {
        self.postMessage({ type: 'error', id, payload: err.message });
    }
};
