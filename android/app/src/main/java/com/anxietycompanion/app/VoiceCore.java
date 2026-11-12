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
    static final String SUPERTONIC_VOCODER = "vocoder.onnx";

    /** Everything that decides how a line sounds. */
    static final class Spec {
        final String model;
        final int sid;
        final float speed;
        /** Refinement passes for the studio voices; 0 uses the model's default. */
        final int steps;
        /** 0..1, see VoiceFx. */
        final float softness;
        final float space;

        Spec(String model, int sid, float speed, int steps, float softness, float space) {
            this.model = model;
            this.sid = sid;
            this.speed = speed;
            this.steps = steps;
            this.softness = Math.max(0f, Math.min(1f, softness));
            this.space = Math.max(0f, Math.min(1f, space));
        }

        boolean processed() {
            return softness > 0f || space > 0f;
        }

        /** Extra length the room sound adds to the end of each line. */
        long tailMs() {
            return space > 0f ? Math.round(VoiceFx.tailSeconds(space) * 1000) : 0;
        }
    }

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

    private static String safe(String id) {
        return id.replaceAll("[^A-Za-z0-9_-]", "");
    }

    /** The line as the voice model produced it. */
    static File segmentFile(Context context, String id) {
        return new File(voiceCacheDir(context), "seg-" + safe(id) + ".wav");
    }

    /**
     * The file to play for a line: the model's output, or a softened copy of it. The copies are
     * cheap to remake, so changing softness never means generating the speech again.
     */
    static File playFile(Context context, String id, Spec spec) {
        if (!spec.processed()) return segmentFile(context, id);
        return new File(voiceCacheDir(context), "fx-" + safe(id)
            + "-f" + Math.round(spec.softness * 100) + "-r" + Math.round(spec.space * 100) + ".wav");
    }

    /**
     * Deletes softened copies made for other softness settings. They pile up as the setting is
     * tried out, and are remade from the cached speech in a moment if wanted again. Call on WORKER.
     */
    static void pruneProcessed(Context context, Spec keep) {
        File[] files = voiceCacheDir(context).listFiles();
        if (files == null) return;
        String wanted = keep.processed()
            ? "-f" + Math.round(keep.softness * 100) + "-r" + Math.round(keep.space * 100) + ".wav"
            : null;
        for (File f : files) {
            String name = f.getName();
            if (name.startsWith("fx-") && (wanted == null || !name.endsWith(wanted))) f.delete();
        }
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
            // The full-precision vocoder: the compressed one adds an audible hiss.
            st.setVocoder(SUPERTONIC_ASSETS + "/" + SUPERTONIC_VOCODER);
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
     * Makes sure one line of speech is ready to play, generating it if needed. Call on WORKER.
     * @return true if the speech itself was already cached
     */
    static boolean synthesize(Context context, String id, String text, Spec spec) throws IOException {
        File raw = segmentFile(context, id);
        File play = playFile(context, id, spec);
        if (play.length() > 0) return true;

        boolean cached = raw.length() > 0;
        float[] samples = null;
        int rate = 0;
        if (!cached) {
            OfflineTts voice = engine(context, spec.model);
            GeneratedAudio audio;
            if (spec.steps > 0) {
                GenerationConfig config = new GenerationConfig();
                config.setSid(spec.sid);
                config.setSpeed(spec.speed);
                config.setNumSteps(spec.steps);
                audio = voice.generateWithConfig(text, config);
            } else {
                audio = voice.generate(text, spec.sid, spec.speed);
            }
            rate = audio.getSampleRate();
            if (audio.getSamples().length == 0) throw new IOException("Could not generate speech");
            samples = VoiceFx.level(audio.getSamples(), rate);
            Wav.write(raw, samples, rate);
        }
        if (spec.processed()) {
            if (samples == null) {
                Wav wav = Wav.read(raw);
                samples = wav.samples();
                rate = wav.sampleRate;
            }
            Wav.write(play, VoiceFx.apply(samples, rate, spec.softness, spec.space), rate);
        }
        return cached;
    }
}
