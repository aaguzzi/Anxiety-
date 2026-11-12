package com.anxietycompanion.app;

import android.content.Context;
import android.content.res.AssetManager;
import android.media.AudioTrack;
import java.io.File;
import java.lang.reflect.Field;
import java.util.*;

/** Drives the real Ambience mixer against a fake audio output and measures what comes out. */
public class MixerHarness {
    static int fails;
    static void check(String what, boolean ok, Object detail) { if (!ok) fails++; System.out.println((ok ? "  ok   " : "  FAIL ") + what + (detail == null ? "" : "  [" + detail + "]")); }
    static Object field(String n) throws Exception { Field f = Ambience.class.getDeclaredField(n); f.setAccessible(true); return f.get(null); }
    static int loaded() throws Exception {
        int n = 0;
        synchronized (field("LOCK")) {
            for (Object layer : ((Map<?, ?>) field("LAYERS")).values()) { Field d = layer.getClass().getDeclaredField("data"); d.setAccessible(true); if (d.get(layer) != null) n++; }
        }
        return n;
    }
    static boolean running() throws Exception { synchronized (field("LOCK")) { return field("thread") != null; } }
    static Map<String, Float> lv(Object... kv) { Map<String, Float> m = new HashMap<>(); for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], ((Number) kv[i + 1]).floatValue()); return m; }
    static int mark() { synchronized (AudioTrack.SINK) { return AudioTrack.n; } }
    static short[] leftFrom(int from) { synchronized (AudioTrack.SINK) { return Arrays.copyOfRange(AudioTrack.left, from, AudioTrack.n); } }
    static short[] rightFrom(int from) { synchronized (AudioTrack.SINK) { return Arrays.copyOfRange(AudioTrack.right, from, AudioTrack.n); } }
    static void waitFrames(int from, int frames) throws Exception { long end = System.currentTimeMillis() + 20000; while (mark() - from < frames && System.currentTimeMillis() < end) Thread.sleep(2); }
    static void waitStopped() throws Exception { long end = System.currentTimeMillis() + 20000; while (running() && System.currentTimeMillis() < end) Thread.sleep(2); }
    /** Loudest sample in each whole cycle of a tone that takes 32 samples a cycle. */
    static int[] envelope(short[] x) { int[] e = new int[x.length / 32]; for (int i = 0; i < e.length; i++) { int m = 0; for (int j = 0; j < 32; j++) m = Math.max(m, Math.abs(x[i * 32 + j])); e[i] = m; } return e; }
    static int peak(short[] x) { int m = 0; for (short v : x) m = Math.max(m, Math.abs(v)); return m; }
    static int clipped(short[] x) { int n = 0; for (short v : x) if (v >= 32767 || v <= -32768) n++; return n; }

    public static void main(String[] a) throws Exception {
        AudioTrack.sleepMicros = 200;
        String real = AssetManager.ROOT;
        File dir = new File(a[0], "ambience"); dir.mkdirs();
        // A steady 1 kHz tone: quiet for six seconds, then two seconds loud enough to overload at full volume.
        int sr = 32000; float[] tone = new float[sr * 8];
        for (int i = 0; i < tone.length; i++) tone[i] = (i >= sr * 6 ? 30000f : 12000f) / 32768f * (float) Math.sin(2 * Math.PI * i / 32.0);
        Wav.write(new File(dir, "drone.wav"), tone, sr);
        AssetManager.ROOT = a[0] + "/";
        Context c = new Context();

        System.out.println("1. Nothing is loaded or running until sound is wanted");
        Ambience.setLevels(c, lv("drone", 1.0)); Thread.sleep(300);
        check("no mixer thread", !running(), null);
        check("no loops in memory", loaded() == 0, loaded());
        check("no audio output opened", AudioTrack.opened.get() == 0, AudioTrack.opened.get());

        System.out.println("2. Preview: an overloading passage is turned down smoothly, never clipped");
        int m = mark(); Ambience.preview(true); waitFrames(m, sr * 26);
        check("mixer thread runs at audio priority", running() && android.os.Process.lastPriority == android.os.Process.THREAD_PRIORITY_AUDIO, android.os.Process.lastPriority);
        short[] l = leftFrom(m + sr * 9), r = rightFrom(m + sr * 9); // skip the fade-in and the first loop
        check("no sample at the clipping limit", clipped(l) == 0, clipped(l));
        int ceiling = Math.round(0.92f * 32767f);
        check("loudest sample is at the ceiling, not above", peak(l) <= ceiling + 1 && peak(l) >= ceiling - 40, peak(l) + " vs " + ceiling);
        check("both ears identical for a centred layer", Arrays.equals(l, r), null);
        int[] e = envelope(l); int maxJump = 0, maxUp = 0, quietFull = 0, minQuiet = 99999;
        for (int i = 1; i < e.length; i++) {
            int d = e[i] - e[i - 1];
            boolean loopStep = Math.abs(d) > 3000; // the loop's own change between quiet and loud
            if (!loopStep) { maxJump = Math.max(maxJump, Math.abs(d)); maxUp = Math.max(maxUp, d); }
            if (e[i] < 16000) { minQuiet = Math.min(minQuiet, e[i]); if (Math.abs(e[i] - 15000) <= 2) quietFull++; }
        }
        check("level never jumps (largest change between cycles, apart from the loop's own steps)", maxJump <= 120, maxJump);
        check("after the loud passage the quiet one returns to its full level", quietFull > 1000, quietFull + " cycles at full level");
        check("quiet passage is only turned down ahead of the loud one, to about 0.80", minQuiet >= 11900 && minQuiet <= 12200, minQuiet);

        System.out.println("3. Leaving the screen stops a preview, with a fade, and frees the loop");
        m = mark(); Ambience.visible(false); waitStopped();
        short[] tail = leftFrom(m);
        check("mixer thread stopped", !running(), null);
        check("fade lasted about half a second", tail.length > sr * 0.4 && tail.length < sr * 0.7, tail.length / (float) sr);
        int[] te = envelope(tail); boolean falling = true; for (int i = 1; i < te.length; i++) if (te[i] > te[i - 1] + 300) falling = false;
        check("level only falls during the fade", falling, null);
        check("fade ends at silence", peak(Arrays.copyOfRange(tail, tail.length - 64, tail.length)) <= 2, peak(Arrays.copyOfRange(tail, tail.length - 64, tail.length)));
        check("loop freed", loaded() == 0, loaded());
        check("audio output released", AudioTrack.opened.get() == AudioTrack.released.get(), AudioTrack.opened.get() + "/" + AudioTrack.released.get());
        Thread.sleep(200); check("stays silent while hidden", mark() == m + tail.length, null);

        System.out.println("4. Coming back resumes the preview");
        m = mark(); Ambience.visible(true); waitFrames(m, sr * 2);
        check("sound again", peak(leftFrom(m)) > 10000, peak(leftFrom(m)));
        Ambience.preview(false); waitStopped();
        check("stopped and freed after the preview", !running() && loaded() == 0, null);

        System.out.println("5. A paused meditation keeps its loops; an ended one lets them go");
        Ambience.session(true, true, 0.3f); m = mark(); waitFrames(m, sr * 2);
        Ambience.session(false, true, 0.3f); waitStopped();
        check("paused: thread stopped, loop kept", !running() && loaded() == 1, loaded());
        m = mark(); Ambience.session(true, true, 0.3f); waitFrames(m, sr);
        check("resumed: sound within a second", peak(leftFrom(m)) > 5000, peak(leftFrom(m)));
        Ambience.session(false, false, 0.3f); waitStopped();
        check("ended: thread stopped, loop freed", !running() && loaded() == 0, loaded());

        System.out.println("6. Ducking is forgotten when a session starts or resumes");
        Ambience.duck(true); Ambience.session(true, true, 0.3f);
        check("duck cleared", ((Float) field("duck")) == 1f, field("duck"));
        Ambience.session(false, false, 0.05f); waitStopped();

        System.out.println("7. The real sounds, all nine at full volume");
        AssetManager.ROOT = real;
        Map<String, Float> all = new HashMap<>(); for (String id : new String[] {"rain", "ocean", "stream", "wind", "bowls", "drone", "brown", "pink", "white"}) all.put(id, 1f);
        Ambience.setLevels(c, all); m = mark(); Ambience.preview(true); waitFrames(m, sr * 70);
        l = leftFrom(m + sr * 5); r = rightFrom(m + sr * 5);
        check("nine loops loaded", loaded() == 9, loaded());
        check("no clipped samples in 65 s (left, right)", clipped(l) == 0 && clipped(r) == 0, clipped(l) + ", " + clipped(r));
        check("peaks at or under the ceiling", peak(l) <= ceiling + 1 && peak(r) <= ceiling + 1, peak(l) + ", " + peak(r));
        double sum = 0; for (short v : l) sum += (double) v * v; System.out.printf("       level of the mix: %.1f dBFS RMS%n", 10 * Math.log10(sum / l.length / (32768.0 * 32768.0)));
        Map<String, Float> usual = new HashMap<>(); for (String id : new String[] {"rain", "ocean"}) usual.put(id, 0.5f);
        Ambience.setLevels(c, usual); Thread.sleep(300); m = mark(); waitFrames(m, sr * 30);
        l = leftFrom(m);
        sum = 0; for (short v : l) sum += (double) v * v; System.out.printf("       rain + ocean at the default 50%%: %.1f dBFS RMS, peak %d%n", 10 * Math.log10(sum / l.length / (32768.0 * 32768.0)), peak(l));
        Ambience.preview(false); waitStopped();
        check("everything released at the end", !running() && loaded() == 0 && AudioTrack.opened.get() == AudioTrack.released.get(), loaded());
        System.out.println(fails == 0 ? "ALL MIXER CHECKS PASSED" : fails + " MIXER CHECK(S) FAILED");
    }
}
