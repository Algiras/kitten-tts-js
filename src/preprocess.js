/**
 * TextPreprocessor: normalizes raw text before phonemization.
 * Port of KittenTTS preprocess.py.
 */

const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven',
  'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen',
  'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

const SCALE = [
  [1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million'],
  [1e3, 'thousand'], [1e2, 'hundred'],
];

const ORDINAL_SUFFIXES = {
  one: 'first', two: 'second', three: 'third', five: 'fifth',
  eight: 'eighth', nine: 'ninth', twelve: 'twelfth',
};

const CURRENCIES = {
  '$': 'dollar', '€': 'euro', '£': 'pound', '¥': 'yen',
};

const ABBREVIATIONS = {
  'mr.': 'mister', 'mrs.': 'misus', 'dr.': 'doctor', 'prof.': 'professor',
  'sr.': 'senior', 'jr.': 'junior', 'vs.': 'versus', 'etc.': 'et cetera',
  'e.g.': 'for example', 'i.e.': 'that is', 'approx.': 'approximately',
  'dept.': 'department', 'est.': 'established', 'sq.': 'square',
  'st.': 'saint', 'ave.': 'avenue', 'blvd.': 'boulevard',
  'ft.': 'feet', 'in.': 'inches', 'lbs.': 'pounds', 'oz.': 'ounces',
};

/**
 * Convert integer 0–999 to English words.
 */
function threeDigits(n) {
  if (n === 0) return '';
  if (n < 20) return ONES[n];
  if (n < 100) {
    const t = TENS[Math.floor(n / 10)];
    const o = ONES[n % 10];
    return o ? `${t}-${o}` : t;
  }
  const h = ONES[Math.floor(n / 100)];
  const rest = threeDigits(n % 100);
  return rest ? `${h} hundred ${rest}` : `${h} hundred`;
}

/**
 * Convert a non-negative integer to English words.
 */
function intToWords(n) {
  if (n === 0) return 'zero';
  const parts = [];
  for (const [val, name] of SCALE) {
    if (n >= val) {
      parts.push(`${threeDigits(Math.floor(n / val))} ${name}`);
      n = n % val;
    }
  }
  if (n > 0) parts.push(threeDigits(n));
  return parts.join(' ');
}

/**
 * Convert a number (possibly with decimal) to words.
 */
function numberToWords(numStr) {
  const isNeg = numStr.startsWith('-');
  const abs = isNeg ? numStr.slice(1) : numStr;
  const [intPart, fracPart] = abs.split('.');
  const intWords = intToWords(parseInt(intPart, 10) || 0);
  let result = isNeg ? `negative ${intWords}` : intWords;
  if (fracPart !== undefined) {
    const fracDigits = fracPart.split('').map(d => ONES[parseInt(d, 10)] || d).join(' ');
    result += ` point ${fracDigits}`;
  }
  return result;
}

/**
 * Convert to ordinal form (e.g. "twenty-first").
 */
function toOrdinal(n) {
  const words = intToWords(n);
  const parts = words.split('-');
  const last = parts[parts.length - 1];
  const lastWord = last.split(' ').pop();
  const ordinalLast = ORDINAL_SUFFIXES[lastWord]
    || (lastWord.endsWith('t') ? lastWord + 'h'
      : lastWord.endsWith('e') ? lastWord.slice(0, -1) + 'th'
        : lastWord + 'th');
  // Replace last word
  const allWords = words.split(' ');
  allWords[allWords.length - 1] = allWords[allWords.length - 1].replace(lastWord, ordinalLast);
  return allWords.join(' ');
}

export class TextPreprocessor {
  /**
   * Normalize text: expand numbers, currency, abbreviations, etc.
   * @param {string} text
   * @returns {string}
   */
  process(text) {
    let t = text;

    // Remove HTML tags
    t = t.replace(/<[^>]+>/g, ' ');

    // Remove URLs
    t = t.replace(/https?:\/\/\S+/g, '');

    // Remove email addresses
    t = t.replace(/\S+@\S+\.\S+/g, '');

    // Abbreviations (lowercase match)
    const lower = t.toLowerCase();
    for (const [abbr, expansion] of Object.entries(ABBREVIATIONS)) {
      // Case-insensitive replacement preserving boundaries
      t = t.replace(new RegExp(abbr.replace('.', '\\.'), 'gi'), expansion);
    }

    // Currency: $1,234.56 → one thousand two hundred thirty-four dollars and fifty-six cents
    t = t.replace(/([$€£¥])([0-9,]+(?:\.[0-9]{1,2})?)/g, (_, sym, num) => {
      const currency = CURRENCIES[sym] || 'dollar';
      const clean = num.replace(/,/g, '');
      const [whole, cents] = clean.split('.');
      const wholeWords = intToWords(parseInt(whole, 10));
      const plural = parseInt(whole, 10) !== 1 ? `${currency}s` : currency;
      if (cents) {
        const centNum = parseInt(cents.padEnd(2, '0'), 10);
        const centWords = intToWords(centNum);
        return `${wholeWords} ${plural} and ${centWords} cents`;
      }
      return `${wholeWords} ${plural}`;
    });

    // Percentages: 42% → forty-two percent
    t = t.replace(/([0-9]+(?:\.[0-9]+)?)\s*%/g, (_, n) => `${numberToWords(n)} percent`);

    // Time: 3:45 AM → three forty-five A M
    t = t.replace(/\b([0-9]{1,2}):([0-9]{2})\s*(AM|PM|am|pm)?\b/g, (_, h, m, ampm) => {
      const hour = intToWords(parseInt(h, 10));
      const min = parseInt(m, 10) === 0 ? "o'clock" : intToWords(parseInt(m, 10));
      const suffix = ampm ? ' ' + ampm.toUpperCase().split('').join(' ') : '';
      return `${hour} ${min}${suffix}`;
    });

    // Ordinals: 1st, 2nd, 3rd, 4th … → first, second, third, fourth …
    t = t.replace(/\b([0-9]+)(st|nd|rd|th)\b/gi, (_, n) => toOrdinal(parseInt(n, 10)));

    // Plain numbers with commas: 1,234,567 → 1234567 then expand
    t = t.replace(/\b([0-9]{1,3}(?:,[0-9]{3})+)\b/g, n => n.replace(/,/g, ''));

    // Scientific notation: 1.5e6 → one point five million
    t = t.replace(/([0-9]+(?:\.[0-9]+)?)[eE]([+-]?[0-9]+)/g, (_, base, exp) => {
      const val = parseFloat(base) * Math.pow(10, parseInt(exp, 10));
      return numberToWords(String(Math.round(val)));
    });

    // Remaining numbers (integers and decimals)
    t = t.replace(/\b-?[0-9]+(?:\.[0-9]+)?\b/g, n => numberToWords(n));

    // Normalize whitespace
    t = t.replace(/\s+/g, ' ').trim();

    return t;
  }
}
