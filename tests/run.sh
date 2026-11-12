#!/bin/bash
# Runs every check: the web app in a browser, the web app against a stand-in phone, and the
# Android audio code on a desktop. Needs Node with Playwright (and its Chromium), Python 3 with
# numpy, and a JDK. Usage: tests/run.sh [folder for screenshots]
cd "$(dirname "$0")/.."
SHOTS=${1:-$(mktemp -d)}
mkdir -p "$SHOTS"
PORT=4173
fail=0

echo "== Building the web app"
npm run build >/dev/null || exit 1
if ! curl -s -o /dev/null "http://localhost:$PORT/"; then
  npx vite preview --port $PORT --strictPort >/dev/null 2>&1 &
  SERVER=$!
  trap 'kill $SERVER 2>/dev/null' EXIT
  for i in $(seq 1 30); do curl -s -o /dev/null "http://localhost:$PORT/" && break; sleep 0.5; done
fi
export APP_URL="http://localhost:$PORT/"

for t in web/voice-and-sounds web/meditations web/breathing phone/phone; do
  echo "== tests/$t"
  node "tests/$t.cjs" "$SHOTS" > "$SHOTS/$(basename $t).log" 2>&1 || fail=1
  grep -c "^PASS" "$SHOTS/$(basename $t).log" | sed 's/$/ passed/'
  grep -v "^PASS" "$SHOTS/$(basename $t).log"
done

echo "== tests/audio"
bash tests/audio/run.sh > "$SHOTS/audio.log" 2>&1 || fail=1
grep -c "^  ok" "$SHOTS/audio.log" | sed 's/$/ passed/'
grep -E "FAIL|Exception|error:" "$SHOTS/audio.log"

[ $fail = 0 ] && echo "ALL TESTS PASSED" || echo "SOME TESTS FAILED (logs in $SHOTS)"
exit $fail
