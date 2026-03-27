#!/usr/bin/env python3
"""Synthesize the same eval clip as tts-eval-synthesize-js.mjs using upstream kittentts."""
from __future__ import annotations

import os
import sys

MODEL_ID = "KittenML/kitten-tts-nano-0.8"
TEXT = "This high-quality TTS model runs without a GPU."
VOICE = "Jasper"
SPEED = 1.0
CLEAN_TEXT = False

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "artifacts", "tts-eval")
OUT_PATH = os.path.join(OUT_DIR, "python.wav")


def main() -> None:
    try:
        from kittentts import KittenTTS
        import soundfile as sf
    except ImportError as e:
        print("Install: pip install soundfile && pip install <kittentts wheel from KittenTTS releases>", file=sys.stderr)
        raise e

    os.makedirs(OUT_DIR, exist_ok=True)
    model = KittenTTS(MODEL_ID)
    audio = model.generate(TEXT, voice=VOICE, speed=SPEED, clean_text=CLEAN_TEXT)
    sf.write(OUT_PATH, audio, 24000)
    print(
        "[tts-eval] Python:",
        {"MODEL_ID": MODEL_ID, "TEXT": TEXT, "VOICE": VOICE, "SPEED": SPEED, "CLEAN_TEXT": CLEAN_TEXT, "OUT_PATH": OUT_PATH},
    )


if __name__ == "__main__":
    main()
