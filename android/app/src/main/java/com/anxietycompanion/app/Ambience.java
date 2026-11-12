package com.anxietycompanion.app;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;

import java.io.InputStream;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

/**
 * Background sound layers (rain, waves, noise, a drone…) mixed live under a meditation. Each layer
 * is a short loop from the app's assets with its own volume, so layers can be switched on and off
 * while playing. Sound comes out while a meditation session is playing, or while the app asks for
 * a preview and is on screen; changes always fade. The loops are only held in memory while they
 * are in use.
 */
final class Ambience {
    static final String ASSETS = "ambience";

    private static final int SAMPLE_RATE = 32000;
    private static final int FRAMES = 1024;
    /** Gain of a layer at full volume; the slider is squared so it feels even. */
    private static final float MAX_GAIN = 1.25f;
    /** Several loud layers together are turned down to stay under this, rather than left to distort. */
    private static final float CEILING = 0.92f * 32767f;
    /** How much of that turning down is given back per buffer once the mix is quieter again. */
    private static final float RELEASE = 0.004f;
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
    // Everything below is guarded by LOCK unless it is volatile.
    private static final Map<String, Layer> LAYERS = new LinkedHashMap<>();
    private static Context app;
    private static boolean sessionOn;
    /** A meditation session exists, playing or paused: keep its loops loaded across pauses. */
    private static boolean sessionAlive;
    private static boolean previewOn;
    /** The app is on screen. A preview is only heard while it is. */
    private static boolean visible = true;
    private static Thread thread;
    private static volatile float fadeSeconds = 1f;
    private static volatile float duck = 1f;

    /** Loops are read one at a time: each needs a few megabytes while it is being read. */
    private static final ThreadPoolExecutor LOADER = new ThreadPoolExecutor(
        1, 1, 5, TimeUnit.SECONDS, new LinkedBlockingQueue<>(), task -> {
            Thread t = new Thread(task, "ambience-load");
            t.setDaemon(true);
            return t;
        });

    static {
        LOADER.allowCoreThreadTimeOut(true);
    }

    private Ambience() {}

    static boolean available(Context context) {
        return VoiceCore.bundled(context, ASSETS, "rain.wav");
    }

    /** Sets every layer's volume (0..1); layers not mentioned are switched off. */
    static void setLevels(Context context, Map<String, Float> volumes) {
        synchronized (LOCK) {
            app = context.getApplicationContext();
            for (String id : volumes.keySet()) {
                if (!LAYERS.containsKey(id) && id.matches("[a-z0-9-]+")) LAYERS.put(id, new Layer(id));
            }
            for (Layer layer : LAYERS.values()) {
                Float v = volumes.get(layer.id);
                float volume = v == null ? 0f : Math.max(0f, Math.min(1f, v));
                layer.target = MAX_GAIN * volume * volume;
            }
            wake();
        }
    }

    /**
     * A meditation started or resumed (on), or paused or ended (off). Pass alive = false when the
     * session is over, so the loops can be let go once they have faded out.
     */
    static void session(boolean on, boolean alive, float fade) {
        synchronized (LOCK) {
            sessionOn = on;
            sessionAlive = alive;
            fadeSeconds = fade;
            duck = 1f; // whatever asked for quiet belonged to the moment before
            wake();
        }
    }

    /** Lets the chosen sounds be heard while they are being set up, with no meditation playing. */
    static void preview(boolean on) {
        synchronized (LOCK) {
            if (previewOn == on) return;
            previewOn = on;
            if (!sessionOn) fadeSeconds = 0.5f;
            wake();
        }
    }

