package com.anxietycompanion.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;

import androidx.core.content.ContextCompat;

/**
 * Plays one meditation line by line, natively, so it keeps going with the screen off.
 * Lines are generated ahead on VoiceCore.WORKER; everything else happens on the main thread.
 */
final class MeditationSession {
    interface Listener {
        void onState(String status, int index);
    }

    static final String PREPARING = "preparing";
    static final String PLAYING = "playing";
    static final String PAUSED = "paused";
    static final String DONE = "done";
    static final String ERROR = "error";
    static final String STOPPED = "stopped";

    /** The one active session, if any. Main thread only. */
    static MeditationSession current;
    static Listener listener;
    /** How the most recent session ended, so the app can catch up if it missed the event. */
    static String lastStatus = "none";
    static int lastIndex;

    final String title;
    private final Context app;
    private final String[] ids;
    private final String[] texts;
    private final long[] pauseMs;
    private final VoiceCore.Spec voice;
    private final int lead;
    private final long tailMs;

    private final Handler main = new Handler(Looper.getMainLooper());
    private final boolean[] ready;
    private String status = PREPARING;
    private int index;
    /** One line at a time is being generated; main thread only. */
    private boolean generating;
    /** Waiting for a few lines to be ready, at the start or after jumping somewhere not yet generated. */
    private boolean buffering = true;
    private volatile boolean ended;
    /** Bumped whenever scheduled playback steps must no longer run. */
    private int token;
    /** While in the silence after a line: when that silence ends (elapsedRealtime), else 0. */
    private long gapEndsAt;
    private int resumeIndex;
    private long resumeDelay;
    private MediaPlayer player;
    private PowerManager.WakeLock wakeLock;
    private AudioFocusRequest focusRequest;
    /** Paused by a phone call or another app's sound, to be resumed when it ends. */
    private boolean pausedByFocus;

