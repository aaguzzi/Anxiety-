package android.content;
import android.content.res.AssetManager;
public class Context {
    public static final String AUDIO_SERVICE = "audio", POWER_SERVICE = "power";
    private final AssetManager am = new AssetManager();
    public final android.media.AudioManager audio = new android.media.AudioManager();
    public final android.os.PowerManager power = new android.os.PowerManager();
    public BroadcastReceiver receiver; public int registered;
    public Context getApplicationContext() { return this; }
    public AssetManager getAssets() { return am; }
    public Object getSystemService(String n) { return AUDIO_SERVICE.equals(n) ? audio : power; }
    public void unregisterReceiver(BroadcastReceiver r) { if (receiver == r) { receiver = null; registered--; } else throw new IllegalArgumentException("not registered"); }
}
