/**
 * TextCleaner: maps phoneme strings to token ID sequences.
 *
 * Exact port of KittenTTS Python TextCleaner (kittentts/onnx_model.py).
 * Codepoints verified against the raw Python source file.
 *
 * Total symbols: 178  (pad:1  punct:16  letters:52  ipa:109)
 */

// Exact codepoints from Python source:
//   _pad = '$'
//   _punctuation = ';:,.!?¡¿—…"«»""  '   (plain " U+0022, appears 3×)
//   _letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
//   _letters_ipa = "ɑɐɒæ … ↘'\u0329'ᵻ"  (plain ' U+0027 ×2, ᵻ = U+1D7B)

const _pad = '$';
const _punctuation = ';:,.!?\u00A1\u00BF\u2014\u2026\u0022\u00AB\u00BB\u0022\u0022 ';
const _letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const _letters_ipa = "ɑɐɒæɓʙβɔɕçɗɖðʤəɘɚɛɜɝɞɟʄɡɠɢʛɦɧħɥʜɨɪʝɭɬɫɮʟɱɯɰŋɳɲɴøɵɸθœɶʘɹɺɾɻʀʁɽʂʃʈʧʉʊʋⱱʌɣɤʍχʎʏʑʐʒʔʡʕʢǀǁǂǃˈˌːˑʼʴʰʱʲʷˠˤ˞↓↑→↗↘\u0027\u0329\u0027\u1D7B";

export const SYMBOLS = [_pad, ..._punctuation, ..._letters, ..._letters_ipa];

/** Map symbol → index (last occurrence wins, matching Python dict behaviour) */
const SYMBOL_TO_ID = new Map();
SYMBOLS.forEach((s, i) => SYMBOL_TO_ID.set(s, i));

/**
 * Convert a phoneme string to a list of token IDs.
 * Each Unicode code point maps to one token. Unknown chars are dropped.
 *
 * @param {string} text
 * @returns {number[]}
 */
export function textToIds(text) {
  const ids = [];
  for (const ch of text) {
    const id = SYMBOL_TO_ID.get(ch);
    if (id !== undefined) ids.push(id);
  }
  return ids;
}

/**
 * TextCleaner — mirrors the Python API.
 * Padding: [0, ...tokens, 10, 0]
 */
export class TextCleaner {
  clean(phonemes) {
    const ids = textToIds(phonemes);
    return [0, ...ids, 10, 0];
  }

  get symbols() { return SYMBOLS; }
  get vocabSize() { return SYMBOLS.length; }
}
