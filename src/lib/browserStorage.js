export const LEGACY_TOKEN_KEYS = ['userToken', 'api_token', 'accessToken', 'authToken', 'jwtToken', 'jwt', 'id_token'];
const CREDENTIAL_FIELDS = new Set(
  ['token', ...LEGACY_TOKEN_KEYS, 'refreshToken', 'password', 'passwordHash'].map((key) => key.toLowerCase())
);

export const stripStoredCredentials = (value) => {
  if (Array.isArray(value)) return value.map(stripStoredCredentials);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !CREDENTIAL_FIELDS.has(key.toLowerCase()))
      .map(([key, item]) => [key, stripStoredCredentials(item)])
  );
};

export const clearStoredPermissionMenus = (storage) => {
  try {
    const store = storage || globalThis.localStorage;
    if (!store) return;
    const keys =
      typeof store.key === 'function' ? Array.from({ length: store.length }, (_, index) => store.key(index)) : Object.keys(store);
    keys
      .filter((key) => key === 'crm_permission_menus' || key?.startsWith('crm_permission_menus:'))
      .forEach((key) => store.removeItem(key));
  } catch {
    // Storage can be disabled by browser privacy settings.
  }
};

export const clearStoredActivityData = (storage) => {
  try {
    const store = storage || globalThis.localStorage;
    if (!store) return;
    const keys =
      typeof store.key === 'function' ? Array.from({ length: store.length }, (_, index) => store.key(index)) : Object.keys(store);
    keys
      .filter(
        (key) =>
          key === 'crm_auth_activity_attendance_snapshot' ||
          key === 'crm_auth_activity_notifications' ||
          key?.startsWith('crm_auth_activity_notifications_read:')
      )
      .forEach((key) => store.removeItem(key));
  } catch {
    // Storage cleanup must not block startup.
  }
};

const parseObject = (value) => {
  try {
    return JSON.parse(value || 'null');
  } catch {
    return null;
  }
};

// Upgrade old sessions in place: keep one token and a credential-free profile.
export const migrateAuthStorage = (storage) => {
  try {
    const store = storage || globalThis.localStorage;
    if (!store) return;
    const legacyAuth = parseObject(store.getItem('authData'));
    const storedUser = parseObject(store.getItem('user'));
    const legacyProfile = legacyAuth?.data && typeof legacyAuth.data === 'object' ? legacyAuth.data : null;
    const profile = storedUser && typeof storedUser === 'object' && !Array.isArray(storedUser) ? storedUser : legacyProfile;
    const token = [
      store.getItem('token'),
      ...LEGACY_TOKEN_KEYS.map((key) => store.getItem(key)),
      profile?.userToken,
      profile?.token,
      legacyProfile?.userToken,
      legacyProfile?.token
    ].find((value) => typeof value === 'string' && value.trim() && !['null', 'undefined'].includes(value.trim()));

    // Write the canonical token before removing aliases, so existing logins survive.
    if (token) store.setItem('token', token.trim());
    if (profile) {
      const user = stripStoredCredentials(profile);
      if (user.permissionCodes === undefined) {
        const codes = store.getItem('permissionCodes') || store.getItem('permissions');
        user.permissionCodes = parseObject(codes) || codes || [];
      }
      if (user.tokenExpirationTime == null && legacyAuth?.tokenExpirationTime != null) {
        user.tokenExpirationTime = legacyAuth.tokenExpirationTime;
      }
      store.setItem('user', JSON.stringify(user));
    }
    [...LEGACY_TOKEN_KEYS, 'authData', 'permissions', 'permissionCodes'].forEach((key) => store.removeItem(key));
    clearStoredPermissionMenus(store);
  } catch {
    // Leave the previous login intact if storage cannot be written.
  }
};
