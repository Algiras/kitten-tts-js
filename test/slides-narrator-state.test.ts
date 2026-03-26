import { strict as assert } from 'assert';
import { test } from 'node:test';
import {
  NARRATOR_PHASE,
  narratorMayScheduleMicPure,
  narratorWatchdogShouldRecover,
  shouldIgnoreSttForPttAccumulation,
} from '../src/slides-narrator-state.js';

const P = NARRATOR_PHASE;

test('STT: accept only when narrator on, LISTENING, not processing, not playing', () => {
  assert.equal(
    shouldIgnoreSttForPttAccumulation({
      narratorModeActive: true,
      narratorProcessing: false,
      narratorAudioPhase: P.LISTENING,
      narrationPlaying: false,
    }),
    false,
  );
});

test('STT: ignore while TTS element is playing even if phase is LISTENING', () => {
  assert.equal(
    shouldIgnoreSttForPttAccumulation({
      narratorModeActive: true,
      narratorProcessing: false,
      narratorAudioPhase: P.LISTENING,
      narrationPlaying: true,
    }),
    true,
  );
});

test('STT: ignore during assistant turn (processing) even in LISTENING — inter-sentence TTS gaps', () => {
  assert.equal(
    shouldIgnoreSttForPttAccumulation({
      narratorModeActive: true,
      narratorProcessing: true,
      narratorAudioPhase: P.LISTENING,
      narrationPlaying: false,
    }),
    true,
  );
});

test('STT: ignore when not in LISTENING (COGNITION / VOCALIZING / ARMED)', () => {
  for (const phase of [P.COGNITION, P.VOCALIZING, P.ARMED, P.OFF] as const) {
    assert.equal(
      shouldIgnoreSttForPttAccumulation({
        narratorModeActive: true,
        narratorProcessing: false,
        narratorAudioPhase: phase,
        narrationPlaying: false,
      }),
      true,
      `phase ${phase}`,
    );
  }
});

test('STT: ignore during post-interrupt echo tail window', () => {
  const future = performance.now() + 60_000;
  assert.equal(
    shouldIgnoreSttForPttAccumulation({
      narratorModeActive: true,
      narratorProcessing: false,
      narratorAudioPhase: P.LISTENING,
      narrationPlaying: false,
      sttIgnoreResultsUntilPerfMs: future,
    }),
    true,
  );
  assert.equal(
    shouldIgnoreSttForPttAccumulation({
      narratorModeActive: true,
      narratorProcessing: false,
      narratorAudioPhase: P.LISTENING,
      narrationPlaying: false,
      sttIgnoreResultsUntilPerfMs: performance.now() - 1,
    }),
    false,
  );
});

test('STT: narrator off — only block when narration still playing (read-aloud without narrator lane)', () => {
  assert.equal(
    shouldIgnoreSttForPttAccumulation({
      narratorModeActive: false,
      narratorProcessing: false,
      narratorAudioPhase: P.ARMED,
      narrationPlaying: false,
    }),
    false,
  );
  assert.equal(
    shouldIgnoreSttForPttAccumulation({
      narratorModeActive: false,
      narratorProcessing: false,
      narratorAudioPhase: P.ARMED,
      narrationPlaying: true,
    }),
    true,
  );
});

test('mic schedule: false when narrator off or recognition already listening', () => {
  assert.equal(
    narratorMayScheduleMicPure({
      narratorModeActive: false,
      listening: false,
      narrationPlaying: false,
      narratorProcessing: false,
      narratorAudioPhase: P.ARMED,
    }),
    false,
  );
  assert.equal(
    narratorMayScheduleMicPure({
      narratorModeActive: true,
      listening: true,
      narrationPlaying: false,
      narratorProcessing: false,
      narratorAudioPhase: P.ARMED,
    }),
    false,
  );
});

test('mic schedule: ARMED and idle allows restart', () => {
  assert.equal(
    narratorMayScheduleMicPure({
      narratorModeActive: true,
      listening: false,
      narrationPlaying: false,
      narratorProcessing: false,
      narratorAudioPhase: P.ARMED,
    }),
    true,
  );
});

test('mic schedule: ARMED but assistant still processing — do not schedule', () => {
  assert.equal(
    narratorMayScheduleMicPure({
      narratorModeActive: true,
      listening: false,
      narrationPlaying: false,
      narratorProcessing: true,
      narratorAudioPhase: P.ARMED,
    }),
    false,
  );
});

test('mic schedule: COGNITION / VOCALIZING without playback allow schedule only when not processing', () => {
  assert.equal(
    narratorMayScheduleMicPure({
      narratorModeActive: true,
      listening: false,
      narrationPlaying: false,
      narratorProcessing: true,
      narratorAudioPhase: P.COGNITION,
    }),
    false,
  );
  assert.equal(
    narratorMayScheduleMicPure({
      narratorModeActive: true,
      listening: false,
      narrationPlaying: false,
      narratorProcessing: false,
      narratorAudioPhase: P.COGNITION,
    }),
    true,
  );
  assert.equal(
    narratorMayScheduleMicPure({
      narratorModeActive: true,
      listening: false,
      narrationPlaying: false,
      narratorProcessing: false,
      narratorAudioPhase: P.VOCALIZING,
    }),
    true,
  );
});

test('mic schedule: never while TTS element is playing', () => {
  for (const phase of [P.VOCALIZING, P.COGNITION] as const) {
    assert.equal(
      narratorMayScheduleMicPure({
        narratorModeActive: true,
        listening: false,
        narrationPlaying: true,
        narratorProcessing: false,
        narratorAudioPhase: phase,
      }),
      false,
      `phase ${phase}`,
    );
  }
});

test('watchdog: recover only when stuck in non-ARMED with no active work', () => {
  assert.equal(
    narratorWatchdogShouldRecover({
      narratorModeActive: true,
      listening: false,
      narrationPlaying: false,
      narratorProcessing: false,
      narratorAudioPhase: P.COGNITION,
    }),
    true,
  );
  assert.equal(
    narratorWatchdogShouldRecover({
      narratorModeActive: true,
      listening: false,
      narrationPlaying: false,
      narratorProcessing: false,
      narratorAudioPhase: P.ARMED,
    }),
    false,
  );
  assert.equal(
    narratorWatchdogShouldRecover({
      narratorModeActive: false,
      listening: false,
      narrationPlaying: false,
      narratorProcessing: false,
      narratorAudioPhase: P.COGNITION,
    }),
    false,
  );
  assert.equal(
    narratorWatchdogShouldRecover({
      narratorModeActive: true,
      listening: true,
      narrationPlaying: false,
      narratorProcessing: false,
      narratorAudioPhase: P.LISTENING,
    }),
    false,
  );
  assert.equal(
    narratorWatchdogShouldRecover({
      narratorModeActive: true,
      listening: false,
      narrationPlaying: true,
      narratorProcessing: false,
      narratorAudioPhase: P.VOCALIZING,
    }),
    false,
  );
  assert.equal(
    narratorWatchdogShouldRecover({
      narratorModeActive: true,
      listening: false,
      narrationPlaying: false,
      narratorProcessing: true,
      narratorAudioPhase: P.COGNITION,
    }),
    false,
  );
});
