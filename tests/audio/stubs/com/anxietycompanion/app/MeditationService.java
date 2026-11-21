package com.anxietycompanion.app;
import android.content.Context;
import java.util.*;
public class MeditationService {
    static boolean running; static int stops, starts; static final List<String> log = Collections.synchronizedList(new ArrayList<>());
    static void start(Context c) { running = true; starts++; }
    static void refresh(Context c) {}
    static void stop() { if (!running) return; running = false; stops++; log.add(android.os.SystemClock.elapsedRealtime() + " service stopped; current=" + (MeditationSession.current == null ? "null" : MeditationSession.current.title)); }
}
