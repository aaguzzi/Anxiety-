package com.anxietycompanion.app;

/**
 * Post-processing for generated speech. Pure Java with no Android dependencies, so the same code
 * can be run on a desktop to audition settings.
 *
 * level: evens out loudness, because the voices differ a lot in how loud they come out.
 * softness (0..1): tilts the tone darker and warmer, taking the edge off bright voices.
 * space (0..1): adds a short, dark room reverb so the voice doesn't sound dry and close-miked.
 */
final class VoiceFx {
    private VoiceFx() {}

    /** Loudness every line is brought to, measured over the parts where the voice is speaking. */
    private static final float TARGET_LOUDNESS = 0.1f;

    /**
     * Brings one line to the standard loudness. The whole line is scaled by one factor, so the
     * natural rise and fall inside a sentence is kept. Loudness is measured the way it is heard,
     * especially on a phone speaker: bass counts for little and the upper range for more, so a
     * deep voice doesn't come out quieter than a bright one.
     */
    static float[] level(float[] in, int sampleRate) {
        final int frame = Math.max(1, sampleRate / 50);
        final int frames = in.length / frame;
        if (frames == 0) return in.clone();
        float[] heard = in.clone();
        biquad(heard, highPass(sampleRate, 200));
        biquad(heard, highShelf(sampleRate, 1500, 4));
        double[] power = new double[frames];
        double loudest = 0;
        for (int f = 0; f < frames; f++) {
            double sum = 0;
            for (int i = f * frame; i < (f + 1) * frame; i++) sum += heard[i] * heard[i];
            power[f] = sum / frame;
            loudest = Math.max(loudest, power[f]);
        }
        // Ignore the gaps between words: only frames within 26 dB of the loudest count as speech.
        final double gate = Math.max(loudest * 0.0025, 1e-6);
        double sum = 0;
        int active = 0;
        for (double p : power) {
            if (p >= gate) {
                sum += p;
                active++;
            }
        }
        if (active == 0) return in.clone();
        float g = TARGET_LOUDNESS / (float) Math.sqrt(sum / active);
        g = Math.max(0.5f, Math.min(3f, g));
        float peak = 0;
        for (float v : in) peak = Math.max(peak, Math.abs(v));
        if (peak * g > 0.95f) g = 0.95f / peak;
        float[] out = in.clone();
        gain(out, g);
        return out;
    }

    static float[] apply(float[] in, int sampleRate, float softness, float space) {
        softness = clamp01(softness);
        space = clamp01(space);
        float[] x = in.clone();

        if (softness > 0) {
            // Presence and sibilance down, a little chest warmth up.
            biquad(x, highShelf(sampleRate, 2500, -12f * softness));
            biquad(x, highShelf(sampleRate, 7500, -4f * softness));
            biquad(x, lowShelf(sampleRate, 220, 2f * softness));
            gain(x, db(1f * softness)); // darker sounds quieter; keep loudness roughly level
        }

        fadeEdges(x, sampleRate);
        if (space > 0) x = reverb(x, sampleRate, space);
        limit(x);
        return x;
    }

    /** How much longer a line gets when the room sound is added. */
    static double tailSeconds(float space) {
        return 0.6 + 0.9 * clamp01(space);
    }

    private static float clamp01(float v) {
        return Math.max(0f, Math.min(1f, v));
    }

    private static float db(float decibels) {
        return (float) Math.pow(10, decibels / 20.0);
    }

    private static void gain(float[] x, float g) {
        for (int i = 0; i < x.length; i++) x[i] *= g;
    }

    // ── Shelving filters (RBJ audio EQ cookbook, shelf slope 1) ────────────────────────────────

    /** Normalised coefficients {b0, b1, b2, a1, a2}. */
    private static double[] highShelf(int sr, double freq, double gainDb) {
        double a = Math.pow(10, gainDb / 40.0);
        double w = 2 * Math.PI * freq / sr;
        double cos = Math.cos(w);
        double alpha = Math.sin(w) / 2 * Math.sqrt(2);
        double sq = 2 * Math.sqrt(a) * alpha;
        double a0 = (a + 1) - (a - 1) * cos + sq;
        return new double[] {
            a * ((a + 1) + (a - 1) * cos + sq) / a0,
            -2 * a * ((a - 1) + (a + 1) * cos) / a0,
            a * ((a + 1) + (a - 1) * cos - sq) / a0,
            2 * ((a - 1) - (a + 1) * cos) / a0,
            ((a + 1) - (a - 1) * cos - sq) / a0,
        };
    }