    /** The app came on screen or left it. A preview stops while nobody is looking at the app. */
    static void visible(boolean on) {
        synchronized (LOCK) {
            if (visible == on) return;
            visible = on;
            if (!sessionOn && previewOn) fadeSeconds = 0.5f;
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
        if (!sessionOn && !(previewOn && visible)) return false;
        for (Layer layer : LAYERS.values()) if (layer.target > 0) return true;
        return false;
    }

    /**
     * Call with LOCK held, when no mixer is running or the mixer itself is leaving: drops the loops
     * nothing is going to play. A paused meditation keeps the ones that are switched on, to resume
     * without a gap.
     */
    private static void letGo() {
        for (Layer layer : LAYERS.values()) {
            if (layer.target <= 0 || !sessionAlive) {
                layer.data = null;
                layer.gain = 0;
            }
        }
    }

    /** Call with LOCK held, after anything that decides whether sound should be coming out. */
    private static void wake() {
        if (!wanted()) {
            // No mixer is running to let go of the loops on its way out (a meditation stopped
            // while it was paused, say): do it here.
            if (thread == null) letGo();
            return;
        }
        for (Layer layer : LAYERS.values()) {
            if (layer.target > 0 && layer.data == null && !layer.loading) load(layer);
        }
        if (thread == null) {
            thread = new Thread(Ambience::run, "ambience");
            thread.setDaemon(true);
            thread.start();
        }
    }

    private static void load(Layer layer) {
        final Context context = app;
        if (context == null) return;
        layer.loading = true;
        LOADER.execute(() -> {
            short[] loop = null;
            try {
                if (layer.target > 0) {
                    try (InputStream in = context.getAssets().open(ASSETS + "/" + layer.id + ".wav")) {
                        loop = Wav.read(in).pcm;
                    }
                }
            } catch (Throwable e) {
                // This build doesn't include that sound; the layer stays silent.
            }
            synchronized (LOCK) {
                layer.loading = false;
                // Nothing is playing any more, or this sound was switched off under a paused
                // meditation: don't hold on to a loop nobody is listening to.
                if (loop != null && (thread != null || (sessionAlive && layer.target > 0))) layer.data = loop;
            }
        });
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

    private static void close(AudioTrack track) {
        if (track == null) return;
        try {
            track.pause();
            track.flush();
        } catch (Throwable ignored) {}
        try {
            track.release();
        } catch (Throwable ignored) {}
    }

    /** The most the mix can be multiplied by and still stay under the ceiling. */
    private static float headroom(float peak) {
        return peak > CEILING ? CEILING / peak : 1f;
    }

    private static void run() {
        try {
            // Speech is generated on several cores at once; the sound must not stutter behind it.
            android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_AUDIO);
        } catch (Throwable ignored) {}
        AudioTrack track = null;
        // Each buffer is mixed one step ahead of being played, so that loud passages can be turned
        // down smoothly before they arrive instead of being clipped when they do.
        float[] heldLeft = new float[FRAMES];
        float[] heldRight = new float[FRAMES];
        float[] left = new float[FRAMES];
        float[] right = new float[FRAMES];
        final short[] out = new short[FRAMES * 2];
        boolean held = false;
        float heldPeak = 0f;
        float trim = 1f;
        float master = 0f;
        int failures = 0;
        try {
            while (true) {
                final boolean on;
                final Layer[] layers;
                synchronized (LOCK) {
                    on = wanted();
                    if (!on && master <= 0f && !held) {
                        // Faded out with nothing more to play.
                        letGo();
                        thread = null;
                        return;
                    }
                    layers = LAYERS.values().toArray(new Layer[0]);
                }
                if (track == null) track = open();

                // Faded to nothing: only the buffer still held back is left to play.
                final boolean finishing = !on && master <= 0f;
                float peak = 0f;
                if (!finishing) {
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
                        left[i] *= g;
                        right[i] *= g;
                        peak = Math.max(peak, Math.max(Math.abs(left[i]), Math.abs(right[i])));
                        m += slope;
                    }
                    master = next;
                }

                if (held) {
                    // End this buffer no louder than it, or the one after it, can take.
                    final float room = finishing ? headroom(heldPeak) : Math.min(headroom(heldPeak), headroom(peak));
                    final float to = Math.min(room, trim + RELEASE);
                    final float step = (to - trim) / FRAMES;
                    float t = trim;
                    for (int i = 0; i < FRAMES; i++) {
                        out[2 * i] = clip(heldLeft[i] * t);
                        out[2 * i + 1] = clip(heldRight[i] * t);
                        t += step;
                    }
                    trim = to;
                    if (track.write(out, 0, out.length) < 0) {
                        // The audio output went away (the phone's audio service restarted): open another.
                        close(track);
                        track = null;
                        if (++failures > 3) {
                            synchronized (LOCK) {
                                thread = null;
                            }
                            return;
                        }
                        Thread.sleep(200);
                    } else {
                        failures = 0;
                    }
                }

                if (finishing) {
                    held = false;
                    continue;
                }
                // Coming out of silence there is nothing before this buffer to glide from.
                if (!held) trim = Math.min(trim, headroom(peak));
                final float[] l = heldLeft;
                final float[] r = heldRight;
                heldLeft = left;
                heldRight = right;
                left = l;
                right = r;
                heldPeak = peak;
                held = true;
            }
        } catch (Throwable e) {
            synchronized (LOCK) {
                thread = null;
            }
        } finally {
            close(track);
        }
    }

    private static short clip(float v) {
        return (short) Math.max(-32768f, Math.min(32767f, v));
    }
}
