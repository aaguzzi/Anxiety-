package android.content.res;
import java.io.*;
public class AssetManager {
    /** Where the app's assets are on this machine; run.sh passes it in. */
    public static String ROOT = System.getProperty("assets.root", "android/app/src/main/assets/");
    public InputStream open(String p) throws IOException { return new FileInputStream(ROOT + p); }
    public String[] list(String d) throws IOException { return new File(ROOT + d).list(); }
}