    private final BroadcastReceiver noisyReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            pause(); // headphones unplugged: don't carry on through the speaker
        }
    };

    MeditationSession(Context context, String title, String[] ids, String[] texts, long[] pauseMs,
                      VoiceCore.Spec voice, int lead, int startIndex) {
        this.app = context.getApplicationContext();
        this.title = title;
        this.ids = ids;
        this.texts = texts;
        this.pauseMs = pauseMs;
        this.voice = voice;
        this.tailMs = voice.tailMs();
        this.lead = Math.max(1, Math.min(lead, ids.length));
        this.ready = new boolean[ids.length];
        this.index = Math.max(0, Math.min(startIndex, ids.length - 1));
    }

    String status() {
        return status;
    }

    int index() {
        return index;
    }

    void begin() {
        current = this;
        lastStatus = "none";
        ContextCompat.registerReceiver(app, noisyReceiver,
            new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY), ContextCompat.RECEIVER_NOT_EXPORTED);
        holdAwake(true);
        Ambience.session(true, 2.5f);
        emit(PREPARING);
        VoiceCore.WORKER.execute(() -> VoiceCore.pruneProcessed(app, voice));
        generateNext();
    }

    /**
     * Generates lines one at a time, always the next one the listener will reach: from the
     * current line to the end, then anything skipped over. Jumping around re-aims it.
     */
    private void generateNext() {
        if (ended || generating) return;
        int next = -1;
        for (int i = index; i < ids.length && next < 0; i++) if (!ready[i]) next = i;
        for (int i = 0; i < index && next < 0; i++) if (!ready[i]) next = i;
        if (next < 0) return;
        final int line = next;
        generating = true;
        VoiceCore.WORKER.execute(() -> {
            if (ended) return;
            try {
                VoiceCore.synthesize(app, ids[line], texts[line], voice);
                main.post(() -> onReady(line));
            } catch (Throwable e) {
                main.post(() -> end(ERROR));
            }
        });
    }

    private void onReady(int line) {
        if (ended) return;
        generating = false;
        ready[line] = true;
        if (PREPARING.equals(status)) startLine(index, token);
        generateNext();
    }

    private boolean canStart(int line) {
        if (!ready[line]) return false;
        if (!buffering) return true;
        // Have a few lines in hand before speaking, so what follows isn't full of stalls.
        int end = Math.min(ids.length, line + lead);
        for (int i = line; i < end; i++) if (!ready[i]) return false;
        return true;
    }

    private void startLine(int line, int forToken) {
        if (ended || forToken != token) return;
        if (line >= ids.length) {
            end(DONE);
            return;
        }
        index = line;
        gapEndsAt = 0;
        if (!canStart(line)) {
            buffering = true;
            if (!PREPARING.equals(status)) emit(PREPARING);
            return;
        }
        buffering = false;
        releasePlayer();
        MediaPlayer mp = new MediaPlayer();
        try {
            mp.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build());
            mp.setDataSource(VoiceCore.playFile(app, ids[line], voice).getAbsolutePath());
            mp.setOnCompletionListener(p -> onLineFinished(line, forToken));
            mp.setOnErrorListener((p, what, extra) -> {
                if (forToken == token) end(ERROR);
                return true;
            });
            mp.prepare();
            player = mp;
            if (!requestFocus()) {
                // Something with priority is using the speaker (a phone call): wait for it.
                pauseForFocus();
                return;
            }
            mp.start();
            emit(PLAYING);
        } catch (Throwable e) {
            try { mp.release(); } catch (Throwable ignored) {}
            end(ERROR);
        }
    }

    private void onLineFinished(int line, int forToken) {
        if (ended || forToken != token) return;
        // The room sound has already filled the first part of the silence.
        long gap = Math.max(150, pauseMs[line] - tailMs);
        gapEndsAt = SystemClock.elapsedRealtime() + gap;
        main.postDelayed(() -> startLine(line + 1, forToken), gap);
    }

    void pause() {
        pausedByFocus = false;
        pauseKeepingFocus();
        abandonFocus();
    }

    private void pauseForFocus() {
        pauseKeepingFocus();
        pausedByFocus = true;
    }

    private void pauseKeepingFocus() {
        if (ended || PAUSED.equals(status)) return;
        token++;
        if (gapEndsAt > 0) {
            // In the silence after a line: resume with what's left of it, not by repeating the line.
            resumeIndex = index + 1;
            resumeDelay = Math.max(0, gapEndsAt - SystemClock.elapsedRealtime());
        } else {
            resumeIndex = index;
            resumeDelay = 0;
        }
        releasePlayer();
        holdAwake(false);
        Ambience.session(false, 0.8f);
        emit(PAUSED);
    }

    void resume() {
        if (ended || !PAUSED.equals(status)) return;
        pausedByFocus = false;
        holdAwake(true);
        Ambience.session(true, 1.2f);
        final int t = ++token;
        if (resumeDelay > 0 && resumeIndex > 0) {
            index = resumeIndex - 1;
            gapEndsAt = SystemClock.elapsedRealtime() + resumeDelay;
            emit(PLAYING);
            main.postDelayed(() -> startLine(resumeIndex, t), resumeDelay);
        } else {
            startLine(resumeIndex, t);
        }
    }

    void skip(int by) {
        if (ended) return;
        // Paused inside the silence after a line: that line is still the current one.
        int base = PAUSED.equals(status) ? (resumeDelay > 0 ? resumeIndex - 1 : resumeIndex) : index;
        seek(base + by);
    }

    /** Jumps to a line; past the last one ends the meditation. Stays paused if paused. */
    void seek(int line) {
        if (ended) return;
        int target = Math.max(0, line);
        final int t = ++token;
        releasePlayer();
        if (target >= ids.length) {
            end(DONE);
            return;
        }
        if (PAUSED.equals(status)) {
            resumeIndex = target;
            resumeDelay = 0;
            index = target;
            emit(PAUSED);
        } else {
            startLine(target, t);
        }
        generateNext();
    }

    void stop() {
        end(STOPPED, true);
    }

    /** Ends this session because another is about to start; the playback service stays up for it. */
    void replace() {
        end(STOPPED, false);
    }

    private void end(String finalStatus) {
        end(finalStatus, true);
    }

    private void end(String finalStatus, boolean stopService) {
        if (ended) return;
        ended = true;
        token++;
        releasePlayer();
        abandonFocus();
        try { app.unregisterReceiver(noisyReceiver); } catch (Throwable ignored) {}
        if (current == this) current = null;
        lastStatus = finalStatus;
        lastIndex = index;
        emit(finalStatus);
        if (!stopService) {
            // Another session is taking over: it keeps the service and the background sounds.
            holdAwake(false);
        } else if (DONE.equals(finalStatus) && Ambience.audible()) {
            // Let the background sounds fade away slowly, and stay awake until they have.
            Ambience.session(false, 5f);
            main.postDelayed(() -> {
                holdAwake(false);
                if (current == null) MeditationService.stop();
            }, 5500);
        } else {
            Ambience.session(false, 0.6f);
            holdAwake(false);
            MeditationService.stop();
        }
    }

    private void emit(String next) {
        status = next;
        if (listener != null) listener.onState(status, index);
        if (!ended) MeditationService.refresh(app);
    }

    private void releasePlayer() {
        if (player != null) {
            try { player.release(); } catch (Throwable ignored) {}
            player = null;
        }
    }

    // Keeps the processor running with the screen off while a meditation is playing.
    private void holdAwake(boolean on) {
        if (on) {
            if (wakeLock == null) {
                PowerManager pm = (PowerManager) app.getSystemService(Context.POWER_SERVICE);
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "AnxietyCompanion:meditation");
                wakeLock.setReferenceCounted(false);
            }
            wakeLock.acquire(3 * 60 * 60 * 1000L);
        } else if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
    }

    private boolean requestFocus() {
        if (Build.VERSION.SDK_INT < 26) return true;
        AudioManager am = (AudioManager) app.getSystemService(Context.AUDIO_SERVICE);
        if (focusRequest == null) {
            focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAcceptsDelayedFocusGain(true)
                .setOnAudioFocusChangeListener(change -> main.post(() -> onFocusChange(change)))
                .build();
        }
        return am.requestAudioFocus(focusRequest) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
    }

    private void onFocusChange(int change) {
        if (ended) return;
        if (change == AudioManager.AUDIOFOCUS_LOSS) {
            pause(); // another player took over for good
        } else if (change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
            if (!PAUSED.equals(status)) pauseForFocus(); // a phone call or an assistant prompt
        } else if (change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK) {
            if (player != null) player.setVolume(0.25f, 0.25f); // e.g. a navigation prompt
            Ambience.duck(true);
        } else if (change == AudioManager.AUDIOFOCUS_GAIN) {
            if (player != null) player.setVolume(1f, 1f);
            Ambience.duck(false);
            if (pausedByFocus) resume();
        }
    }

    private void abandonFocus() {
        if (focusRequest == null || Build.VERSION.SDK_INT < 26) return;
        AudioManager am = (AudioManager) app.getSystemService(Context.AUDIO_SERVICE);
        am.abandonAudioFocusRequest(focusRequest);
    }
}
