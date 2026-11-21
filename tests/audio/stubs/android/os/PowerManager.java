package android.os;
public class PowerManager {
    public static final int PARTIAL_WAKE_LOCK = 1;
    public static final java.util.concurrent.atomic.AtomicInteger held = new java.util.concurrent.atomic.AtomicInteger();
    public class WakeLock {
        boolean h;
        public void setReferenceCounted(boolean b) {}
        public void acquire(long t) { if (!h) { h = true; held.incrementAndGet(); } }
        public boolean isHeld() { return h; }
        public void release() { if (h) { h = false; held.decrementAndGet(); } }
    }
    public WakeLock newWakeLock(int f, String tag) { return new WakeLock(); }
}
