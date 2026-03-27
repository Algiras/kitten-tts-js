---
name: whisper-tts-eval
description: >-
  Evaluates text-to-speech quality by running Whisper (or compatible STT) on
  synthesized audio and comparing transcripts to reference text — useful for
  regression across commits, golden prompts, and CI-style checks. Triggers:
  tts eval, whisper eval, STT regression, audio transcript check, compare TTS
  output, golden audio, listen-back verification, kitten-tts-js evaluation loop.
---

# Whisper TTS evaluation

Use STT as a **cheap, repeatable codec**: if the transcript drifts for a fixed prompt, something changed (model, code, voice, speed, or export path).

## Workflow

1. **Fix the reference** — One canonical string per test case (include punctuation you care about, or strip both sides consistently).
2. **Synthesize** — Generate WAV (or convert to 16 kHz mono WAV Whisper expects). In this repo: Node example, benchmark scripts, or worker output; write files under `tmp/` or `artifacts/tts-eval/` (gitignored if you add the path).
3. **Transcribe** — Run Whisper on the audio only (no cheating with the reference as prompt unless you intentionally test “prompted STT”).
4. **Normalize** — Lowercase, Unicode NFKC, collapse whitespace, optionally remove punctuation for a lenient pass; keep a strict pass if you need punctuation fidelity.
5. **Score** — Character-level or word-level diff; optional WER. Report: exact match, edit distance, and a short diff snippet.
6. **Gate** — For CI: fail if WER or edit distance exceeds a threshold; store golden hashes or transcripts alongside commits.

## Tooling options (pick what the environment has)

| Stack | Typical command |
|--------|-----------------|
| **openai-whisper** (Python) | `whisper audio.wav --model small --language en --output_format txt` |
| **whisper.cpp** | `./main -m models/ggml-base.en.bin -f audio.wav -otxt` |
| **faster-whisper** | Python API or CLI wrapping CTranslate2 models |

Convert if needed: `ffmpeg -i in.wav -ar 16000 -ac 1 -sample_fmt s16 out.wav`

## Pitfalls

- **Numbers and dates** — Spoken “2024” vs “twenty twenty four” vs digits; align policy with normalization.
- **Hyphens / dashes** — TTS and Whisper often disagree; often ignore for regression.
- **Very short prompts** — STT may hallucinate; prefer sentences ≥ ~8 words for stable checks.
- **Sample rate / clipping** — Silent or clipped audio produces garbage transcripts; optionally check RMS first (this repo’s demo code has signal inspection patterns).

## kitten-tts-js specifics

- Prefer **fixed** `voice`, `speed`, and model id when comparing across commits.
- Reuse **`scripts/benchmark-approaches.mjs`** patterns for timed synthesis; extend with a step that shells out to Whisper or a small Node wrapper.
- Keep eval artifacts **out of** `dist/` and published npm files.

## Output

When asked for a report: table of case id, reference (truncated), transcript (truncated), match boolean, distance/WER, and notes (normalization used).
