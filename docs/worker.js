// worker.js
// Dedicated Web Worker for KittenTTS inferences.

let KittenTTS = null;
let tts = null;
let workerQueue = Promise.resolve();

async function handleMessage(type, payload, id) {
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
        // Map everything except explicit `gpu` to `cpu` so older bundles never interpret
        // `auto` as WebGPU, and the main thread always uses the WASM code path for Auto/CPU.
        const runtimeNorm = String(payload.runtime || 'cpu').toLowerCase() === 'gpu' ? 'gpu' : 'cpu';
        const initOpts = {
            runtime: runtimeNorm,
            wasmThreads: payload.wasmThreads,
            wasmSimd: payload.wasmSimd,
        };
        tts = await KittenTTS.from_pretrained(payload.modelId, initOpts);

        self.postMessage({
            type: 'init-done',
            id,
            payload: {
                runtimeRequested: payload.runtime ?? 'auto',
                runtimeActual: tts?.runtime || runtimeNorm,
                executionProviders: tts?.executionProviders || null,
            },
        });
        return;
    }

    if (type === 'generate') {
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
            [exactSizedArr.buffer]
        );
        return;
    }

    if (type === 'generate-stream') {
        if (!tts) throw new Error("TTS Model not loaded yet.");

        const { text, ...opts } = payload;
        let chunkIndex = 0;

        for await (const part of tts.stream(text, opts)) {
            const chunkData = part?.audio?.data || [];
            const exactSizedArr = new Float32Array(chunkData);
            const sampleRate = part?.audio?.sampling_rate || 24000;

            self.postMessage(
                {
                    type: 'generate-stream-chunk',
                    id,
                    payload: {
                        chunkIndex,
                        text: part?.text || '',
                        floatArr: exactSizedArr,
                        sampleRate,
                    },
                },
                [exactSizedArr.buffer]
            );

            chunkIndex += 1;
        }

        self.postMessage({
            type: 'generate-stream-done',
            id,
            payload: { chunks: chunkIndex },
        });
    }
}

// The worker listens for multi-step commands
self.onmessage = async (e) => {
    const { type, payload, id = Date.now() } = e.data;

    workerQueue = workerQueue
        .then(() => handleMessage(type, payload, id))
        .catch((err) => {
            self.postMessage({ type: 'error', id, payload: err.message });
        });

    await workerQueue;
};
