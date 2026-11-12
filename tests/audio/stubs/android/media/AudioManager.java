package android.media;
public class AudioManager {
    public static final String ACTION_AUDIO_BECOMING_NOISY = "noisy";
    public static final int AUDIOFOCUS_GAIN = 1, AUDIOFOCUS_LOSS = -1, AUDIOFOCUS_LOSS_TRANSIENT = -2, AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK = -3, AUDIOFOCUS_REQUEST_GRANTED = 1, AUDIOFOCUS_REQUEST_FAILED = 0, AUDIOFOCUS_REQUEST_DELAYED = 2;
    public volatile AudioFocusRequest waiting;
    public interface OnAudioFocusChangeListener { void onAudioFocusChange(int c); }
    public volatile AudioFocusRequest holder; public volatile int result = AUDIOFOCUS_REQUEST_GRANTED; public int requests, abandons;
    public int requestAudioFocus(AudioFocusRequest r) { requests++; if (result == AUDIOFOCUS_REQUEST_GRANTED) { holder = r; waiting = null; } else if (result == AUDIOFOCUS_REQUEST_DELAYED) waiting = r; return result; }
    public int abandonAudioFocusRequest(AudioFocusRequest r) { abandons++; if (holder == r) holder = null; if (waiting == r) waiting = null; return 1; }
    /** The call ended: whoever was waiting gets the speaker. */
    public boolean grantWaiting() { AudioFocusRequest w = waiting; if (w == null) return false; waiting = null; holder = w; result = AUDIOFOCUS_REQUEST_GRANTED; w.l.onAudioFocusChange(AUDIOFOCUS_GAIN); return true; }
    /** Delivers a change to whoever holds focus, as the system would. */
    public boolean deliver(int c) { AudioFocusRequest h = holder; if (h == null) return false; h.l.onAudioFocusChange(c); return true; }
}
