/**
 * TextCleaner: maps phoneme strings to token ID sequences.
 */

const _pad = '$';
const _punctuation = ';:,.!?\u00A1\u00BF\u2014\u2026\u0022\u00AB\u00BB\u0022\u0022 ';
const _letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const _letters_ipa = "ɑɐɒæɓʙβɔɕçɗɖðʤəɘɚɛɜɝɞɟʄɡɠɢʛɦɧħɥʜɨɪʝɭɬɫɮʟɱɯɰŋɳɲɴøɵɸθœɶʘɹɺɾɻʀʁɽʂʃʈʧʉʊʋⱱʌɣɤʍχʎʏʑʐʒʔʡʕʢǀǁǂǃˈˌːˑʼʴʰʱʲʷˠˤ˞↓↑→↗↘\u0027\u0329\u0027\u1D7B";

export const SYMBOLS = [_pad, ..._punctuation, ..._letters, ..._letters_ipa];

const SYMBOL_TO_ID = new Map<string, number>();
SYMBOLS.forEach((s, i) => SYMBOL_TO_ID.set(s, i));

export function basic_english_tokenize(text: string): string[] {
  const pythonWordChar = '\\p{L}\\p{M}\\p{N}_';
  const regex = new RegExp(`[${pythonWordChar}]+|[^${pythonWordChar}\\s]`, 'gu');
  return text.match(regex) || [];
}

export function textToIds(text: string): number[] {
  const ids: number[] = [];
  for (const ch of text) {
    const id = SYMBOL_TO_ID.get(ch);
    if (id !== undefined) ids.push(id);
  }
  return ids;
}

export class TextCleaner {
  clean(phonemes: string): number[] {
    const ids = textToIds(phonemes);
    return [0, ...ids, 10, 0];
  }

  get symbols(): string[] { return SYMBOLS; }
  get vocabSize(): number { return SYMBOLS.length; }
}
