package android.media;
import java.util.*;
import java.util.concurrent.atomic.*;
public class AudioTrack {
    public static final int MODE_STREAM = 1;
    public static final AtomicInteger opened = new AtomicInteger(), released = new AtomicInteger();
    /** All frames written, across tracks, in order (left channel, right channel). */
    public static final Object SINK = new Object();
    public static short[] left = new short[1 << 20], right = new short[1 << 20];
    public static int n;
    public static final List<Integer> trackStarts = new ArrayList<>();
    public static volatile int sleepMicros = 300;
    public static int getMinBufferSize(int r, int c, int f) { return 6000; }
    public static class Builder {
        public Builder setAudioAttributes(AudioAttributes a) { return this; }
        public Builder setAudioFormat(AudioFormat f) { return this; }
        public Builder setBufferSizeInBytes(int b) { return this; }
        public Builder setTransferMode(int m) { return this; }
        public AudioTrack build() { opened.incrementAndGet(); synchronized (SINK) { trackStarts.add(n); } return new AudioTrack(); }
    }
    public void play() {}
    public void pause() {}
    public void flush() {}
    public void release() { released.incrementAndGet(); }
    public int write(short[] d, int off, int len) {
        synchronized (SINK) {
            int frames = len / 2;
            if (n + frames > left.length) { left = Arrays.copyOf(left, left.length * 2); right = Arrays.copyOf(right, right.length * 2); }
            for (int i = 0; i < frames; i++) { left[n] = d[off + 2 * i]; right[n] = d[off + 2 * i + 1]; n++; }
        }
        try { Thread.sleep(sleepMicros / 1000, (sleepMicros % 1000) * 1000); } catch (InterruptedException e) {}
        return len;
    }
}
