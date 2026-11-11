package com.anxietycompanion.app;

import android.app.ActivityManager;
import android.content.Context;
import android.content.res.AssetManager;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.view.WindowManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
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
import java.util.concurrent.atomic.AtomicInteger;

/** On-device neural text-to-speech (sherpa-onnx). Two bundled models: a fast Piper voice and multi-speaker Kokoro and Supertonic. */
@CapacitorPlugin(name = "NeuralVoice")
public class NeuralVoicePlugin extends Plugin {
    private static final String ASSETS = "voice";
    private static final String KOKORO_ASSETS = "voice-kokoro";
    private static final String SUPERTONIC_ASSETS = "voice-supertonic";
    private static final String BENCH_TEXT = "Take a slow breath in, and notice where your body meets the chair.";

    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final AtomicInteger epoch = new AtomicInteger();
    private OfflineTts tts;
    private String loadedModel;
    private MediaPlayer player;
    private PluginCall playCall;
    private AudioFocusRequest focusRequest;

    private boolean bundled(String dir, String file) {
        try {
            String[] files = getContext().getAssets().list(dir);
            return files != null && Arrays.asList(files).contains(file);
        } catch (IOException e) {
            return false;
        }
    }

    private int cores() {
        return Runtime.getRuntime().availableProcessors();
    }

