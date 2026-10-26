import { migrateAuthStorage, clearStoredPermissionMenus, clearStoredActivityData } from './lib/browserStorage';
import { getCurrentLoginIpv4 } from './services/clientIpService';

export const applyLightTheme = (doc) => {
  if (!doc) return;
  for (const element of [doc.documentElement, doc.body]) {
    if (!element) continue;
    element.classList.remove('dark');
    element.setAttribute('data-theme-mode', 'light');
    element.setAttribute('data-bs-theme', 'light');
    element.style.setProperty('color-scheme', 'only light');
  }
};

// This module runs before the app and router are imported.
applyLightTheme(typeof document === 'undefined' ? null : document);
migrateAuthStorage();
clearStoredActivityData();
try {
  clearStoredPermissionMenus(globalThis.sessionStorage);
  clearStoredActivityData(globalThis.sessionStorage);
} catch {
  // Session storage is optional.
}

if (typeof window !== 'undefined') {
  // Resolve the IP in the user's browser, including existing signed-in sessions.
  getCurrentLoginIpv4(true).catch(() => {});
}
