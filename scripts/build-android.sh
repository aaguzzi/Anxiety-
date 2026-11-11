#!/usr/bin/env bash
# Builds the Android test APK so that it installs over the previous build.
#
# Android only updates an app in place when it is signed with the same key, so the test signing key
# is kept in a private S3 bucket and restored here when this machine doesn't have it.
# Needs: ANDROID_HOME, and AWS credentials with access to the bucket below.
set -euo pipefail
cd "$(dirname "$0")/.."

KEY="$HOME/.android/debug.keystore"
KEY_BUCKET="${SIGNING_KEY_BUCKET:-anxiety-companion-build-312743357000}"

if [ ! -f "$KEY" ]; then
  mkdir -p "$(dirname "$KEY")"
  aws s3 cp "s3://$KEY_BUCKET/test-signing/debug.keystore" "$KEY" --only-show-errors
  echo "restored signing key"
fi

python3 scripts/fetch-voice.py
npm run build
npx cap sync android
(cd android && ./gradlew assembleDebug --no-daemon -q)
ls -la android/app/build/outputs/apk/debug/app-debug.apk
