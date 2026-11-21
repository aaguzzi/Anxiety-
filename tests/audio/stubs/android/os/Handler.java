package android.os;
import java.util.concurrent.*;
public class Handler {
    public static final ScheduledExecutorService MAIN = Executors.newSingleThreadScheduledExecutor(r -> { Thread t = new Thread(r, "main"); t.setDaemon(true); return t; });
    public static volatile Throwable crash;
    public Handler(Looper l) {}
    private static Runnable wrap(Runnable r) { return () -> { try { r.run(); } catch (Throwable e) { crash = e; e.printStackTrace(); } }; }
    public boolean post(Runnable r) { MAIN.execute(wrap(r)); return true; }
    public boolean postDelayed(Runnable r, long ms) { MAIN.schedule(wrap(r), ms * 1000 / SystemClock.F, TimeUnit.MICROSECONDS); return true; }
}
