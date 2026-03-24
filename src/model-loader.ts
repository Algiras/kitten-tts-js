/**
 * model-loader.ts — downloads KittenTTS ONNX model + voices from HuggingFace Hub.
 */

export interface ModelInfo {
  label: string;
}

export interface DownloadResult {
  modelBuffer: ArrayBuffer;
  voicesBuffer: ArrayBuffer;
  config: Record<string, unknown>;
}

const HF_BASE = 'https://huggingface.co';
const CACHE_DIR_NAME = 'kitten-tts';

export const MODELS: Record<string, ModelInfo> = {
  'KittenML/kitten-tts-nano-0.8-int8': { label: 'nano int8 (~24 MB)' },
  'KittenML/kitten-tts-nano-0.8-fp32': { label: 'nano fp32 (~57 MB)' },
  // Legacy alias — HuggingFace redirects this to kitten-tts-nano-0.8-fp32
  'KittenML/kitten-tts-nano-0.8': { label: 'nano fp32 (~57 MB)' },
  'KittenML/kitten-tts-micro-0.8': { label: 'micro (~40 MB)' },
  'KittenML/kitten-tts-mini-0.8': { label: 'mini (~80 MB)' },
  'onnx-community/KittenTTS-Nano-v0.8-ONNX': { label: 'nano fp32 ONNX (~60 MB, WebGPU + WASM)' },
  'onnx-community/KittenTTS-Micro-v0.8-ONNX': { label: 'micro int8 ONNX (~45 MB, WASM only)' },
  'onnx-community/KittenTTS-Mini-v0.8-ONNX': { label: 'mini int8 ONNX (~82 MB, WASM only)' },
};

// ─── Node.js helpers ──────────────────────────────────────────────────────────

let _fs: typeof import('fs') | null = null;
let _path: typeof import('path') | null = null;
let _os: typeof import('os') | null = null;

async function getNodeModules() {
  if (_fs) return { fs: _fs!, path: _path!, os: _os! };
  _fs = await import('fs');
  _path = await import('path');
  _os = await import('os');
  return { fs: _fs, path: _path, os: _os };
}

function isNode(): boolean {
  return typeof process !== 'undefined' && !!process.versions?.node;
}

async function fetchBuffer(url: string): Promise<ArrayBuffer> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${url}`);
  return resp.arrayBuffer();
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

async function nodeCacheGet(cacheKey: string): Promise<ArrayBuffer | null> {
  const { fs, path, os } = await getNodeModules();
  const cacheDir = path.join(os.homedir(), '.cache', CACHE_DIR_NAME);
  const filePath = path.join(cacheDir, cacheKey);
  if (fs.existsSync(filePath)) {
    const buf = fs.readFileSync(filePath);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
  return null;
}

async function nodeCacheSet(cacheKey: string, buffer: ArrayBuffer): Promise<void> {
  const { fs, path, os } = await getNodeModules();
  const cacheDir = path.join(os.homedir(), '.cache', CACHE_DIR_NAME);
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
  const filePath = path.join(cacheDir, cacheKey);
  fs.writeFileSync(filePath, Buffer.from(buffer));
}

async function browserCacheGet(cacheKey: string): Promise<ArrayBuffer | null> {
  if (typeof caches === 'undefined') return null;
  const cache = await caches.open(CACHE_DIR_NAME);
  const resp = await cache.match('/' + cacheKey);
  if (!resp) return null;
  return resp.arrayBuffer();
}

async function browserCacheSet(cacheKey: string, buffer: ArrayBuffer): Promise<void> {
  if (typeof caches === 'undefined') return;
  const cache = await caches.open(CACHE_DIR_NAME);
  await cache.put('/' + cacheKey, new Response(buffer));
}

async function cacheGet(key: string): Promise<ArrayBuffer | null> {
  return isNode() ? nodeCacheGet(key) : browserCacheGet(key);
}

async function cacheSet(key: string, buffer: ArrayBuffer): Promise<void> {
  return isNode() ? nodeCacheSet(key, buffer) : browserCacheSet(key, buffer);
}

// ─── Main download logic ──────────────────────────────────────────────────────

function hfUrl(repoId: string, filename: string): string {
  return `${HF_BASE}/${repoId}/resolve/main/${filename}`;
}

async function fetchCached(repoId: string, filename: string): Promise<ArrayBuffer> {
  const cacheKey = `${repoId.replace('/', '__')}__${filename.replace(/\//g, '_')}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const url = hfUrl(repoId, filename);
  console.log(`[kitten-tts] Downloading ${url} …`);
  const buffer = await fetchBuffer(url);
  await cacheSet(cacheKey, buffer);
  return buffer;
}

async function fetchFirstAvailable(repoId: string, filenames: string[]): Promise<{ buffer: ArrayBuffer; filename: string }> {
  const tried = new Set<string>();
  const errors: string[] = [];

  for (const filename of filenames) {
    if (!filename || tried.has(filename)) continue;
    tried.add(filename);
    try {
      return {
        buffer: await fetchCached(repoId, filename),
        filename,
      };
    } catch (error) {
      const message = String((error as Error)?.message || error);
      if (!message.includes('HTTP 404')) {
        throw error;
      }
      errors.push(`${filename}: ${message}`);
    }
  }

  throw new Error(`None of the candidate files exist for ${repoId}: ${errors.join('; ')}`);
}

function decodeJson(buffer: ArrayBuffer): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(buffer)) as Record<string, unknown>;
}

async function resolveModelConfig(repoId: string): Promise<Record<string, unknown>> {
  const config = decodeJson(await fetchCached(repoId, 'config.json'));
  if (typeof config.model_file === 'string' && config.model_file.length > 0) {
    return config;
  }

  try {
    const kittenConfig = decodeJson(await fetchCached(repoId, 'kitten_config.json'));
    return { ...config, ...kittenConfig };
  } catch (error) {
    throw new Error(
      `No usable model config for ${repoId}. Checked config.json and kitten_config.json.`
        + ` ${String((error as Error)?.message || error)}`
    );
  }
}

export async function downloadModel(repoId: string, opts: Record<string, unknown> = {}): Promise<DownloadResult> {
  void opts;
  if (!MODELS[repoId]) {
    throw new Error(`Unknown model: ${repoId}. Available: ${Object.keys(MODELS).join(', ')}`);
  }

  const config = await resolveModelConfig(repoId);

  const modelFile = config.model_file as string;
  const voicesFile = (config.voices as string) || 'voices.npz';

  if (!modelFile) throw new Error(`Model config missing 'model_file' for ${repoId}`);

  const modelCandidates = [modelFile, `onnx/${modelFile}`, 'onnx/model.onnx'];

  const [{ buffer: modelBuffer }, voicesBuffer] = await Promise.all([
    fetchFirstAvailable(repoId, modelCandidates),
    fetchCached(repoId, voicesFile),
  ]);

  return { modelBuffer, voicesBuffer, config };
}
