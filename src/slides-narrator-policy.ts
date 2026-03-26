/**
 * Narrator interrupt + turn policy for the slides lab (barge-in / turn-taking).
 * Used by `slides-lab-main.ts` and unit tests.
 */

const DEFAULT_FILLER = new Set(['um', 'uh', 'erm', 'er', 'mm', 'hmm', 'uhh', 'umm']);

export interface NarratorInterruptPreset {
  id: string;
  interimMinChars: number;
  interimMinWords: number;
  finalMinChars: number;
  finalMinWords: number;
  allowSingleLongWord: boolean;
  longWordMinChars: number;
  shortFinalAllowlist: string[];
  fillerTokens: string[];
  finalDebounceMs: number;
  restartMicAfterTurnMs: number;
  restartMicAfterTurnWhileSpeakingMs: number;
  restartMicOnEndListeningMs: number;
  restartMicOnEndArmedMs: number;
  restartMicAfterBargeInScheduleMs: number;
  restartMicNoSpeechErrorMs: number;
  restartMicOtherErrorMs: number;
  restartMicNarrateBlockedMs: number;
  restartMicNarrateEndedMs: number;
  restartMicNarrateDuringMs: number;
  restartMicNarrateCatchMs: number;
}

export const NARRATOR_INTERRUPT_PRESETS: Record<string, NarratorInterruptPreset> = {
  demo: {
    id: 'demo',
    interimMinChars: 4,
    interimMinWords: 1,
    finalMinChars: 2,
    finalMinWords: 1,
    allowSingleLongWord: true,
    longWordMinChars: 4,
    shortFinalAllowlist: ['ok', 'no', 'yes', 'go', 'wait', 'stop', 'yeah', 'yep', 'nah', 'hey', 'hi', 'hello', 'thanks', 'next', 'back'],
    fillerTokens: [...DEFAULT_FILLER],
    finalDebounceMs: 0,
    restartMicAfterTurnMs: 400,
    restartMicAfterTurnWhileSpeakingMs: 200,
    restartMicOnEndListeningMs: 150,
    restartMicOnEndArmedMs: 150,
    restartMicAfterBargeInScheduleMs: 120,
    restartMicNoSpeechErrorMs: 250,
    restartMicOtherErrorMs: 500,
    restartMicNarrateBlockedMs: 250,
    restartMicNarrateEndedMs: 150,
    restartMicNarrateDuringMs: 200,
    restartMicNarrateCatchMs: 300,
  },
  balanced: {
    id: 'balanced',
    interimMinChars: 5,
    interimMinWords: 2,
    finalMinChars: 2,
    finalMinWords: 1,
    allowSingleLongWord: true,
    longWordMinChars: 12,
    shortFinalAllowlist: ['ok', 'no', 'yes', 'go', 'wait', 'stop', 'yeah', 'yep', 'nah', 'hey', 'hi', 'hello', 'thanks', 'next', 'back'],
    fillerTokens: [...DEFAULT_FILLER],
    finalDebounceMs: 0,
    restartMicAfterTurnMs: 600,
    restartMicAfterTurnWhileSpeakingMs: 250,
    restartMicOnEndListeningMs: 200,
    restartMicOnEndArmedMs: 200,
    restartMicAfterBargeInScheduleMs: 150,
    restartMicNoSpeechErrorMs: 350,
    restartMicOtherErrorMs: 600,
    restartMicNarrateBlockedMs: 300,
    restartMicNarrateEndedMs: 180,
    restartMicNarrateDuringMs: 250,
    restartMicNarrateCatchMs: 350,
  },
  conservative: {
    id: 'conservative',
    interimMinChars: 6,
    interimMinWords: 3,
    finalMinChars: 2,
    finalMinWords: 2,
    allowSingleLongWord: true,
    longWordMinChars: 12,
    shortFinalAllowlist: ['ok', 'no', 'yes', 'go', 'wait', 'stop', 'yeah', 'yep', 'nah', 'hey', 'hi', 'hello', 'thanks'],
    fillerTokens: [...DEFAULT_FILLER],
    finalDebounceMs: 0,
    restartMicAfterTurnMs: 1000,
    restartMicAfterTurnWhileSpeakingMs: 300,
    restartMicOnEndListeningMs: 250,
    restartMicOnEndArmedMs: 250,
    restartMicAfterBargeInScheduleMs: 180,
    restartMicNoSpeechErrorMs: 400,
    restartMicOtherErrorMs: 700,
    restartMicNarrateBlockedMs: 350,
    restartMicNarrateEndedMs: 220,
    restartMicNarrateDuringMs: 300,
    restartMicNarrateCatchMs: 400,
  },
};

export function tokenizeForPolicy(raw: string, preset: NarratorInterruptPreset): string[] {
  const t = String(raw || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!t) return [];
  const filler = new Set((preset.fillerTokens || []).map((x) => String(x).toLowerCase()));
  return t
    .split(' ')
    .map((w) => w.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').toLowerCase())
    .filter((w) => w.length > 0 && !filler.has(w));
}

export function transcriptMetrics(raw: string, preset: NarratorInterruptPreset) {
  const trimmed = String(raw || '')
    .trim()
    .replace(/\s+/g, ' ');
  const words = tokenizeForPolicy(trimmed, preset);
  return {
    trimmed,
    charCount: trimmed.length,
    wordCount: words.length,
  };
}

export function evaluateInterimHardInterrupt(trimmedLive: string, preset: NarratorInterruptPreset): boolean {
  const { charCount, wordCount, trimmed } = transcriptMetrics(trimmedLive, preset);
  if (!trimmed || charCount < preset.interimMinChars) return false;
  if (wordCount >= preset.interimMinWords) return true;
  const spaceTokens = trimmed.split(' ').filter(Boolean);
  if (
    preset.allowSingleLongWord &&
    spaceTokens.length === 1 &&
    trimmed.length >= preset.longWordMinChars
  ) {
    return true;
  }
  return false;
}

export function shouldStartTurnFromFinal(transcript: string, preset: NarratorInterruptPreset): boolean {
  const { charCount, wordCount, trimmed } = transcriptMetrics(transcript, preset);
  if (!trimmed || charCount < preset.finalMinChars) return false;
  const lower = trimmed.toLowerCase();
  if (preset.shortFinalAllowlist?.some((s) => lower === s || lower.startsWith(`${s} `))) return true;
  if (wordCount >= preset.finalMinWords) return true;
  if (preset.allowSingleLongWord && wordCount <= 1 && charCount >= preset.longWordMinChars) return true;
  return false;
}

export function resolveNarratorPreset(key: string | null | undefined): NarratorInterruptPreset {
  const k = String(key || 'balanced').toLowerCase();
  if (k === 'demo' || k === 'balanced' || k === 'conservative') {
    return NARRATOR_INTERRUPT_PRESETS[k];
  }
  return NARRATOR_INTERRUPT_PRESETS.balanced;
}
