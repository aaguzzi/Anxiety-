# Custom meditations: items deferred until after the practicality test

The custom-meditation feature was built first for the owner's own testing. These were deliberately
skipped and must be resolved before the feature ships to other people.

## Safety
- **Crisis prompts.** A prompt that mentions self-harm or suicide currently goes to the model like any
  other. Before release: detect these and show crisis resources (988 / 911, the SOS flow) instead of, or
  alongside, a meditation.
- **Script content rules.** The system prompt asks for an acceptance-based stance and no promise that
  anxiety will go away, but nothing checks the output. Add checks for medical claims, advice to stop
  medication or treatment, and breath-holding instructions without the "skip if uncomfortable" caveat.
- **Not-a-substitute notice** on the Meditate screen and in generated content.
- **Play policy for AI-generated content:** an in-app way to report or flag a generated meditation.

## Privacy
- **Prompts leave the device.** What the user types is sent to Anthropic. The welcome screen and
  privacy policy still say everything stays on the device; both need updating, and the feature should be
  an explicit opt-in. Play's Data safety form must declare it.
- **API key handling.** The key is entered by the user and stored unencrypted in app storage, and the
  app calls the API directly. For release, move script generation behind our own backend (key held
  server-side, rate limits, abuse controls) so users never need a key.
- **Saved meditations** include the user's prompt text in app storage.

## Licensing
- **Voice model.** The bundled Piper voice ("Jenny", en_GB) is trained on the Jenny (Dioco) dataset;
  confirm its licence allows commercial distribution, or switch to a voice with a clear licence.
- **Supertonic 3** (the "studio" voices) and **Kokoro** (the "expressive" voices): confirm each model's
  licence terms for commercial distribution inside an app before release.
- **Kyutai Pocket TTS** was sampled but not shipped: the available on-device export is marked
  non-commercial. It can copy a voice from a short recording, so it is worth revisiting if the licence changes.
- **espeak-ng** (pronunciation data used by the voice library) is GPL-3.0; confirm what that means for
  distributing it inside the app.

## Known functional limits
- **Nothing native has been run on a device by the developer tooling.** Background playback, the
  sound mixer, seeking and resuming part-way were compiled, reviewed twice by independent reviewers,
  and exercised on a desktop against stand-ins for the Android classes (`tests/`, see below).
  Aggressive battery savers (some Samsung, Xiaomi, Huawei phones) may still stop background
  playback; the remedy is exempting the app from battery optimisation.
- **If the natural voice fails mid-session** the player falls back to the phone voice with in-app
  timing, which stops when the screen turns off. If it fails while the app is off screen or paused,
  it waits, paused, and carries on from the same sentence when Resume is pressed.
- **System media controls (Android 13 and later).** Stop is a custom action, so it shows wherever the
  full player is drawn (lock screen, notification shade in portrait) but not in the three-button
  compact player used in landscape. While the first lines are being prepared the main button is a
  spinner with no Pause, as in the app itself.
- **Background sounds are generated, not recorded.** `scripts/make-ambience.py` builds the nine loops
  from shaped noise and tones. They have been checked by measurement (loudness, seamless looping, no
  clicks) but not by ear by the developer tooling; real, clearly licensed recordings of rain, waves
  and a stream would sound more natural and are worth sourcing before release.
- **Background sounds under in-app timing do not ask other apps to be quiet.** A meditation the phone
  plays itself takes the speaker first and then starts its sounds; the fallback that times lines
  from the screen, and the preview in Voice & sounds, just play.
- **Background sounds and the softer voice processing are Android-only.** The web build shows the
  controls but plays neither.
- **Voice softening is set per voice from measurements** (treble relative to Ruth), not by listening.
- **The clock in the player is an estimate** from word counts, so it can drift from the real time.
- **Generated speech is cached per wording.** Rewording a line leaves the old recording in the cache
  folder until Android trims it or the voice engine version changes.
- **Cancelling queued speech is app-wide.** The phone has one cancel counter for all queued lines, so
  Voice & sounds avoids cancelling when it is open over a meditation. Giving each caller its own
  counter would be cleaner.
- **The custom-meditation prompt has been trialled, not listened to.** Test writers produced scripts
  from it for six requests (three to twenty minutes) and judges scored them; it was revised three
  times from what they found. An over-detailed revision (shipped briefly in 1.14) made scripts do the
  exercise that was asked for but read like a procedure. The current one is simpler: the app works
  out a plan for the chosen length (`planFor` in `src/lib/meditationScript.ts`: time for each part,
  led breaths, long silences) and the prompt says what matters most when points pull against each
  other. In a blind ranking against the scripts from the two earlier versions it came first for five
  of six requests and second for the other. Lengths come out within a few percent of what was asked.
  It has not yet been run through the real API in the app, and nobody has listened to a generated
  script.
- **Screens under an open player or panel are not inert.** With a keyboard, and probably a screen
  reader, the tab underneath can still be operated (for example its Voice & sounds card while a
  meditation is playing, which leaves the player unpaused). Making the covered content inert wants
  trying with TalkBack on a device.

## Tests
`tests/run.sh` builds the web app and runs every check: the web app in a browser, the web app against
a stand-in phone (the code paths that only exist on Android), and the real mixer and playback-session
classes on a desktop against stand-ins for the Android classes. They prove the logic, not the phone.

## App size
- The test APK is about 370 MB: the studio voice now uses the full-precision vocoder (101 MB, for a
  cleaner sound) and the background sounds add 35 MB. Google Play limits the base download, so for
  release the voice models need to move to Play Asset Delivery or an in-app download.
