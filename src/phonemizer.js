/**
 * Phonemizer: converts text to IPA phonemes via eSpeak-NG (WASM).
 *
 * Uses @echogarden/espeak-ng-emscripten for both Node.js and browser.
 * The WASM instance is lazy-initialized on first call and cached.
 *
 * API (from echogarden source):
 *   const m = await EspeakInitializer();
 *   const instance = new m.eSpeakNGWorker();
 *   const result = instance.synthesize_ipa(text);  // → { ipa: string }
 */

let espeakInstance = null;

/**
 * Lazy-initialize the eSpeak-NG WASM worker instance.
 */
async function getEspeakInstance() {
  if (espeakInstance) return espeakInstance;

  const { default: EspeakInitializer } = await import('@echogarden/espeak-ng-emscripten');
  const m = await EspeakInitializer();
  espeakInstance = new m.eSpeakNGWorker();
  // Default to en-us
  if (typeof espeakInstance.set_voice === 'function') {
    espeakInstance.set_voice('en-us');
  }
  return espeakInstance;
}

/**
 * Tokenize phoneme string the same way KittenTTS Python does:
 *   re.findall(r'\w+|[^\w\s]', text)  →  join with space
 *
 * @param {string} text
 * @returns {string}
 */
export function basicEnglishTokenize(text) {
  const tokens = text.match(/\w+|[^\w\s]/g) || [];
  return tokens.join(' ');
}

/**
 * Phonemize text using eSpeak-NG en-us, returning a tokenized IPA string.
 *
 * @param {string} text  — preprocessed plain text
 * @returns {Promise<string>} — IPA phoneme string, tokenized
 */
export async function phonemize(text) {
  const instance = await getEspeakInstance();

  const result = instance.synthesize_ipa(text);
  const ipa = (result && result.ipa) ? result.ipa : String(result || '');

  return basicEnglishTokenize(ipa);
}
