package com.anxietycompanion.app;

import android.app.ActivityManager;
import android.content.Context;
import android.content.res.AssetManager;

import com.k2fsa.sherpa.onnx.GeneratedAudio;
import com.k2fsa.sherpa.onnx.GenerationConfig;
import com.k2fsa.sherpa.onnx.OfflineTts;
import com.k2fsa.sherpa.onnx.OfflineTtsConfig;
import com.k2fsa.sherpa.onnx.OfflineTtsKokoroModelConfig;
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig;
import com.k2fsa.sherpa.onnx.OfflineTtsSupertonicModelConfig;
import com.k2fsa.sherpa.onnx.OfflineTtsVitsModelConfig;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * The on-device speech engine (sherpa-onnx), shared by the plugin and the background meditation
 * session. Bundled models: Piper ("piper"), Supertonic ("supertonic") and optionally Kokoro.
 */
final class VoiceCore {
    static final String PIPER_ASSETS = "voice";
    static final String KOKORO_ASSETS = "voice-kokoro";
    static final String SUPERTONIC_ASSETS = "voice-supertonic";

    /** All speech generation runs here, one line at a time, because the engine is not thread-safe. */
    static final ExecutorService WORKER = Executors.newSingleThreadExecutor();

    private static OfflineTts tts;
    private static String loadedModel;

    private VoiceCore() {}

    static boolean bundled(Context context, String dir, String file) {
        try {
            String[] files = context.getAssets().list(dir);
            return files != null && Arrays.asList(files).contains(file);
        } catch (IOException e) {
            return false;
        }
    }

    static int cores() {
        return Runtime.getRuntime().availableProcessors();
    }

    static long ramMb(Context context) {
        ActivityManager am = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
        ActivityManager.MemoryInfo info = new ActivityManager.MemoryInfo();
        am.getMemoryInfo(info);
        return info.totalMem / (1024 * 1024);
    }

    static File voiceCacheDir(Context context) {
        File dir = new File(context.getCacheDir(), "voice");
        dir.mkdirs();
        return dir;
    }

    static File segmentFile(Context context, String id) {
        return new File(voiceCacheDir(context), "seg-" + id.replaceAll("[^A-Za-z0-9_-]", "") + ".wav");
    }

    private static void copyAssetDir(AssetManager assets, String from, File to) throws IOException {
        String[] children = assets.list(from);
        if (children == null || children.length == 0) {
            try (InputStream in = assets.open(from); OutputStream out = new FileOutputStream(to)) {
                byte[] buf = new byte[65536];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            }
            return;
        }
        to.mkdirs();
        for (String child : children) copyAssetDir(assets, from + "/" + child, new File(to, child));
    }

    // The pronunciation data must be on the real filesystem; the models load straight from assets.
    // Only one model is kept in memory; asking for another swaps it.
    static synchronized OfflineTts engine(Context context, String which) throws IOException {
        if (tts != null && which.equals(loadedModel)) return tts;
        if (tts != null) {
            tts.release();
            tts = null;
        }
        AssetManager assets = context.getAssets();
        File dataDir = new File(context.getFilesDir(), "voice/espeak-ng-data");
        File marker = new File(dataDir, ".copied-v1");
        if (!"supertonic".equals(which) && !marker.exists()) {
            copyAssetDir(assets, PIPER_ASSETS + "/espeak-ng-data", dataDir);
            marker.createNewFile();
        }

        OfflineTtsModelConfig model = new OfflineTtsModelConfig();
        if ("supertonic".equals(which)) {
            OfflineTtsSupertonicModelConfig st = new OfflineTtsSupertonicModelConfig();
            st.setDurationPredictor(SUPERTONIC_ASSETS + "/duration_predictor.int8.onnx");
            st.setTextEncoder(SUPERTONIC_ASSETS + "/text_encoder.int8.onnx");
            st.setVectorEstimator(SUPERTONIC_ASSETS + "/vector_estimator.int8.onnx");
            st.setVocoder(SUPERTONIC_ASSETS + "/vocoder.int8.onnx");
            st.setTtsJson(SUPERTONIC_ASSETS + "/tts.json");
            st.setUnicodeIndexer(SUPERTONIC_ASSETS + "/unicode_indexer.bin");
            st.setVoiceStyle(SUPERTONIC_ASSETS + "/voice.bin");
            model.setSupertonic(st);
        } else if ("kokoro".equals(which)) {
            OfflineTtsKokoroModelConfig kokoro = new OfflineTtsKokoroModelConfig();
            kokoro.setModel(KOKORO_ASSETS + "/model.onnx");
            kokoro.setVoices(KOKORO_ASSETS + "/voices.bin");
            kokoro.setTokens(KOKORO_ASSETS + "/tokens.txt");
            kokoro.setLexicon(KOKORO_ASSETS + "/lexicon-us-en.txt");
            kokoro.setDataDir(dataDir.getAbsolutePath());
            model.setKokoro(kokoro);
        } else {
            OfflineTtsVitsModelConfig vits = new OfflineTtsVitsModelConfig();
            vits.setModel(PIPER_ASSETS + "/model.onnx");
            vits.setTokens(PIPER_ASSETS + "/tokens.txt");
            vits.setDataDir(dataDir.getAbsolutePath());
            vits.setNoiseScale(0.5f);
            vits.setNoiseScaleW(0.7f);
            model.setVits(vits);
        }
        model.setNumThreads(Math.max(1, Math.min(4, cores() / 2)));
        model.setProvider("cpu");

        OfflineTtsConfig config = new OfflineTtsConfig();
        config.setModel(model);
        tts = new OfflineTts(assets, config);
        loadedModel = which;
        return tts;
    }

    /**
     * Generates one line of speech into the cache unless it is already there. Call on WORKER.
     * @return true if the file was already cached
     */
    static boolean synthesize(Context context, String id, String text, float speed, String model, int sid, int steps)
        throws IOException {
        File out = segmentFile(context, id);
        if (out.length() > 0) return true;

        OfflineTts voice = engine(context, model);
        GeneratedAudio audio;
        if (steps > 0) {
            GenerationConfig config = new GenerationConfig();
            config.setSid(sid);
            config.setSpeed(speed);
            config.setNumSteps(steps);
            audio = voice.generateWithConfig(text, config);
        } else {
            audio = voice.generate(text, sid, speed);
        }
        File tmp = new File(out.getPath() + ".part");
        if (audio.getSamples().length == 0 || !audio.save(tmp.getAbsolutePath()) || !tmp.renameTo(out)) {
            tmp.delete();
            throw new IOException("Could not generate speech");
        }
        return false;
    }
}