    private long ramMb() {
        ActivityManager am = (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
        ActivityManager.MemoryInfo info = new ActivityManager.MemoryInfo();
        am.getMemoryInfo(info);
        return info.totalMem / (1024 * 1024);
    }

    private File segmentFile(String id) {
        File dir = new File(getContext().getCacheDir(), "voice");
        dir.mkdirs();
        return new File(dir, "seg-" + id.replaceAll("[^A-Za-z0-9_-]", "") + ".wav");
    }

    private void copyAssetDir(AssetManager assets, String from, File to) throws IOException {
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
    // Only one model is kept in memory; asking for the other swaps it.
    private synchronized OfflineTts engine(String which) throws IOException {
        if (tts != null && which.equals(loadedModel)) return tts;
        if (tts != null) {
            tts.release();
            tts = null;
        }
        AssetManager assets = getContext().getAssets();
        File dataDir = new File(getContext().getFilesDir(), "voice/espeak-ng-data");
        File marker = new File(dataDir, ".copied-v1");
        if (!"supertonic".equals(which) && !marker.exists()) {
            copyAssetDir(assets, ASSETS + "/espeak-ng-data", dataDir);
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
            vits.setModel(ASSETS + "/model.onnx");
            vits.setTokens(ASSETS + "/tokens.txt");
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

    @PluginMethod
    public void info(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("piper", bundled(ASSETS, "model.onnx"));
        ret.put("kokoro", bundled(KOKORO_ASSETS, "model.onnx") && bundled(ASSETS, "model.onnx"));
        ret.put("supertonic", bundled(SUPERTONIC_ASSETS, "vocoder.int8.onnx"));
        ret.put("cores", cores());
        ret.put("ramMb", ramMb());
        call.resolve(ret);
    }

    /** Measures how fast this device generates speech: rtf = seconds of work per second of audio. */
    @PluginMethod
    public void benchmark(PluginCall call) {
        worker.execute(() -> {
            try {
                OfflineTts t = engine("piper");
                t.generate("Hello.", 0, 1.0f);
                long start = System.nanoTime();
                GeneratedAudio audio = t.generate(BENCH_TEXT, 0, 0.85f);
                double genSec = (System.nanoTime() - start) / 1e9;
                double audioSec = audio.getSamples().length / (double) audio.getSampleRate();
                JSObject ret = new JSObject();
                ret.put("rtf", audioSec > 0 ? genSec / audioSec : 99);
                ret.put("cores", cores());
                ret.put("ramMb", ramMb());
                call.resolve(ret);
            } catch (Throwable e) {
                call.reject("Voice benchmark failed: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void prepare(PluginCall call) {
        String id = call.getString("id");
        String text = call.getString("text");
        float speed = call.getFloat("speed", 0.85f);
        String model = call.getString("model", "piper");
        int sid = call.getInt("sid", 0);
        int steps = call.getInt("steps", 0);
        if (id == null || text == null) {
            call.reject("id and text are required");
            return;
        }
        final int started = epoch.get();
        worker.execute(() -> {
            if (started != epoch.get()) {
                call.reject("cancelled");
                return;
            }
            try {
                File out = segmentFile(id);
                JSObject ret = new JSObject();
                // Lines are generated once per meditation and reused on replay.
                if (out.length() > 0) {
                    ret.put("cached", true);
                    call.resolve(ret);
                    return;
                }
                OfflineTts voice = engine(model);
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
                    call.reject("Could not generate speech");
                    return;
                }
                ret.put("cached", false);
                call.resolve(ret);
            } catch (Throwable e) {
                call.reject("Could not generate speech: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void play(PluginCall call) {
        String id = call.getString("id");
        if (id == null) {
            call.reject("id is required");
            return;
        }
        File file = segmentFile(id);
        getActivity().runOnUiThread(() -> {
            finishPlayback(true);
            MediaPlayer mp = new MediaPlayer();
            try {
                mp.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build());
                mp.setDataSource(file.getAbsolutePath());
                mp.setOnCompletionListener(p -> finishPlayback(false));
                mp.setOnErrorListener((p, what, extra) -> {
                    PluginCall pending = playCall;
                    playCall = null;
                    releasePlayer();
                    if (pending != null) pending.reject("Playback failed (" + what + ")");
                    return true;
                });
                mp.prepare();
                requestFocus();
                player = mp;
                playCall = call;
                mp.start();
            } catch (Throwable e) {
                try { mp.release(); } catch (Throwable ignored) {}
                player = null;
                call.reject("Playback failed: " + e.getMessage());
            }
        });
    }

    // Ask other apps (music, podcasts) to pause while the meditation speaks.
    private void requestFocus() {
        if (Build.VERSION.SDK_INT < 26) return;
        AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        if (focusRequest == null) {
            focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                .setOnAudioFocusChangeListener(change -> {})
                .build();
        }
        am.requestAudioFocus(focusRequest);
    }

    private void abandonFocus() {
        if (focusRequest == null || Build.VERSION.SDK_INT < 26) return;
        AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        am.abandonAudioFocusRequest(focusRequest);
    }

    private void releasePlayer() {
        if (player != null) {
            try { player.release(); } catch (Throwable ignored) {}
            player = null;
        }
    }

    private void finishPlayback(boolean stopped) {
        PluginCall pending = playCall;
        playCall = null;
        releasePlayer();
        if (pending != null) {
            JSObject ret = new JSObject();
            ret.put("stopped", stopped);
            pending.resolve(ret);
        }
    }

    /** Stops playback; unless cancelQueued is false, also drops speech still waiting to be generated. */
    @PluginMethod
    public void stop(PluginCall call) {
        if (call.getBoolean("cancelQueued", true)) epoch.incrementAndGet();
        getActivity().runOnUiThread(() -> {
            finishPlayback(true);
            abandonFocus();
            call.resolve();
        });
    }

    /** Deletes generated speech whose id starts with the prefix (all of it when the prefix is empty). */
    @PluginMethod
    public void clearCache(PluginCall call) {
        String prefix = "seg-" + call.getString("prefix", "").replaceAll("[^A-Za-z0-9_-]", "");
        worker.execute(() -> {
            File[] files = new File(getContext().getCacheDir(), "voice").listFiles();
            if (files != null) {
                for (File f : files) {
                    if (f.getName().startsWith(prefix)) f.delete();
                }
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void keepAwake(PluginCall call) {
        boolean on = call.getBoolean("on", false);
        getActivity().runOnUiThread(() -> {
            if (on) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            call.resolve();
        });
    }

    @Override
    protected void handleOnDestroy() {
        epoch.incrementAndGet();
        releasePlayer();
        worker.shutdownNow();
    }
}