    private static double[] lowShelf(int sr, double freq, double gainDb) {
        double a = Math.pow(10, gainDb / 40.0);
        double w = 2 * Math.PI * freq / sr;
        double cos = Math.cos(w);
        double alpha = Math.sin(w) / 2 * Math.sqrt(2);
        double sq = 2 * Math.sqrt(a) * alpha;
        double a0 = (a + 1) + (a - 1) * cos + sq;
        return new double[] {
            a * ((a + 1) - (a - 1) * cos + sq) / a0,
            2 * a * ((a - 1) - (a + 1) * cos) / a0,
            a * ((a + 1) - (a - 1) * cos - sq) / a0,
            -2 * ((a - 1) + (a + 1) * cos) / a0,
            ((a + 1) + (a - 1) * cos - sq) / a0,
        };
    }

    private static double[] highPass(int sr, double freq) {
        double w = 2 * Math.PI * freq / sr;
        double cos = Math.cos(w);
        double alpha = Math.sin(w) / Math.sqrt(2);
        double a0 = 1 + alpha;
        return new double[] {
            (1 + cos) / 2 / a0,
            -(1 + cos) / a0,
            (1 + cos) / 2 / a0,
            -2 * cos / a0,
            (1 - alpha) / a0,
        };
    }

    private static void biquad(float[] x, double[] c) {
        double x1 = 0, x2 = 0, y1 = 0, y2 = 0;
        for (int i = 0; i < x.length; i++) {
            double in = x[i];
            double out = c[0] * in + c[1] * x1 + c[2] * x2 - c[3] * y1 - c[4] * y2;
            x2 = x1;
            x1 = in;
            y2 = y1;
            y1 = out;
            x[i] = (float) out;
        }
    }

    // ── Edges ──────────────────────────────────────────────────────────────────────────────────

    /** Short fades so a line never starts or stops with a click. */
    private static void fadeEdges(float[] x, int sr) {
        int n = Math.min(x.length / 2, sr / 100);
        for (int i = 0; i < n; i++) {
            float g = i / (float) n;
            x[i] *= g;
            x[x.length - 1 - i] *= g;
        }
    }

    /** Scales the whole line down if processing pushed any sample past full scale. */
    private static void limit(float[] x) {
        float peak = 0;
        for (float v : x) peak = Math.max(peak, Math.abs(v));
        if (peak > 0.97f) gain(x, 0.97f / peak);
    }

    // ── Reverb (Freeverb topology: 8 damped combs in parallel, then 4 all-passes) ──────────────

    private static final int[] COMBS = {1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617};
    private static final int[] ALLPASSES = {556, 441, 341, 225};

    private static float[] reverb(float[] dry, int sr, float amount) {
        final double scale = sr / 44100.0;
        final float feedback = 0.80f;   // room size: a small, quiet room
        final float damp = 0.55f;       // high damping keeps the tail dark and unobtrusive
        final float wet = 0.36f * amount;    // "a little" sits about 25 dB under the voice, full about 10 dB
        final int preDelay = (int) (0.018 * sr);
        final int tail = (int) (sr * tailSeconds(amount));

        float[][] combBuf = new float[COMBS.length][];
        float[] combStore = new float[COMBS.length];
        int[] combPos = new int[COMBS.length];
        for (int i = 0; i < COMBS.length; i++) combBuf[i] = new float[(int) Math.round(COMBS[i] * scale)];
        float[][] apBuf = new float[ALLPASSES.length][];
        int[] apPos = new int[ALLPASSES.length];
        for (int i = 0; i < ALLPASSES.length; i++) apBuf[i] = new float[(int) Math.round(ALLPASSES[i] * scale)];

        float[] out = new float[dry.length + tail];
        for (int n = 0; n < out.length; n++) {
            int src = n - preDelay;
            float input = (src >= 0 && src < dry.length ? dry[src] : 0f) * 0.015f;
            float acc = 0;
            for (int i = 0; i < combBuf.length; i++) {
                float[] buf = combBuf[i];
                float y = buf[combPos[i]];
                combStore[i] = y * (1 - damp) + combStore[i] * damp;
                buf[combPos[i]] = input + combStore[i] * feedback;
                if (++combPos[i] == buf.length) combPos[i] = 0;
                acc += y;
            }
            for (int i = 0; i < apBuf.length; i++) {
                float[] buf = apBuf[i];
                float buffered = buf[apPos[i]];
                float y = buffered - acc;
                buf[apPos[i]] = acc + buffered * 0.5f;
                if (++apPos[i] == buf.length) apPos[i] = 0;
                acc = y;
            }
            out[n] = (n < dry.length ? dry[n] : 0f) + acc * wet * 3f;
        }
        // Let the tail die away to nothing by the end of the file.
        int fade = Math.min(tail, sr / 4);
        for (int i = 0; i < fade; i++) out[out.length - 1 - i] *= i / (float) fade;
        return out;
    }
}
