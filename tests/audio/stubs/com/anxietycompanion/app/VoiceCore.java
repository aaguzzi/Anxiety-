package com.anxietycompanion.app;
import android.content.Context;
import java.io.File;
import java.util.*;
import java.util.concurrent.*;
final class VoiceCore {
    static final class Spec {
        final String model; final int sid; final float speed; final int steps; final float softness; final float space;
        Spec(String model, int sid, float speed, int steps, float softness, float space) { this.model = model; this.sid = sid; this.speed = speed; this.steps = steps;
            this.softness = Math.max(0f, Math.min(1f, softness)); this.space = Math.max(0f, Math.min(1f, space)); }
        boolean processed() { return softness > 0f || space > 0f; }
        long tailMs() { return space > 0f ? Math.round(VoiceFx.tailSeconds(space) * 1000) : 0; }
    }
    static final ExecutorService WORKER = Executors.newSingleThreadExecutor(r -> { Thread t = new Thread(r, "worker"); t.setDaemon(true); return t; });
    static final List<String> log = Collections.synchronizedList(new ArrayList<>());
    static volatile long genMs = 1500; static volatile String failOn = null;
    static boolean bundled(Context c, String dir, String file) { return true; }
    static File playFile(Context c, String id, Spec s) {
        return new File("/cache/" + (s.processed() ? "fx-" + id + "-f" + Math.round(s.softness * 100) + "-r" + Math.round(s.space * 100) : "seg-" + id) + ".wav"); }
    static void pruneProcessed(Context c, Spec keep) {
        String wanted = keep.processed() ? "-f" + Math.round(keep.softness * 100) + "-r" + Math.round(keep.space * 100) + ".wav" : null;
        synchronized (android.media.MediaPlayer.files) { android.media.MediaPlayer.files.removeIf(p -> { String n = p.substring(p.lastIndexOf('/') + 1); return n.startsWith("fx-") && (wanted == null || !n.endsWith(wanted)); }); }
        log.add("prune keep " + wanted);
    }
    static boolean synthesize(Context c, String id, String text, Spec s) throws java.io.IOException {
        String play = playFile(c, id, s).getAbsolutePath();
        if (android.media.MediaPlayer.files.contains(play)) return true;
        if (id.equals(failOn)) throw new java.io.IOException("boom");
        try { Thread.sleep(genMs / android.os.SystemClock.F); } catch (InterruptedException e) {}
        android.media.MediaPlayer.files.add(play); log.add("gen " + new File(play).getName());
        return false;
    }
}
