import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';

/** Fire a native OS notification. Silently no-ops if permission is denied or plugin isn't available. */
export async function notify(title: string, body: string): Promise<void> {
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const ask = await requestPermission();
      granted = ask === 'granted';
    }
    if (!granted) return;
    sendNotification({ title, body });
  } catch {
    // plugin not available (e.g. browser preview) — ignore
  }
}
