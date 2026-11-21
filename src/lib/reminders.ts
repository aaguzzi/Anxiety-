import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const REMINDER_ID = 1001;

export type ReminderResult = 'scheduled' | 'off' | 'denied' | 'unsupported';

export function remindersSupported(): boolean {
  return Capacitor.isNativePlatform();
}

export async function cancelReminder(): Promise<void> {
  if (remindersSupported()) await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
}

export async function applyReminder(enabled: boolean, time: string): Promise<ReminderResult> {
  if (!remindersSupported()) return 'unsupported';

  await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
  if (!enabled) return 'off';

  let perm = await LocalNotifications.checkPermissions();
  if (perm.display !== 'granted') perm = await LocalNotifications.requestPermissions();
  if (perm.display !== 'granted') return 'denied';

  const [hour, minute] = time.split(':').map(Number);
  await LocalNotifications.schedule({
    notifications: [{
      id: REMINDER_ID,
      title: 'Time to recenter',
      body: 'A few quiet minutes for yourself. Your daily practice is ready.',
      schedule: { on: { hour, minute }, allowWhileIdle: true },
    }],
  });
  return 'scheduled';
}
