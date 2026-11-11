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

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

/**
 * Foreground service that keeps the app alive while a meditation plays with the screen off, and
 * shows the playback notification with pause/resume and stop.
 */
public class MeditationService extends Service {
    private static final String CHANNEL = "meditation-playback";
    private static final int NOTIFICATION_ID = 2001;
    private static final String ACTION_PAUSE = "com.anxietycompanion.app.PAUSE";
    private static final String ACTION_RESUME = "com.anxietycompanion.app.RESUME";
    private static final String ACTION_STOP = "com.anxietycompanion.app.STOP";

    private static boolean running;

    static void start(Context context) {
        ContextCompat.startForegroundService(context, new Intent(context, MeditationService.class));
    }

    /** Redraws the notification to match the session's state. */
    static void refresh(Context context) {
        if (!running || MeditationSession.current == null) return;
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        nm.notify(NOTIFICATION_ID, build(context, MeditationSession.current));
    }

    static void stop(Context context) {
        context.stopService(new Intent(context, MeditationService.class));
    }

    private static PendingIntent action(Context context, String action, int requestCode) {
        Intent intent = new Intent(context, MeditationService.class).setAction(action);
        return PendingIntent.getService(context, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static Notification build(Context context, MeditationSession session) {
        boolean paused = session != null && MeditationSession.PAUSED.equals(session.status());
        boolean preparing = session != null && MeditationSession.PREPARING.equals(session.status());
        Intent open = new Intent(context, MainActivity.class)
            .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_notify)
            .setContentTitle(session != null ? session.title : "Meditation")
            .setContentText(paused ? "Paused" : preparing ? "Preparing the voice…" : "Playing")
            .setContentIntent(PendingIntent.getActivity(context, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE))
            .setOngoing(!paused)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .setPriority(NotificationCompat.PRIORITY_LOW);
        if (paused) builder.addAction(0, "Resume", action(context, ACTION_RESUME, 1));
        else builder.addAction(0, "Pause", action(context, ACTION_PAUSE, 2));
        builder.addAction(0, "Stop", action(context, ACTION_STOP, 3));
        return builder.build();
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
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        MeditationSession session = MeditationSession.current;
        // Android requires the notification to be posted promptly after a foreground start.
        Notification notification = build(this, session);
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
        running = true;

        if (session == null) {
            stopSelf();
            return START_NOT_STICKY;
        }
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
        stopSelf();
    }

    @Override
    public void onDestroy() {
        running = false;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
