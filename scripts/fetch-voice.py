#!/usr/bin/env python3
"""Download the on-device neural voice (sherpa-onnx library + Piper model) into the Android project.

These binaries are too large for git, so the Android build needs this run once:
    python3 scripts/fetch-voice.py
"""
import json
import os
import sys
import urllib.parse
import urllib.request

HF = "https://huggingface.co"
LIB_REPO = "csukuangfj/sherpa-onnx-libs"
LIB_PATH = "android/aar/1.12.21/sherpa-onnx-static-link-onnxruntime-1.12.21.aar"
VOICE_REPO = "csukuangfj/vits-piper-en_GB-jenny_dioco-medium"
VOICE_MODEL = "en_GB-jenny_dioco-medium.onnx"

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB_OUT = os.path.join(ROOT, "android/app/libs/sherpa-onnx.aar")
VOICE_OUT = os.path.join(ROOT, "android/app/src/main/assets/voice")


def fetch(repo, path, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    url = f"{HF}/{repo}/resolve/main/{urllib.parse.quote(path)}"
    tmp = dest + ".part"
    urllib.request.urlretrieve(url, tmp)
    os.replace(tmp, dest)


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
    fetch(LIB_REPO, LIB_PATH, LIB_OUT)
    print("voice model ...")
    fetch(VOICE_REPO, VOICE_MODEL, os.path.join(VOICE_OUT, "model.onnx"))
    fetch(VOICE_REPO, "tokens.txt", os.path.join(VOICE_OUT, "tokens.txt"))
    data = tree(VOICE_REPO, "espeak-ng-data")
    print(f"pronunciation data ({len(data)} files) ...")
    for p in data:
        fetch(VOICE_REPO, p, os.path.join(VOICE_OUT, p))
    print("done")


if __name__ == "__main__":
    sys.exit(main())
