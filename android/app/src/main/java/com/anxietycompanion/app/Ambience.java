package com.anxietycompanion.app;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;

import java.io.InputStream;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Background sound layers (rain, waves, noise, a drone…) mixed live under a meditation. Each layer
 * is a short loop from the app's assets with its own volume, so layers can be switched on and off
 * while playing. Sound comes out while a meditation session is playing, or while the app asks for
 * a preview; changes always fade.
 */
final class Ambience {
    static final String ASSETS = "ambience";

    private static final int SAMPLE_RATE = 32000;
    private static final int FRAMES = 1024;
    /** Gain of a layer at full volume; the slider is squared so it feels even. */
    private static final float MAX_GAIN = 1.25f;
    /** Layers whose two ears should hear the same moment of the loop: tones would clash otherwise. */
    private static final String[] CENTRED = {"drone", "bowls"};
    /** Layers that swell and fade: a short offset keeps both ears on the same wave. */
    private static final String[] SWELLING = {"ocean", "wind"};

    private static final class Layer {
        final String id;
        /** Wanted gain, set from any thread. */
        volatile float target;
        /** The loop; null until loaded. */
        volatile short[] data;
        /** Guarded by LOCK. */
        boolean loading;
        // Mixer thread only.
        float gain;
        int pos;

        Layer(String id) {
            this.id = id;
        }

        /** How far the right ear plays behind the left, to turn one loop into wide stereo. */
        int stereoOffset(int length) {
            if (Arrays.asList(CENTRED).contains(id)) return 0;
            if (Arrays.asList(SWELLING).contains(id)) return Math.min(length / 2, SAMPLE_RATE * 3 / 10);
            return length / 2;
        }
    }

    private static final Object LOCK = new Object();
    private static final Map<String, Layer> LAYERS = new LinkedHashMap<>();
    private static boolean sessionOn;
    private static boolean previewOn;
    private static Thread thread;
    private static volatile float fadeSeconds = 1f;
    private static volatile float duck = 1f;

    private Ambience() {}

    static boolean available(Context context) {
        return VoiceCore.bundled(context, ASSETS, "rain.wav");
    }

    /** Sets every layer's volume (0..1); layers not mentioned are switched off. */
    static void setLevels(Context context, Map<String, Float> volumes) {
        final Context app = context.getApplicationContext();
        synchronized (LOCK) {
            for (String id : volumes.keySet()) {
                if (!LAYERS.containsKey(id) && id.matches("[a-z0-9-]+")) LAYERS.put(id, new Layer(id));
            }
            for (Layer layer : LAYERS.values()) {
                Float v = volumes.get(layer.id);
                float volume = v == null ? 0f : Math.max(0f, Math.min(1f, v));
                layer.target = MAX_GAIN * volume * volume;
                if (layer.target > 0 && layer.data == null && !layer.loading) load(app, layer);
            }
            wake();
        }
    }

    /** A meditation started or resumed (on), or paused or ended (off). */
    static void session(boolean on, float fade) {
        synchronized (LOCK) {
            sessionOn = on;
            fadeSeconds = fade;
            wake();
        }
    }

    /** Lets the chosen sounds be heard while they are being set up, with no meditation playing. */
    static void preview(boolean on) {
        synchronized (LOCK) {
            previewOn = on;
            fadeSeconds = 0.5f;
            wake();
        }
    }

    /** Quieter while something else briefly needs to be heard (e.g. a navigation prompt). */
    static void duck(boolean on) {
        duck = on ? 0.3f : 1f;
    }

    /** True if background sound is coming out, or about to. */
    static boolean audible() {
        synchronized (LOCK) {
            return wanted();
        }
    }

    // ── Internals ──────────────────────────────────────────────────────────────────────────────

    private static boolean wanted() {
        if (!sessionOn && !previewOn) return false;
        for (Layer layer : LAYERS.values()) if (layer.target > 0) return true;
        return false;
    }

    private static void wake() {
        if (wanted() && thread == null) {
            thread = new Thread(Ambience::run, "ambience");
            thread.setDaemon(true);
            thread.start();
        }
    }

