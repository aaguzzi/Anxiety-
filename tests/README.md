# Tests

`tests/run.sh` runs everything and ends with `ALL TESTS PASSED` or a list of what failed.

| Folder | What it checks | How |
|---|---|---|
| `web/` | The app as it runs in a browser: Voice & sounds, the player (and its layout on a 320-wide screen and at 200% text), creating and playing meditations, breathing, check-in, the Toolbox exercises (Begin on the first screen, no sideways panning at 200% text, closing screens that open at their top and count the practice, stepping back, buttons that say what they wait for, one colour for main buttons), SOS (every step at 200% text, the SOS button on every screen, the trusted contact's number read the way it was meant), the tab screens (the bar and SOS button stepping aside while typing, the person's own words staying inside their cards, meditations' descriptions in full and the person's own near the top, Home's order and a week with no check-ins, check-in history by month and 60 at a time, readable words, big enough targets, buttons and named fields). | Playwright drives the built app; the Anthropic API is faked. `sos.cjs` also checks `src/lib/phone.ts` directly. |
| `phone/` | The parts that only exist in the Android app, where the phone itself plays the meditation: starting, pausing, a voice failure, the notification-permission wait, a meditation written while the app was off screen. | The same built app, with `fake-phone.js` answering in place of the phone. Its session follows `MeditationSession.java`. |
| `audio/` | The Android sound mixer (`Ambience.java`) and playback session (`MeditationSession.java`) themselves: fades, no clipping, memory released, audio focus, phone calls, unplugged headphones. | The real Java files compiled against small stand-ins for the Android classes (`audio/stubs`), with time running twenty times faster. |

None of this replaces listening on a phone: the stand-ins behave the way Android is documented to,
which is not always the way a particular phone does.

Needs: Node with Playwright and its Chromium, Python 3 with numpy, a JDK.
