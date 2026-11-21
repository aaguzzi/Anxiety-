package com.anxietycompanion.app;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

/** Minimal reader and writer for 16-bit PCM WAV files. Pure Java, so it also runs on a desktop. */
final class Wav {
    /** First channel only, if the file has more than one. */
    final short[] pcm;
    final int sampleRate;

    private Wav(short[] pcm, int sampleRate) {
        this.pcm = pcm;
        this.sampleRate = sampleRate;
    }

    float[] samples() {
        float[] out = new float[pcm.length];
        for (int i = 0; i < out.length; i++) out[i] = pcm[i] / 32768f;
        return out;
    }

    static Wav read(File file) throws IOException {
        try (InputStream in = new FileInputStream(file)) {
            return read(in);
        }
    }

    static Wav read(InputStream in) throws IOException {
        ByteArrayOutputStream all = new ByteArrayOutputStream(1 << 20);
        byte[] chunk = new byte[65536];
        int n;
        while ((n = in.read(chunk)) > 0) all.write(chunk, 0, n);
        ByteBuffer b = ByteBuffer.wrap(all.toByteArray()).order(ByteOrder.LITTLE_ENDIAN);
        if (b.remaining() < 12 || b.getInt(0) != 0x46464952 || b.getInt(8) != 0x45564157) {
            throw new IOException("Not a WAV file");
        }
        int channels = 1;
        int rate = 0;
        int bits = 16;
        int at = 12;
        while (at + 8 <= b.limit()) {
            int id = b.getInt(at);
            int size = Math.min(b.getInt(at + 4) & 0x7fffffff, b.limit() - at - 8);
            int body = at + 8;
            if (id == 0x20746d66 && size >= 16) {            // "fmt "
                if (b.getShort(body) != 1) throw new IOException("Unsupported WAV encoding");
                channels = Math.max(1, b.getShort(body + 2));
                rate = b.getInt(body + 4);
                bits = b.getShort(body + 14);
            } else if (id == 0x61746164) {                   // "data"
                if (bits != 16 || rate <= 0) throw new IOException("Unsupported WAV format");
                int frames = size / (2 * channels);
                short[] pcm = new short[frames];
                for (int i = 0; i < frames; i++) pcm[i] = b.getShort(body + i * 2 * channels);
                return new Wav(pcm, rate);
            }
            at = body + size + (size & 1);
        }
        throw new IOException("WAV file has no audio");
    }

    /** Writes mono 16-bit audio, replacing the file only once it is complete. */
    static void write(File file, float[] samples, int sampleRate) throws IOException {
        int dataBytes = samples.length * 2;
        ByteBuffer b = ByteBuffer.allocate(44 + dataBytes).order(ByteOrder.LITTLE_ENDIAN);
        b.putInt(0x46464952).putInt(36 + dataBytes).putInt(0x45564157);
        b.putInt(0x20746d66).putInt(16).putShort((short) 1).putShort((short) 1);
        b.putInt(sampleRate).putInt(sampleRate * 2).putShort((short) 2).putShort((short) 16);
        b.putInt(0x61746164).putInt(dataBytes);
        for (float v : samples) {
            b.putShort((short) Math.round(Math.max(-1f, Math.min(1f, v)) * 32767f));
        }
        File tmp = new File(file.getPath() + ".part");
        try (OutputStream out = new FileOutputStream(tmp)) {
            out.write(b.array());
        }
        if (!tmp.renameTo(file)) {
            tmp.delete();
            throw new IOException("Could not save audio");
        }
    }
}
