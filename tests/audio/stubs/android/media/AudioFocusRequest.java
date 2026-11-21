package android.media;
public class AudioFocusRequest {
    AudioManager.OnAudioFocusChangeListener l;
    public static class Builder {
        AudioFocusRequest r = new AudioFocusRequest();
        public Builder(int gain) {}
        public Builder setAcceptsDelayedFocusGain(boolean b) { return this; }
        public Builder setOnAudioFocusChangeListener(AudioManager.OnAudioFocusChangeListener l) { r.l = l; return this; }
        public AudioFocusRequest build() { return r; }
    }
}
