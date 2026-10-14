import { useEffect } from 'react';
import { toast } from 'sonner';

import authService, { AUTH_SESSION_CHANGED_EVENT } from 'services/authService';

const MAX_TIMEOUT_DELAY = 2_147_483_647;
const AUTH_STORAGE_KEYS = new Set(['token', 'userToken', 'api_token', 'accessToken', 'authToken', 'user']);

export default function SessionExpiryHandler() {
  useEffect(() => {
    let expiryTimer;
    let redirectTimer;
    let isExpiring = false;

    const redirectToLogin = () => {
      if (!window.location.pathname.toLowerCase().includes('/login')) {
        window.location.replace('/login');
      }
    };

    const expireSession = () => {
      if (isExpiring) return;

      isExpiring = true;
      authService.logout();
      redirectTimer = window.setTimeout(redirectToLogin, 750);
      try {
        toast.error('Session expired. Please sign in again.');
      } catch {
        // Logout and redirect must still complete if notifications are unavailable.
      }
    };

    const scheduleExpiry = () => {
      window.clearTimeout(expiryTimer);

      const token = authService.getToken();
      if (!token) return;

      const expirationTime = authService.getExpirationTime();
      if (expirationTime === null) return;

      const remainingTime = expirationTime - Date.now();
      if (remainingTime <= 0) {
        expireSession();
        return;
      }

      expiryTimer = window.setTimeout(scheduleExpiry, Math.min(remainingTime, MAX_TIMEOUT_DELAY));
    };

    const handleStorageChange = (event) => {
      if (event.key && !AUTH_STORAGE_KEYS.has(event.key)) return;

      if (!authService.getToken()) {
        redirectToLogin();
        return;
      }

      scheduleExpiry();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) scheduleExpiry();
    };

    scheduleExpiry();
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, scheduleExpiry);
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', scheduleExpiry);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearTimeout(expiryTimer);
      window.clearTimeout(redirectTimer);
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, scheduleExpiry);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', scheduleExpiry);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return null;
}
