/**
 * TextCleaner: maps phoneme strings to token ID sequences.
 *
 * Mirrors the Python KittenTTS TextCleaner symbol table exactly:
 *   pad '$' + punctuation + A-Za-z + IPA characters
 */

// IPA characters used in English phonemization
const IPA_CHARS = [
  'ɪ', 'ʊ', 'ə', 'ɛ', 'æ', 'ʌ', 'ɔ', 'ɑ', 'ː',
  'ɹ', 'ŋ', 'ʃ', 'ʒ', 'θ', 'ð', 'tʃ', 'dʒ',
  'ˈ', 'ˌ', 'ʔ', 'ɾ',
];

// Build the symbol list exactly matching Python's KittenTTS
const _PUNCTUATION = "';:,.!?¡¿—…\"«»\u201C\u201D\u2018\u2019 ";
const _LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

const SYMBOLS = [
  '$',              // 0: pad
  ..._PUNCTUATION,
  ..._LETTERS,
  ...IPA_CHARS,
];

/** Map symbol → index */
const SYMBOL_TO_ID = new Map(SYMBOLS.map((s, i) => [s, i]));

/**
 * Convert a string of phonemes (after espeak output) to a list of token IDs.
 * Unknown characters are silently dropped.
 *
 * The caller should wrap the result with:
 *   [0, ...tokens, 10, 0]
 * (prepend pad, append newline token index, append pad)
 *
 * @param {string} text  — cleaned phoneme string
 * @returns {number[]}
 */
export function textToIds(text) {
  const ids = [];
  // Multi-char IPA digraphs must be checked before single chars
  const multiChar = IPA_CHARS.filter(c => c.length > 1);
  let i = 0;
  while (i < text.length) {
    let matched = false;
    for (const mc of multiChar) {
      if (text.startsWith(mc, i)) {
        const id = SYMBOL_TO_ID.get(mc);
        if (id !== undefined) ids.push(id);
        i += mc.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      const ch = text[i];
      const id = SYMBOL_TO_ID.get(ch);
      if (id !== undefined) ids.push(id);
      i++;
    }
  }
  return ids;
}

/**
 * TextCleaner class — mirrors the Python API.
 */
export class TextCleaner {
  /**
   * Convert phoneme string to padded token ID array ready for the model.
   * Applies padding: [0, ...tokens, 10, 0]
   * @param {string} phonemes
   * @returns {number[]}
   */
  clean(phonemes) {
    const ids = textToIds(phonemes);
    return [0, ...ids, 10, 0];
  }

  /** Expose the full symbol list (useful for debugging). */
  get symbols() {
    return SYMBOLS;
  }

  /** Number of symbols (vocab size). */
  get vocabSize() {
    return SYMBOLS.length;
  }
}
