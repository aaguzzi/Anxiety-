#!/usr/bin/env python3
"""Download the on-device neural voice (sherpa-onnx library, a Piper voice, and the multi-speaker Kokoro and Supertonic 3 models) into the Android project.

These binaries are too large for git, so the Android build needs this run once:
    python3 scripts/fetch-voice.py
"""
import json
import os
import struct
import sys
from array import array
import urllib.parse
import urllib.request

HF = "https://huggingface.co"
LIB_URL = "https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.13.8/sherpa-onnx-1.13.8.aar"
VOICE_REPO = "csukuangfj/vits-piper-en_GB-jenny_dioco-medium"
VOICE_MODEL = "en_GB-jenny_dioco-medium.onnx"

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB_OUT = os.path.join(ROOT, "android/app/libs/sherpa-onnx-1.13.8.aar")
VOICE_OUT = os.path.join(ROOT, "android/app/src/main/assets/voice")
# Full-precision model: the int8 one has audible static and is no faster.
KOKORO_REPO = "csukuangfj/kokoro-multi-lang-v1_0"
KOKORO_FILES = ["model.onnx", "voices.bin", "tokens.txt", "lexicon-us-en.txt"]
KOKORO_OUT = os.path.join(ROOT, "android/app/src/main/assets/voice-kokoro")
SUPERTONIC_REPO = "csukuangfj2/sherpa-onnx-supertonic-3-tts-int8-2026-05-11"
SUPERTONIC_FILES = ["duration_predictor.int8.onnx", "text_encoder.int8.onnx", "vector_estimator.int8.onnx",
                    "tts.json", "unicode_indexer.bin", "voice.bin"]
SUPERTONIC_OUT = os.path.join(ROOT, "android/app/src/main/assets/voice-supertonic")
# The vocoder is the one part where the compressed model is audibly worse (a steady hiss), so the
# full-precision original is used for it. The other parts measure the same either way.
VOCODER_REPO = "Supertone/supertonic-3"
VOCODER_FILE = "onnx/vocoder.onnx"
# Extra voices made by mixing two of the model's ten: (base voice, other voice, share of the other).
# They are appended in this order, so they become voice numbers 10, 11, ...
BLENDS = [
    (4, 0, 0.3),   # Ruth with some of Clara's gentler endings
    (5, 8, 0.4),   # Theo with some of Sam's softer tone
]


def fetch(repo, path, dest):
    fetch_url(f"{HF}/{repo}/resolve/main/{urllib.parse.quote(path)}", dest)


def fetch_url(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    tmp = dest + ".part"
    urllib.request.urlretrieve(url, tmp)
    os.replace(tmp, dest)


def add_blended_voices(path):
    """Appends the BLENDS voices to Supertonic's voice file. Does nothing if they are already there."""
    with open(path, "rb") as f:
        raw = f.read()
    count, a, b, count2, c, d = struct.unpack("<6q", raw[:48])
    if count != 10 or count2 != 10:
        return
    values = array("f")
    values.frombytes(raw[48:])
    if sys.byteorder != "little":
        values.byteswap()
    # Each voice is two style vectors: one for how it sounds, one for its rhythm.
    tone, rhythm = a * b, c * d
    tones = [values[i * tone:(i + 1) * tone] for i in range(count)]
    rhythms = [values[count * tone + i * rhythm:count * tone + (i + 1) * rhythm] for i in range(count)]
    for base, other, share in BLENDS:
        for styles in (tones, rhythms):
            styles.append(array("f", [x * (1 - share) + y * share for x, y in zip(styles[base], styles[other])]))
    out = array("f")
    for style in tones + rhythms:
        out.extend(style)
    if sys.byteorder != "little":
        out.byteswap()
    with open(path + ".part", "wb") as f:
        f.write(struct.pack("<6q", len(tones), a, b, len(rhythms), c, d))
        f.write(out.tobytes())
    os.replace(path + ".part", path)


def tree(repo, path):
    files, url = [], f"{HF}/api/models/{repo}/tree/main/{urllib.parse.quote(path)}?recursive=true&limit=1000"
    while url:
        with urllib.request.urlopen(url) as r:
            files += [e["path"] for e in json.load(r) if e["type"] == "file"]
            link = r.headers.get("Link", "")
            url = link[link.find("<") + 1:link.find(">")] if 'rel="next"' in link else None
    return files


def main():
    print("library ...")
    fetch_url(LIB_URL, LIB_OUT)
    print("voice model ...")
    fetch(VOICE_REPO, VOICE_MODEL, os.path.join(VOICE_OUT, "model.onnx"))
    fetch(VOICE_REPO, "tokens.txt", os.path.join(VOICE_OUT, "tokens.txt"))
    data = tree(VOICE_REPO, "espeak-ng-data")
    print(f"pronunciation data ({len(data)} files) ...")
    for p in data:
        fetch(VOICE_REPO, p, os.path.join(VOICE_OUT, p))
    # Kokoro is supported by the app but not bundled: its voices stress the last word of each
    # sentence, which testers found unsuited to meditation. Pass --kokoro to include it.
    if "--kokoro" in sys.argv:
        print("extra voices (Kokoro) ...")
        for name in KOKORO_FILES:
            fetch(KOKORO_REPO, name, os.path.join(KOKORO_OUT, name))
    print("studio voices (Supertonic 3) ...")
    for name in SUPERTONIC_FILES:
        fetch(SUPERTONIC_REPO, name, os.path.join(SUPERTONIC_OUT, name))
    fetch(VOCODER_REPO, VOCODER_FILE, os.path.join(SUPERTONIC_OUT, "vocoder.onnx"))
    old_vocoder = os.path.join(SUPERTONIC_OUT, "vocoder.int8.onnx")
    if os.path.exists(old_vocoder):
        os.remove(old_vocoder)  # no longer used; don't ship it
    add_blended_voices(os.path.join(SUPERTONIC_OUT, "voice.bin"))
    print("done")


if __name__ == "__main__":
    sys.exit(main())