    private static void load(Context app, Layer layer) {
        layer.loading = true;
        new Thread(() -> {
            try (InputStream in = app.getAssets().open(ASSETS + "/" + layer.id + ".wav")) {
                layer.data = Wav.read(in).pcm;
            } catch (Throwable e) {
                // This build doesn't include that sound; the layer stays silent.
            } finally {
                synchronized (LOCK) {
                    layer.loading = false;
                }
            }
        }, "ambience-load").start();
    }

    private static AudioTrack open() {
        int minBytes = AudioTrack.getMinBufferSize(SAMPLE_RATE,
            AudioFormat.CHANNEL_OUT_STEREO, AudioFormat.ENCODING_PCM_16BIT);
        AudioTrack track = new AudioTrack.Builder()
            .setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build())
            .setAudioFormat(new AudioFormat.Builder()
                .setSampleRate(SAMPLE_RATE)
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setChannelMask(AudioFormat.CHANNEL_OUT_STEREO)
                .build())
            .setBufferSizeInBytes(Math.max(minBytes, FRAMES * 4 * 3))
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build();
        track.play();
        return track;
    }

    private static void run() {
        AudioTrack track = null;
        final float[] left = new float[FRAMES];
        final float[] right = new float[FRAMES];
        final short[] out = new short[FRAMES * 2];
        float master = 0f;
        try {
            while (true) {
                final boolean on;
                final Layer[] layers;
                synchronized (LOCK) {
                    on = wanted();
                    if (!on && master <= 0f) {
                        // Faded out with nothing more to play: free the loops that are switched off.
                        for (Layer layer : LAYERS.values()) {
                            if (layer.target <= 0) {
                                layer.data = null;
                                layer.gain = 0;
                            }
                        }
                        thread = null;
                        return;
                    }
                    layers = LAYERS.values().toArray(new Layer[0]);
                }
                if (track == null) track = open();

                Arrays.fill(left, 0f);
                Arrays.fill(right, 0f);
                for (Layer layer : layers) {
                    final short[] data = layer.data;
                    final float target = layer.target;
                    final float from = layer.gain;
                    if (data == null || data.length == 0 || (from <= 0 && target <= 0)) continue;
                    // Glide to the wanted volume over a few buffers so switching never clicks.
                    float to = from + (target - from) * 0.25f;
                    if (Math.abs(target - to) < 1e-4f) to = target;
                    final float step = (to - from) / FRAMES;
                    final int length = data.length;
                    final int offset = layer.stereoOffset(length);
                    int p = layer.pos >= length ? 0 : layer.pos;
                    float gain = from;
                    for (int i = 0; i < FRAMES; i++) {
                        int q = p + offset;
                        if (q >= length) q -= length;
                        left[i] += data[p] * gain;
                        right[i] += data[q] * gain;
                        gain += step;
                        if (++p == length) p = 0;
                    }
                    layer.pos = p;
                    layer.gain = to;
                }

                final float goal = on ? duck : 0f;
                final float change = FRAMES / (Math.max(0.05f, fadeSeconds) * SAMPLE_RATE);
                final float next = master < goal ? Math.min(goal, master + change) : Math.max(goal, master - change);
                final float slope = (next - master) / FRAMES;
                float m = master;
                for (int i = 0; i < FRAMES; i++) {
                    final float g = m * m; // squared, so fades sound even rather than dropping away at the end
                    out[2 * i] = clip(left[i] * g);
                    out[2 * i + 1] = clip(right[i] * g);
                    m += slope;
                }
                master = next;
                if (track.write(out, 0, out.length) < 0) {
                    // The audio output went away; start afresh the next time sound is wanted.
                    synchronized (LOCK) {
                        thread = null;
                    }
                    return;
                }
            }
        } catch (Throwable e) {
            synchronized (LOCK) {
                thread = null;
            }
        } finally {
            if (track != null) {
                try {
                    track.pause();
                    track.flush();
                } catch (Throwable ignored) {}
                track.release();
            }
        }
    }

    private static short clip(float v) {
        return (short) Math.max(-32768f, Math.min(32767f, v));
    }
}
