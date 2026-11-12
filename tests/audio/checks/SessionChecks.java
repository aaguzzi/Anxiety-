package com.anxietycompanion.app;

import android.content.Context;
import android.media.*;
import android.os.*;
import java.lang.reflect.Field;
import java.util.*;

/** Drives the real MeditationSession against stand-in Android classes; time runs 20 times faster. */
public class SessionChecks {
    static final List<String> events = Collections.synchronizedList(new ArrayList<>());
    static volatile String lastStatus = ""; static volatile int lastIndex; static volatile boolean lastLineStart;
    static int fails;
    static void check(String what, boolean ok, Object detail) { if (!ok) fails++; System.out.println((ok ? "  ok   " : "  FAIL ") + what + (detail == null ? "" : "  [" + detail + "]")); }
    static void onMain(Runnable r) throws Exception { Handler.MAIN.submit(r).get(); }
    static void sleepV(long ms) throws Exception { Thread.sleep(Math.max(1, ms / SystemClock.F)); }
    static Object field(Class<?> c, Object o, String n) throws Exception { Field f = c.getDeclaredField(n); f.setAccessible(true); return f.get(o); }
    static boolean waitFor(String status, int index, long vms) throws Exception {
        long end = System.currentTimeMillis() + vms / SystemClock.F;
        while (System.currentTimeMillis() < end) { if (lastStatus.equals(status) && (index < 0 || lastIndex == index)) return true; Thread.sleep(1); }
        return false;
    }
    static Map<String, Float> lv(Object... kv) { Map<String, Float> m = new HashMap<>(); for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], ((Number) kv[i + 1]).floatValue()); return m; }
    static int serial;
    static MeditationSession make(Context c, String title, int n, float space) {
        String prefix = "s" + (++serial) + "-";
        String[] ids = new String[n], texts = new String[n]; long[] p = new long[n];
        for (int i = 0; i < n; i++) { ids[i] = prefix + i; texts[i] = "t"; p[i] = 1500; }
        return new MeditationSession(c, title, "tag-" + serial, ids, texts, p, new VoiceCore.Spec("supertonic", 4, 0.75f, 5, 0.3f, space), 2, 0);
    }
    static void begin(MeditationSession s, Context c) throws Exception { onMain(() -> { if (MeditationSession.current != null) MeditationSession.current.replace(); s.begin(); MeditationService.start(c); }); }
    static float duck() throws Exception { return (Float) field(Ambience.class, null, "duck"); }
    static boolean mixer() throws Exception { synchronized (field(Ambience.class, null, "LOCK")) { return field(Ambience.class, null, "thread") != null; } }
    static int plays(String suffix) { int n = 0; synchronized (MediaPlayer.log) { for (String s : MediaPlayer.log) if (s.contains(suffix)) n++; } return n; }
    static void quiet() throws Exception { VoiceCore.WORKER.submit(() -> {}).get(); sleepV(1500); MediaPlayer.log.clear(); events.clear(); }

    public static void main(String[] a) throws Exception {
        AudioTrack.sleepMicros = 1600;
        Context c = new Context();
        MeditationSession.listener = (s, i, start) -> { lastStatus = s; lastIndex = i; lastLineStart = start; events.add(s + " " + i + (start ? " start" : "")); };
        Ambience.setLevels(c, lv("rain", 0.5, "ocean", 0.5));
        VoiceCore.genMs = 500; MediaPlayer.durationMs = 3000;

        System.out.println("1. Another app asks for quiet for a moment (ducking)");
        MeditationSession A = make(c, "A", 6, 0f); begin(A, c);
        check("starts playing", waitFor("playing", 0, 20000), lastStatus);
        check("first event of a line is marked as its start", lastLineStart, events);
        check("asked for the speaker before any sound, at the start", c.audio.requests >= 1 && c.audio.holder != null, c.audio.requests);
        sleepV(500); onMain(() -> c.audio.deliver(AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK)); sleepV(100);
        check("sounds turned down", duck() < 1f, duck());
        check("next line starts", waitFor("playing", 1, 20000), lastStatus + " " + lastIndex);
        check("sounds back up when the next line starts, even with no all-clear", duck() == 1f, duck());
        sleepV(300); onMain(() -> c.audio.deliver(AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK)); sleepV(100);
        onMain(A::pause);
        check("pausing while turned down clears it", duck() == 1f, duck());
        onMain(A::resume); sleepV(300);
        onMain(() -> c.audio.deliver(AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK)); sleepV(100);
        onMain(A::stop); sleepV(1500);
        check("stopping while turned down clears it", duck() == 1f, duck());
        check("after stop: no wake lock, no players, service stopped, mixer stopped", PowerManager.held.get() == 0 && MediaPlayer.live == 0 && !MeditationService.running && !mixer(), PowerManager.held.get() + " " + MediaPlayer.live + " " + MeditationService.running + " " + mixer());
        quiet();

        System.out.println("2. Resume pressed during a phone call");
        MeditationSession B = make(c, "B", 6, 0f); begin(B, c); waitFor("playing", 0, 20000); sleepV(800);
        c.audio.result = AudioManager.AUDIOFOCUS_REQUEST_DELAYED;
        onMain(() -> c.audio.deliver(AudioManager.AUDIOFOCUS_LOSS_TRANSIENT)); sleepV(1500);
        check("call pauses the meditation", lastStatus.equals("paused") && !Ambience.audible() && PowerManager.held.get() == 0, lastStatus);
        int before = events.size();
        onMain(B::resume); sleepV(2000);
        check("resume during the call changes nothing", lastStatus.equals("paused") && !Ambience.audible() && !mixer() && PowerManager.held.get() == 0 && MediaPlayer.live == 0 && events.size() == before,
            lastStatus + " audible=" + Ambience.audible() + " mixer=" + mixer() + " wake=" + PowerManager.held.get() + " players=" + MediaPlayer.live);
        onMain(() -> c.audio.grantWaiting()); sleepV(500);
        check("carries on by itself when the call ends", lastStatus.equals("playing") && Ambience.audible() && PowerManager.held.get() == 1, lastStatus);
        // manual pause, resume during a call, then pause again: must not start after the call
        onMain(B::pause); c.audio.result = AudioManager.AUDIOFOCUS_REQUEST_DELAYED; onMain(B::resume); onMain(B::pause);
        check("pause after a refused resume withdraws the request", c.audio.waiting == null, null);
        c.audio.result = AudioManager.AUDIOFOCUS_REQUEST_GRANTED; sleepV(1000);
        check("stays paused", lastStatus.equals("paused") && !Ambience.audible(), lastStatus);
        onMain(B::stop); quiet();

        System.out.println("3. Meditation started during a phone call");
        c.audio.result = AudioManager.AUDIOFOCUS_REQUEST_DELAYED;
        MeditationSession C = make(c, "C", 6, 0f); begin(C, c); sleepV(3000);
        check("waits, paused and silent", lastStatus.equals("paused") && !Ambience.audible() && !mixer() && PowerManager.held.get() == 0 && MediaPlayer.live == 0, lastStatus + " " + events);
        check("voice is being prepared meanwhile", VoiceCore.log.stream().anyMatch(s -> s.contains("s" + serial + "-0")), null);
        onMain(() -> c.audio.grantWaiting());
        check("starts when the call ends", waitFor("playing", 0, 20000) && Ambience.audible(), lastStatus);
        onMain(C::stop); quiet();

        System.out.println("4. Pausing in the room echo after a line (echo on)");
        MeditationSession D = make(c, "D", 6, 0.5f); // tail = 1.05 s
        begin(D, c); waitFor("playing", 0, 20000);
        sleepV(1000); onMain(D::pause); sleepV(300); onMain(D::resume); sleepV(200);
        check("paused mid-sentence: the sentence is spoken again", plays("-0-f30-r50") == 2 && lastLineStart, MediaPlayer.log);
        sleepV(2300); // now inside the last second of the three-second line: only the echo is left
        onMain(D::pause); sleepV(300); int n0 = plays("-0-f30-r50"); events.clear(); onMain(D::resume); sleepV(100);
        check("paused in the echo: resumes as silence, not marked as a line start", lastStatus.equals("playing") && lastIndex == 0 && !lastLineStart, events);
        check("then moves to the next sentence without repeating", waitFor("playing", 1, 20000) && plays("-0-f30-r50") == n0, MediaPlayer.log);
        onMain(D::stop); quiet();

        System.out.println("5. Headphones unplugged");
        MeditationSession E = make(c, "E", 6, 0f); begin(E, c); waitFor("playing", 0, 20000); sleepV(500);
        onMain(() -> c.receiver.onReceive(c, null));
        check("pauses at once with a very short fade", lastStatus.equals("paused") && ((Float) field(Ambience.class, null, "fadeSeconds")) <= 0.2f, field(Ambience.class, null, "fadeSeconds"));
        check("gave the speaker up", c.audio.holder == null, null);
        onMain(E::resume); check("resume works afterwards", waitFor("playing", 0, 20000), lastStatus);

        System.out.println("6. Running to the end");
        MediaPlayer.durationMs = 800; onMain(() -> E.seek(5));
        check("finishes", waitFor("done", -1, 30000), lastStatus);
        sleepV(2000); check("sounds still fading two seconds after the end, phone kept awake", mixer() && PowerManager.held.get() == 1 && MeditationService.running, mixer() + " " + PowerManager.held.get());
        sleepV(5000); check("seven seconds after: all released", !mixer() && PowerManager.held.get() == 0 && !MeditationService.running && MediaPlayer.live == 0 && c.registered == 0, mixer() + " " + PowerManager.held.get() + " " + MeditationService.running + " " + c.registered);
        check("no crash on the main thread", Handler.crash == null, Handler.crash);
        System.out.println(fails == 0 ? "ALL SESSION CHECKS PASSED" : fails + " SESSION CHECK(S) FAILED");
    }
}
