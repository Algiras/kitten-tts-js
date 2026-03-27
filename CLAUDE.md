# Claude Code — kitten-tts-js

## TTS evaluation skill

This repo includes **whisper-tts-eval**: use Whisper (or compatible STT) on **synthesized** audio and compare transcripts to **reference text** for regression checks across commits.

- Skill path: `.claude/skills/whisper-tts-eval/SKILL.md` (also mirrored for Cursor at `.cursor/skills/whisper-tts-eval/SKILL.md`).

## Browser verification skill

**kitten-tts-browser** covers real-browser checks for ORT Web / WASM, `worker.js`, `docs/` demos, and `slides.html` (Playwright or browser agent / MCP).

- Skill path: `.claude/skills/kitten-tts-browser/SKILL.md` (Cursor: `.cursor/skills/kitten-tts-browser/SKILL.md`).

## Slash command aliases (Claude Code)

| Command         | Purpose                                      |
|-----------------|----------------------------------------------|
| `/tts-eval`     | Run the Whisper ↔ reference eval workflow    |
| `/whisper-eval` | Same as `/tts-eval`                          |
| `/browser-check`| Browser smoke: docs demo + optional slides lab |
| `/tts-browser`  | Same as `/browser-check`                     |

## Natural-language aliases

- **whisper-tts-eval**: *tts eval*, *whisper eval*, *STT regression*, *golden audio*, *transcript check* on TTS output, *listen-back* verification, *compare synthesized speech to text*.
- **kitten-tts-browser**: *browser test TTS*, *Playwright*, *slides lab smoke*, *WASM ORT Web*, *docs demo*, *ORT in browser*, *fullscreen slides*.
