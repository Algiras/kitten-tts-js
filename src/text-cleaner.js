/**
 * TextCleaner: maps phoneme strings to token ID sequences.
 *
 * Exact port of KittenTTS Python TextCleaner symbol table
 * (from kittentts/onnx_model.py).
 *
 * Vocab size: 188 symbols (indices 0–187)
 *   0        : pad '$'
 *   1–16     : punctuation  ';:,.!?¡¿—…"«»"" '
 *   17–68    : A-Za-z (52 letters)
 *   69–187   : IPA characters (119 symbols)
 */

const _pad        = '$';
const _punctuation = ';:,.!?¡¿—…\u201C\u00AB\u00BB\u201C\u201D ';
const _letters    = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const _letters_ipa = "ɑɐɒæɓʙβɔɕçɗɖðʤəɘɚɛɜɝɞɟʄɡɠɢʛɦɧħɥʜɨɪʝɭɬɫɮʟɱɯɰŋɳɲɴøɵɸθœɶʘɹɺɾɻʀʁɽʂʃʈʧʉʊʋⱱʌɣɤʍχʎʏʑʐʒʔʡʕʢǀǁǂǃˈˌːˑʼʴʰʱʲʷˠˤ˞↓↑→↗↘\u0329\u02CC\u1D3B";

export const SYMBOLS = [_pad, ..._punctuation, ..._letters, ..._letters_ipa];

/** Map symbol → index */
const SYMBOL_TO_ID = new Map(SYMBOLS.map((s, i) => [s, i]));

/**
 * Convert a phoneme string to a list of token IDs.
 * Multi-character IPA sequences are NOT used here — each Unicode
 * code point maps to one token, matching the Python implementation.
 * Unknown characters are silently dropped.
 *
 * @param {string} text
 * @returns {number[]}
 */
export function textToIds(text) {
  const ids = [];
  // Iterate by Unicode code point (handles surrogate pairs / multi-byte chars)
  for (const ch of text) {
    const id = SYMBOL_TO_ID.get(ch);
    if (id !== undefined) ids.push(id);
  }
  return ids;
}

/**
 * TextCleaner class — mirrors the Python API.
 */
export class TextCleaner {
  /**
   * Convert a phoneme string to padded token IDs ready for the model.
   * Padding pattern: [0, ...tokens, 10, 0]
   *   - 0  = pad '$'
   *   - 10 = ',' (index 3 in punctuation → overall index 3... wait, see below)
   *
   * Python KittenTTS inserts 0 at start, appends 10 then 0 at end.
   * Token 10 = 'K' (17 + (10-1) = 26)... actually index 10 in the full
   * symbol list = _punctuation[9] = ' ' (space). Let's trust the Python
   * source: tokens.insert(0,0); tokens.append(10); tokens.append(0)
   *
   * @param {string} phonemes
   * @returns {number[]}
   */
  clean(phonemes) {
    const ids = textToIds(phonemes);
    return [0, ...ids, 10, 0];
  }

  get symbols() { return SYMBOLS; }
  get vocabSize() { return SYMBOLS.length; }
}
