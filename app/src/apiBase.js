import { Capacitor } from '@capacitor/core';

// API base URL for web vs Android APK (Capacitor).
// - In browser dev: Vite proxy handles `/api` -> 127.0.0.1:3001, so API_BASE = ''.
// - In Android emulator / device: use the machine's IP where the Node server runs.
//
// NOTE:
// - For Android emulator talking to API on your Mac, `10.0.2.2` is the alias for `localhost` on host.
// - If you install the APK on a physical phone, change this to your Mac's LAN IP
//   (e.g. `http://192.168.1.20:3001`) and rebuild the APK.

const isNative = Capacitor.isNativePlatform?.() ?? false;

// Default for now: point native (APK) builds at 10.0.2.2:3001.
// You can edit this string before building if needed.
export const API_BASE = isNative ? 'http://10.0.2.2:3001' : '';

