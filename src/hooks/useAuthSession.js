import { useSyncExternalStore } from 'react';
import authService, { AUTH_SESSION_CHANGED_EVENT } from '@/services/authService';

let identity;
let revision = 0;

const getSnapshot = () => {
  const user = authService.getUser();
  const next = JSON.stringify([
    authService.getToken(),
    user?.userId,
    user?.roleId,
    user?.roleName || user?.role,
    user?.permissionCodes,
    user?.isAssignPersonalPermission
  ]);
  if (next !== identity) {
    identity = next;
    revision += 1;
  }
  return revision;
};

const subscribe = (onChange) => {
  const onStorage = (event) => {
    if (event.key === null || event.key === 'token' || event.key === 'user') onChange();
  };
  window.addEventListener(AUTH_SESSION_CHANGED_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
};

export default function useAuthSession() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
