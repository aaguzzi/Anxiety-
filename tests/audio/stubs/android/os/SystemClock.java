package android.os;
public class SystemClock {
    public static final int F = 20; // virtual ms per real ms
    public static long elapsedRealtime() { return System.nanoTime() / 1000000L * F; }
}
