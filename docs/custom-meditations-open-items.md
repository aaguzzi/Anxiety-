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

## Known functional limits (from the red-team review)
- **Playback stops when the screen locks or the app is in the background.** Lines are timed from the
  app's web layer, which Android suspends. The screen is kept on while playing and playback pauses when
  the app is backgrounded. Proper background playback needs a native foreground service and media session.
- **The native voice plugin has only been compiled, not run on a device here.** If it fails at runtime the
  player falls back to the phone voice.
- **Progress bar** moves per line, so it stands still during long silences.

## App size
- With three voice families bundled the test APK is about 400 MB. Google Play limits the base download,
  so for release the voice models need to move to Play Asset Delivery or an in-app download.
