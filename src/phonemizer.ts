function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const PUNCTUATION = ';:,.!?¡¿—…"«»""(){}[]';
const PUNCTUATION_PATTERN = new RegExp(`(\\s*[${escapeRegExp(PUNCTUATION)}]+\\s*)+`, 'g');

interface Chunk {
  isPunct: boolean;
  text: string;
}

function splitPreserve(text: string, regex: RegExp): Chunk[] {
  const result: Chunk[] = [];
  let prev = 0;
  for (const match of text.matchAll(regex)) {
    const fullMatch = match[0];
    if (prev < match.index!) {
      result.push({ isPunct: false, text: text.slice(prev, match.index) });
    }
    if (fullMatch.length > 0) {
      result.push({ isPunct: true, text: fullMatch });
    }
    prev = match.index! + fullMatch.length;
  }
  if (prev < text.length) {
    result.push({ isPunct: false, text: text.slice(prev) });
  }
  return result;
}

export async function phonemize(text: string): Promise<string> {
  const { phonemize: espeakng } = await import('phonemizer');
  const chunks = splitPreserve(text, PUNCTUATION_PATTERN);
  let out = '';

  for (const chunk of chunks) {
    if (chunk.isPunct) {
      out += chunk.text;
      continue;
    }
    const part = chunk.text.trim();
    if (!part) {
      out += chunk.text;
      continue;
    }
    const result = await espeakng(part, 'en-us');
    const ipa = result && result[0] ? result[0] : '';
    out += ipa;
  }

  return out.trim();
}
