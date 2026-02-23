/**
 * Phonemizer: converts text to IPA phonemes via eSpeak-NG (WASM).
 *
 * Uses @echogarden/espeak-ng-emscripten for both Node.js and browser —
 * a single WASM backend that works everywhere.
 *
 * The WASM instance is lazy-initialized on first call and cached.
 */

let espeakModule = null;

/**
 * Lazy-initialize the eSpeak-NG WASM module.
 */
async function getEspeak() {
  if (espeakModule) return espeakModule;

  const { default: initEspeak } = await import('@echogarden/espeak-ng-emscripten');
  espeakModule = await initEspeak();
  return espeakModule;
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
 * Phonemize text using eSpeak-NG en-us.
 *
 * @param {string} text  — preprocessed plain text
 * @returns {Promise<string>} — IPA phoneme string, tokenized
 */
export async function phonemize(text) {
  const espeak = await getEspeak();

  // synthesizeSpeech returns { phonemes, ... } (or use phonemizeText if available)
  let phonemes;
  if (typeof espeak.phonemizeText === 'function') {
    phonemes = await espeak.phonemizeText(text, {
      language: 'en-us',
      useStress: true,
      preservePunctuation: true,
    });
  } else if (typeof espeak.synthesizeSpeech === 'function') {
    const result = await espeak.synthesizeSpeech(text, {
      language: 'en-us',
      outputType: 'phonemes',
      useStress: true,
      preservePunctuation: true,
    });
    phonemes = result.phonemes || result.transcript || '';
  } else {
    throw new Error('eSpeak-NG module does not expose phonemize/synthesize API');
  }

  return basicEnglishTokenize(phonemes);
}
