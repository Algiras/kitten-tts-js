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
  const cleaned = text.replace(/_/g, '');
  const tokens = cleaned.match(/[\p{L}\p{M}\p{N}_]+|[^\p{L}\p{M}\p{N}_\s]/gu) || [];
  return tokens.join(' ');
}

export async function phonemize(text) {
  const instance = await getEspeakInstance();

  const result = instance.synthesize_ipa(text);
  const ipa = (result && result.ipa) ? result.ipa : String(result || '');

  const rawTokens = text.match(/[\p{L}\p{M}\p{N}_]+|[^\p{L}\p{M}\p{N}_\s]/gu) || [];
  const cleanedIpa = ipa.replace(/_/g, '').replace(/\n/g, ' ');
  const ipaTokens = cleanedIpa.match(/[\p{L}\p{M}\p{N}_]+|[^\p{L}\p{M}\p{N}_\s]/gu) || [];

  let out = [];
  let ipaIdx = 0;

  for (const token of rawTokens) {
    if (token.match(/^[\p{L}\p{M}\p{N}_]+$/u)) {
      if (ipaIdx < ipaTokens.length) {
        out.push(ipaTokens[ipaIdx]);
        ipaIdx++;
      } else {
        out.push(token);
      }
    } else {
      out.push(token);
    }
  }

  return out.join(' ');
}
