/**
 * Pure narrator / PTT predicates for the slides lab.
 * Keeps STT echo guards and mic scheduling testable without DOM or Web Speech.
 */

export const NARRATOR_PHASE = {
  OFF: 'off',
  ARMED: 'armed',
  LISTENING: 'listening',
  COGNITION: 'cognition',
  VOCALIZING: 'vocalizing',
} as const;

export type NarratorPhaseId = (typeof NARRATOR_PHASE)[keyof typeof NARRATOR_PHASE];

export type NarratorSttGuardState = {
  narratorModeActive: boolean;
  narratorProcessing: boolean;
  narratorAudioPhase: NarratorPhaseId;
  /** True when copresenter `Audio` is playing (not paused, not ended). */
  narrationPlaying: boolean;
  /**
   * While `performance.now() < this`, drop STT (speaker tail after Space interrupt).
   * Omit or `0` to disable.
   */
  sttIgnoreResultsUntilPerfMs?: number;
};

/**
 * When true, Web Speech `onresult` must not update `pttAccumulated` or captions.
 * Guards must run before any buffer mutation (order-sensitive).
 */
export function shouldIgnoreSttForPttAccumulation(s: NarratorSttGuardState): boolean {
  const until = s.sttIgnoreResultsUntilPerfMs ?? 0;
  if (until > 0 && performance.now() < until) return true;
  if (s.narrationPlaying) return true;
  if (s.narratorModeActive && s.narratorProcessing) return true;
  if (s.narratorModeActive && s.narratorAudioPhase !== NARRATOR_PHASE.LISTENING) return true;
  return false;
}

export type NarratorMicScheduleState = NarratorSttGuardState & {
  listening: boolean;
};

/**
 * Whether `scheduleRestartNarratorMic` is allowed to eventually call `recognition.start()`.
 * Copresenter turn (`narratorProcessing`) and live TTS never open the mic — avoids STT hearing the speakers.
 * Space interrupt clears `narratorProcessing` before reopening the mic (optionally after a short delay).
 */
export function narratorMayScheduleMicPure(s: NarratorMicScheduleState): boolean {
  if (!s.narratorModeActive || s.listening) return false;
  if (s.narratorProcessing) return false;
  if (s.narrationPlaying) return false;
  if (s.narratorAudioPhase === NARRATOR_PHASE.ARMED) return true;
  if (s.narratorAudioPhase === NARRATOR_PHASE.COGNITION) return true;
  if (s.narratorAudioPhase === NARRATOR_PHASE.VOCALIZING) return true;
  if (s.narratorAudioPhase === NARRATOR_PHASE.LISTENING) return true;
  return false;
}

/**
 * When true, the narrator watchdog may reset a stuck phase to ARMED and reschedule mic.
 */
export function narratorWatchdogShouldRecover(s: NarratorMicScheduleState): boolean {
  if (!s.narratorModeActive) return false;
  if (s.listening || s.narrationPlaying || s.narratorProcessing) return false;
  if (s.narratorAudioPhase === NARRATOR_PHASE.ARMED) return false;
  return true;
}
