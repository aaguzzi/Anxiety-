package com.anxietycompanion.app;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.view.WindowManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.k2fsa.sherpa.onnx.GeneratedAudio;
import com.k2fsa.sherpa.onnx.OfflineTts;

import org.json.JSONObject;

import java.io.File;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Bridge to the on-device voices. Two ways to speak: one line at a time (prepare/play, used for
 * samples), or a whole meditation as a native session that keeps playing with the screen off.
 */
@CapacitorPlugin(name = "NeuralVoice")
public class NeuralVoicePlugin extends Plugin {
    private static final String BENCH_TEXT = "Take a slow breath in, and notice where your body meets the chair.";

    private final AtomicInteger epoch = new AtomicInteger();
    private MediaPlayer player;
    private PluginCall playCall;
    private AudioFocusRequest focusRequest;

    @Override
    public void load() {
        MeditationSession.listener = (status, index) -> notifyListeners("sessionState", state(status, index));
    }

    private static JSObject state(String status, int index) {
        JSObject ret = new JSObject();
        ret.put("status", status);
        ret.put("index", index);
        return ret;
    }

    @PluginMethod
    public void info(PluginCall call) {
        Context c = getContext();
        boolean piper = VoiceCore.bundled(c, VoiceCore.PIPER_ASSETS, "model.onnx");
        JSObject ret = new JSObject();
        ret.put("piper", piper);
        ret.put("kokoro", piper && VoiceCore.bundled(c, VoiceCore.KOKORO_ASSETS, "model.onnx"));
        ret.put("supertonic", VoiceCore.bundled(c, VoiceCore.SUPERTONIC_ASSETS, "vocoder.int8.onnx"));
        ret.put("cores", VoiceCore.cores());
        ret.put("ramMb", VoiceCore.ramMb(c));
        call.resolve(ret);
    }

    /** Measures how fast this device generates speech: rtf = seconds of work per second of audio. */
    @PluginMethod
    public void benchmark(PluginCall call) {
        VoiceCore.WORKER.execute(() -> {
            try {
                OfflineTts t = VoiceCore.engine(getContext(), "piper");
                t.generate("Hello.", 0, 1.0f);
                long start = System.nanoTime();
                GeneratedAudio audio = t.generate(BENCH_TEXT, 0, 0.85f);
                double genSec = (System.nanoTime() - start) / 1e9;
                double audioSec = audio.getSamples().length / (double) audio.getSampleRate();
                JSObject ret = new JSObject();
                ret.put("rtf", audioSec > 0 ? genSec / audioSec : 99);
                ret.put("cores", VoiceCore.cores());
                ret.put("ramMb", VoiceCore.ramMb(getContext()));
                call.resolve(ret);
            } catch (Throwable e) {
                call.reject("Voice benchmark failed: " + e.getMessage());
            }
        });
    }

    // ── One line at a time ─────────────────────────────────────────────────────────────────────

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
        VoiceCore.WORKER.execute(() -> {
            if (started != epoch.get()) {
                call.reject("cancelled");
                return;
            }
            try {
                JSObject ret = new JSObject();
                ret.put("cached", VoiceCore.synthesize(getContext(), id, text, speed, model, sid, steps));
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
        File file = VoiceCore.segmentFile(getContext(), id);
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

    // Ask other apps (music, podcasts) to pause while the sample speaks.
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

    // ── Whole meditation, played natively so it survives the screen turning off ────────────────

    @PluginMethod
    public void startSession(PluginCall call) {
        JSArray lines = call.getArray("lines");
        String model = call.getString("model", "supertonic");
        if (lines == null || lines.length() == 0) {
            call.reject("lines are required");
            return;
        }
        final int n = lines.length();
        final String[] ids = new String[n];
        final String[] texts = new String[n];
        final long[] pauses = new long[n];
        try {
            for (int i = 0; i < n; i++) {
                JSONObject line = lines.getJSONObject(i);
                ids[i] = line.getString("id");
                texts[i] = line.getString("text");
                pauses[i] = Math.max(0, line.optLong("pauseMs", 1500));
            }
        } catch (Exception e) {
            call.reject("Bad lines: " + e.getMessage());
            return;
        }
        final String title = call.getString("title", "Meditation");
        final int sid = call.getInt("sid", 0);
        final float speed = call.getFloat("speed", 0.75f);
        final int steps = call.getInt("steps", 0);
        final int lead = call.getInt("lead", 2);

        getActivity().runOnUiThread(() -> {
            try {
                if (MeditationSession.current != null) MeditationSession.current.stop();
                finishPlayback(true);
                MeditationSession session = new MeditationSession(
                    getContext(), title, ids, texts, pauses, model, sid, speed, steps, lead);
                session.begin();
                MeditationService.start(getContext());
                call.resolve();
            } catch (Throwable e) {
                if (MeditationSession.current != null) MeditationSession.current.stop();
                call.reject("Could not start playback: " + e.getMessage());
            }
        });
    }

    private void withSession(PluginCall call, java.util.function.Consumer<MeditationSession> action) {
        getActivity().runOnUiThread(() -> {
            MeditationSession session = MeditationSession.current;
            if (session != null) action.accept(session);
            call.resolve();
        });
    }

    @PluginMethod
    public void pauseSession(PluginCall call) {
        withSession(call, MeditationSession::pause);
    }

    @PluginMethod
    public void resumeSession(PluginCall call) {
        withSession(call, MeditationSession::resume);
    }

    @PluginMethod
    public void skipSession(PluginCall call) {
        int by = call.getInt("by", 1);
        withSession(call, session -> session.skip(by));
    }

    @PluginMethod
    public void stopSession(PluginCall call) {
        withSession(call, MeditationSession::stop);
    }

    /** The current session's state, for the app to catch up after being in the background. */
    @PluginMethod
    public void sessionState(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            MeditationSession session = MeditationSession.current;
            call.resolve(session != null ? state(session.status(), session.index()) : state("none", 0));
        });
    }

    // ── Housekeeping ───────────────────────────────────────────────────────────────────────────

    /** Deletes generated speech whose id starts with the prefix (all of it when the prefix is empty). */
    @PluginMethod
    public void clearCache(PluginCall call) {
        String prefix = "seg-" + call.getString("prefix", "").replaceAll("[^A-Za-z0-9_-]", "");
        VoiceCore.WORKER.execute(() -> {
            File[] files = VoiceCore.voiceCacheDir(getContext()).listFiles();
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
        MeditationSession.listener = null;
        if (MeditationSession.current != null) MeditationSession.current.stop();
    }
}
