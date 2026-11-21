import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { APP_VERSION_CODE } from '../version';

const VERSION_URL = 'https://d2l5gmsioco5hq.cloudfront.net/version.json';

export interface AppUpdate {
  versionName: string;
  url: string;
}

/** Looks for a newer build of the app. Only meaningful in the installed Android app. */
export async function checkForUpdate(): Promise<AppUpdate | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    // Native HTTP, because the web layer isn't allowed to read this file cross-origin.
    const res = await CapacitorHttp.get({ url: `${VERSION_URL}?t=${Date.now()}` });
    const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    if (res.status === 200 && Number(data?.versionCode) > APP_VERSION_CODE && typeof data.url === 'string') {
      return { versionName: String(data.versionName), url: data.url };
    }
  } catch {
    // offline or unreachable: try again next launch
  }
  return null;
}
