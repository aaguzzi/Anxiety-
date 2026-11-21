package androidx.core.content;
import android.content.*;
public class ContextCompat {
    public static final int RECEIVER_NOT_EXPORTED = 4;
    public static Intent registerReceiver(Context c, BroadcastReceiver r, IntentFilter f, int flags) { c.receiver = r; c.registered++; return null; }
}
