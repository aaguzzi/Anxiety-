package com.anxietycompanion.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import androidx.media.app.NotificationCompat.MediaStyle;

/**
 * Foreground service that keeps the app alive while a meditation plays with the screen off.
 * It owns the media session, so the lock screen, headset buttons and volume keys treat the
 * meditation like any other audio, and shows the notification with pause/resume and stop.
 */
public class MeditationService extends Service {
    private static final String CHANNEL = "meditation-playback";
    private static final int NOTIFICATION_ID = 2001;
    private static final String ACTION_PAUSE = "com.anxietycompanion.app.PAUSE";
    private static final String ACTION_RESUME = "com.anxietycompanion.app.RESUME";
    private static final String ACTION_STOP = "com.anxietycompanion.app.STOP";

    /** Set once the service is in the foreground; main thread only. */
    private static MeditationService instance;

    private MediaSessionCompat mediaSession;

    static void start(Context context) {
        ContextCompat.startForegroundService(context, new Intent(context, MeditationService.class));
    }

    /** Redraws the notification and media session to match the session's state. */
    static void refresh(Context context) {
        if (instance == null || MeditationSession.current == null) return;
        instance.publish(MeditationSession.current);
    }

    // Stopping from outside before the service has entered the foreground crashes the app on
    // Android 8+, so the service only ever stops itself. If it hasn't started yet,
    // onStartCommand finds no session and stops then.
    static void stop() {
        if (instance == null) return;
        instance.stopForeground(STOP_FOREGROUND_REMOVE);
        instance.stopSelf();
    }

    private PendingIntent action(String action, int requestCode) {
        Intent intent = new Intent(this, MeditationService.class).setAction(action);
        return PendingIntent.getService(this, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private Notification buildNotification(MeditationSession session) {
        boolean paused = session != null && MeditationSession.PAUSED.equals(session.status());
        boolean preparing = session != null && MeditationSession.PREPARING.equals(session.status());
        Intent open = new Intent(this, MainActivity.class)
            .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_notify)
            .setContentTitle(session != null ? session.title : "Meditation")
            .setContentText(paused ? "Paused" : preparing ? "Preparing the voice…" : "Playing")
            .setContentIntent(PendingIntent.getActivity(this, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE))
            .setOngoing(!paused)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .setPriority(NotificationCompat.PRIORITY_LOW);
        if (paused) builder.addAction(android.R.drawable.ic_media_play, "Resume", action(ACTION_RESUME, 1));
        else builder.addAction(android.R.drawable.ic_media_pause, "Pause", action(ACTION_PAUSE, 2));
        builder.addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop", action(ACTION_STOP, 3));
        MediaStyle style = new MediaStyle().setShowActionsInCompactView(0, 1);
        if (mediaSession != null) style.setMediaSession(mediaSession.getSessionToken());
        return builder.setStyle(style).build();
    }

    private void publish(MeditationSession session) {
        boolean paused = MeditationSession.PAUSED.equals(session.status());
        boolean preparing = MeditationSession.PREPARING.equals(session.status());
        if (mediaSession != null) {
            mediaSession.setMetadata(new MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, session.title)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, "Anxiety Companion")
                .build());
            mediaSession.setPlaybackState(new PlaybackStateCompat.Builder()
                .setActions(PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE
                    | PlaybackStateCompat.ACTION_PLAY_PAUSE | PlaybackStateCompat.ACTION_STOP
                    | PlaybackStateCompat.ACTION_SKIP_TO_NEXT | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS)
                .setState(paused ? PlaybackStateCompat.STATE_PAUSED
                        : preparing ? PlaybackStateCompat.STATE_BUFFERING : PlaybackStateCompat.STATE_PLAYING,
                    PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 1f)
                .build());
        }
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        nm.notify(NOTIFICATION_ID, buildNotification(session));
    }

    @Override
    public void onCreate() {
        super.onCreate();
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "Meditation playback",
                NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Controls for a meditation that is playing");
            ((NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE)).createNotificationChannel(channel);
        }
        mediaSession = new MediaSessionCompat(this, "AnxietyCompanionMeditation");
        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                if (MeditationSession.current != null) MeditationSession.current.resume();
            }

            @Override
            public void onPause() {
                if (MeditationSession.current != null) MeditationSession.current.pause();
            }

            @Override
            public void onStop() {
                if (MeditationSession.current != null) MeditationSession.current.stop();
            }

            @Override
            public void onSkipToNext() {
                if (MeditationSession.current != null) MeditationSession.current.skip(1);
            }

            @Override
            public void onSkipToPrevious() {
                if (MeditationSession.current != null) MeditationSession.current.skip(-1);
            }
        });
        mediaSession.setActive(true);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        MeditationSession session = MeditationSession.current;
        // Android requires the notification to be posted promptly after a foreground start.
        Notification notification = buildNotification(session);
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
        instance = this;

        if (session == null) {
            stop();
            return START_NOT_STICKY;
        }
        publish(session);
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_PAUSE.equals(action)) session.pause();
        else if (ACTION_RESUME.equals(action)) session.resume();
        else if (ACTION_STOP.equals(action)) session.stop();
        return START_NOT_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // Swiped away from recents: don't keep talking with no app to control it.
        if (MeditationSession.current != null) MeditationSession.current.stop();
        stop();
    }

    @Override
    public void onDestroy() {
        if (instance == this) instance = null;
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
            mediaSession = null;
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
