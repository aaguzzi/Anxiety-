package android.media;
import android.os.*;
import java.util.*;
public class MediaPlayer {
    public interface OnCompletionListener { void onCompletion(MediaPlayer p); }
    public interface OnErrorListener { boolean onError(MediaPlayer p, int w, int e); }
    public static final List<String> log = Collections.synchronizedList(new ArrayList<>());
    public static volatile long durationMs = 3000; public static int live;
    public static final Set<String> files = Collections.synchronizedSet(new HashSet<>());
    private final Handler h = new Handler(Looper.getMainLooper());
    private OnCompletionListener done; private boolean released; private String src; public float vol = 1f;
    public MediaPlayer() { live++; }
    public void setAudioAttributes(AudioAttributes a) {}
    public void setDataSource(String p) throws java.io.IOException { if (!files.contains(p)) throw new java.io.IOException("missing " + p); src = p; }
    public void setOnCompletionListener(OnCompletionListener l) { done = l; }
    public void setOnErrorListener(OnErrorListener l) {}
    public void prepare() {}
    public void setVolume(float l, float r) { vol = l; }
    private long startedAt = -1;
    public boolean isPlaying() { return !released && startedAt >= 0 && SystemClock.elapsedRealtime() - startedAt < durationOf; }
    public int getDuration() { return (int) durationOf; }
    public int getCurrentPosition() { return (int) Math.min(durationOf, SystemClock.elapsedRealtime() - startedAt); }
    private long durationOf = 0;
    public void start() { startedAt = SystemClock.elapsedRealtime(); durationOf = durationMs; log.add(SystemClock.elapsedRealtime() + " play " + src.substring(src.lastIndexOf('/') + 1)); h.postDelayed(() -> { if (!released && done != null) done.onCompletion(this); }, durationMs); }
    public void release() { if (!released) { released = true; live--; } }
}
