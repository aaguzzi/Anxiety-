#!/bin/bash
# Runs the app's real sound mixer and playback session on a desktop, against small stand-ins for
# the Android classes they use (tests/audio/stubs). Time runs twenty times faster than real.
# This proves the logic, not the phone: nothing here is a substitute for listening on a device.
set -e
cd "$(dirname "$0")/../.."
APP=android/app/src/main/java/com/anxietycompanion/app
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
python3 scripts/make-ambience.py >/dev/null   # the real loops, for the "all nine sounds" check
mkdir -p "$WORK/src/com/anxietycompanion/app" "$WORK/out" "$WORK/tmp"
cp -r tests/audio/stubs/. "$WORK/src/"
cp tests/audio/checks/*.java $APP/Ambience.java $APP/MeditationSession.java $APP/Wav.java $APP/VoiceFx.java "$WORK/src/com/anxietycompanion/app/"
unset JAVA_TOOL_OPTIONS
javac -nowarn -d "$WORK/out" $(find "$WORK/src" -name '*.java')
ROOT="$PWD/android/app/src/main/assets/"
java -Dassets.root="$ROOT" -cp "$WORK/out" com.anxietycompanion.app.MixerHarness "$WORK/tmp" | tee "$WORK/mixer.log"
java -Dassets.root="$ROOT" -cp "$WORK/out" com.anxietycompanion.app.SessionChecks | tee "$WORK/session.log"
grep -q "ALL MIXER CHECKS PASSED" "$WORK/mixer.log" && grep -q "ALL SESSION CHECKS PASSED" "$WORK/session.log"
