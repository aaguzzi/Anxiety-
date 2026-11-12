# Tests

`tests/run.sh` runs everything and ends with `ALL TESTS PASSED` or a list of what failed.

| Folder | What it checks | How |
|---|---|---|
| `web/` | The app as it runs in a browser: Voice & sounds, the player, creating and playing meditations, breathing, check-in, SOS. | Playwright drives the built app; the Anthropic API is faked. |
| `phone/` | The parts that only exist in the Android app, where the phone itself plays the meditation: starting, pausing, a voice failure, the notification-permission wait, a meditation written while the app was off screen. | The same built app, with `fake-phone.js` answering in place of the phone. Its session follows `MeditationSession.java`. |
| `audio/` | The Android sound mixer (`Ambience.java`) and playback session (`MeditationSession.java`) themselves: fades, no clipping, memory released, audio focus, phone calls, unplugged headphones. | The real Java files compiled against small stand-ins for the Android classes (`audio/stubs`), with time running twenty times faster. |

None of this replaces listening on a phone: the stand-ins behave the way Android is documented to,
which is not always the way a particular phone does.

Needs: Node with Playwright and its Chromium, Python 3 with numpy, a JDK.
