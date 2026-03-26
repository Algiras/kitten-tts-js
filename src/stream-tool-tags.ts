/**
 * Slide tool metadata, TTS stripping, and XML parsing helpers.
 * Stage execution uses Ollama native `tool_calls` (see slides-ollama-assistant.ts).
 * `stripToolBlocksForSpeech` / `parseToolsInner` remain for tests and for removing
 * accidental `<tools>…</tools>` from assistant text before speech.
 */

export type StreamToolCall = {
  function: { name: string; arguments: Record<string, unknown> };
};

/**
 * Mermaid preset keys for `diagram_${key}` tools.
 * Must match `Object.keys(DIAGRAM_PRESETS)` in `src/slides-lab-main.ts`.
 */
export const SLIDE_DIAGRAM_PRESET_KEYS = [
  'live_stack',
  'reinforcement_loop',
  'scoring_flow',
] as const;

export type SlideDiagramPresetKey = (typeof SLIDE_DIAGRAM_PRESET_KEYS)[number];

const SLIDE_NON_DIAGRAM_TOOLS = [
  'highlight_text',
  'emphasize_bullet',
  'go_to_slide',
  'set_voice',
  'show_overlay',
  'fireworks',
] as const;

/**
 * Execution order for native Ollama tool batches (and embedded `<tools>` blocks).
 * Navigation and voice first; diagrams after overlays so `go_to_slide` → `renderSlide` does not
 * wipe effects from tools that ran earlier in the same batch.
 */
export const SLIDE_TOOL_RUN_ORDER: readonly string[] = [
  'go_to_slide',
  'set_voice',
  'highlight_text',
  'emphasize_bullet',
  'show_overlay',
  ...SLIDE_DIAGRAM_PRESET_KEYS.map((k) => `diagram_${k}`),
  'fireworks',
];

/** Sort key for tool name: lower index runs first; unknown tools last. */
export function slideToolCallSortKey(name: string): number {
  const n = String(name || '').trim().toLowerCase();
  const i = SLIDE_TOOL_RUN_ORDER.indexOf(n);
  return i === -1 ? 100 : i;
}

/**
 * Closed set the deck runtime implements; anything else is ignored (no error).
 * `diagram_*` entries are derived from SLIDE_DIAGRAM_PRESET_KEYS.
 */
export const SLIDE_TOOL_NAMES = new Set<string>([
  ...SLIDE_NON_DIAGRAM_TOOLS,
  ...SLIDE_DIAGRAM_PRESET_KEYS.map((k) => `diagram_${k}`),
]);

export function isKnownSlideTool(name: string): boolean {
  return SLIDE_TOOL_NAMES.has(String(name || '').trim().toLowerCase());
}

/** Dedupe repeated identical native tool calls in one assistant turn. */
export function stableToolCallFingerprint(call: StreamToolCall): string {
  const name = String(call.function?.name ?? '').trim().toLowerCase();
  const raw = call.function?.arguments;
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const keys = Object.keys(obj).sort();
  const sorted: Record<string, unknown> = {};
  for (const k of keys) sorted[k] = obj[k];
  return `${name}\0${JSON.stringify(sorted)}`;
}

/** Remove complete <tools>…</tools> blocks and trailing unclosed <tools… opener. */
export function stripToolBlocksForSpeech(raw: string): string {
  let s = raw.replace(/<tools\b[^>]*>[\s\S]*?<\/tools>/gi, '');
  const open = s.search(/<tools\b/i);
  if (open !== -1) {
    const tail = s.slice(open);
    if (!/<\/tools>/i.test(tail)) s = s.slice(0, open);
  }
  return s;
}

/** All complete <tools> inner payloads in order of appearance. */
export function extractToolsInnerBlocks(raw: string): string[] {
  const out: string[] = [];
  const re = /<tools\b[^>]*>([\s\S]*?)<\/tools>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    out.push(m[1].trim());
  }
  return out;
}

export function parseAttrString(attrRegion: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([\w.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrRegion)) !== null) {
    out[m[1]] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return out;
}

const NUMERIC_ATTR_KEYS = new Set(['slide_number', 'index', 'duration_seconds']);

function attrsToArgs(attrs: Record<string, string>): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'name') continue;
    if (v === '') {
      args[k] = v;
      continue;
    }
    if (NUMERIC_ATTR_KEYS.has(k)) {
      const n = Number(v);
      args[k] = Number.isFinite(n) ? n : v;
    } else {
      args[k] = v;
    }
  }
  return args;
}

/**
 * Parse one <tools> inner XML fragment into tool calls (self-closing or body form).
 */
export function parseToolsInner(inner: string): StreamToolCall[] {
  const calls: StreamToolCall[] = [];
  let pos = 0;
  const src = inner;

  while (pos < src.length) {
    const start = src.indexOf('<tool', pos);
    if (start === -1) break;

    const selfClose = src.indexOf('/>', start);
    const gt = src.indexOf('>', start);

    if (selfClose !== -1 && (gt === -1 || selfClose < gt)) {
      const tagSlice = src.slice(start, selfClose + 2);
      const attrPart = tagSlice.replace(/^<tool\b/i, '').replace(/\s*\/>$/, '').trim();
      const attrs = parseAttrString(attrPart);
      const name = attrs.name?.trim();
      if (name) {
        calls.push({ function: { name, arguments: attrsToArgs(attrs) } });
      }
      pos = selfClose + 2;
      continue;
    }

    if (gt === -1) break;

    const openTag = src.slice(start, gt + 1);
    const attrPart = openTag.replace(/^<tool\b/i, '').replace(/>$/, '').trim();
    const attrs = parseAttrString(attrPart);
    const name = attrs.name?.trim();
    if (!name) {
      pos = gt + 1;
      continue;
    }

    const endTagStart = src.indexOf('</tool', gt + 1);
    if (endTagStart === -1) {
      pos = gt + 1;
      continue;
    }
    const endGt = src.indexOf('>', endTagStart);
    if (endGt === -1) {
      pos = gt + 1;
      continue;
    }

    const body = src.slice(gt + 1, endTagStart).trim();
    const args = attrsToArgs(attrs);
    if (body) {
      if (name === 'show_overlay') args.text = body;
      else args.content = body;
    }
    calls.push({ function: { name, arguments: args } });
    pos = endGt + 1;
  }

  return calls;
}
