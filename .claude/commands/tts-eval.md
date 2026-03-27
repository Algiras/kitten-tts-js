---
description: Run Whisper on TTS audio and compare transcripts to reference text (regression / golden eval)
---

Follow the project skill **whisper-tts-eval** (`.claude/skills/whisper-tts-eval/SKILL.md`): synthesize or locate WAV from kitten-tts-js, run Whisper, normalize text, score vs reference, and summarize. Use the user’s paths, model size, and thresholds if they gave any; otherwise propose sensible defaults and state assumptions.
