const ACTIVITY_STORAGE_KEY = 'crm_auth_activity_notifications';
const ATTENDANCE_SNAPSHOT_KEY = 'crm_auth_activity_attendance_snapshot';
const READ_STORAGE_PREFIX = 'crm_auth_activity_notifications_read:';
export const ACTIVITY_NOTIFICATIONS_CHANGED_EVENT = 'activity-notifications-changed';

const MAX_ACTIVITIES = 50;

const firstValue = (record, keys) => {
  for (const key of keys) {
    if (record?.[key] !== undefined && record?.[key] !== null && record?.[key] !== '') return record[key];
  }
  return null;
};

const toTimestamp = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
};

const toBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (value === 1 || String(value).toLowerCase() === 'true') return true;
  if (value === 0 || String(value).toLowerCase() === 'false') return false;
  return null;
};

const readSnapshot = () => {
  try {
    const value = JSON.parse(localStorage.getItem(ATTENDANCE_SNAPSHOT_KEY) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
};

const readActivities = () => {
  try {
    const value = JSON.parse(localStorage.getItem(ACTIVITY_STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const getViewerKey = (user) => String(user?.userId || user?.userName || 'unknown').toLowerCase();

const notifyChanged = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(ACTIVITY_NOTIFICATIONS_CHANGED_EVENT));
  }
};

const activityNotificationService = {
  isAllowedRole(user) {
    const role = String(user?.role || user?.roleName || '')
      .trim()
      .toLowerCase();
    return role.includes('admin') || role.includes('developer');
  },

  getActivities() {
    return readActivities().sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp));
  },

  record(type, user, details = {}) {
    if (!user || !['login', 'logout'].includes(type)) return;

    try {
      const timestamp = toTimestamp(details.timestamp) || new Date().toISOString();
      const duplicate = readActivities().find(
        (item) =>
          item.type === type &&
          String(item.userId || item.userName) === String(user.userId || user.userName) &&
          Math.abs(new Date(item.timestamp).getTime() - new Date(timestamp).getTime()) < 90000
      );
      if (duplicate) return;

      const activity = {
        id: details.sourceId || `${timestamp}-${user.userId || user.userName || 'user'}-${type}`,
        type,
        userId: user.userId || 0,
        userName: user.userName || '',
        displayName: user.displayName || user.userName || 'User',
        role: user.role || user.roleName || '',
        timestamp
      };

      localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify([activity, ...readActivities()].slice(0, MAX_ACTIVITIES)));
      notifyChanged();
    } catch {
      // Authentication must continue when browser storage is unavailable.
    }
  },

  syncAttendanceRegister(response) {
    try {
      const payload = response?.data || {};
      const users = Array.isArray(payload.users) ? payload.users : [];
      const totals = new Map((Array.isArray(payload.totals) ? payload.totals : []).map((item) => [String(item?.userId ?? ''), item]));
      const previousSnapshot = readSnapshot();
      const nextSnapshot = {};

      users.forEach((user) => {
        const userId = user?.userId ?? user?.id ?? 0;
        const record = { ...(totals.get(String(userId)) || {}), ...user };
        const key = String(userId || record.userName || record.username || '');
        if (!key) return;

        const loginCount = Number(firstValue(record, ['totalLogins', 'loginCount', 'logins'])) || 0;
        const loginAt = toTimestamp(firstValue(record, ['lastLoginLocal', 'lastLoginDate', 'lastLogin', 'loginDate']));
        const logoutAt = toTimestamp(firstValue(record, ['lastLogoutLocal', 'lastLogoutDate', 'lastLogout', 'logoutDate', 'loggedOutAt']));
        const isOnline = toBoolean(firstValue(record, ['isOnline', 'isLoggedIn', 'hasOpenSession', 'activeSession']));
        const sessionMinutes = Number(firstValue(record, ['totalSessionMinutes', 'sessionMinutes'])) || 0;
        const previous = previousSnapshot[key];
        const sessionIncreased = previous && sessionMinutes > Number(previous.sessionMinutes || 0);
        const sessionObservedChanging = Boolean(previous?.sessionObservedChanging || sessionIncreased);
        const stableSessionPolls = sessionIncreased ? 0 : Number(previous?.stableSessionPolls || 0) + 1;
        const current = {
          loginCount,
          loginAt,
          logoutAt,
          isOnline,
          sessionMinutes,
          sessionObservedChanging,
          stableSessionPolls
        };
        nextSnapshot[key] = current;

        if (!previous) return;

        const notificationUser = {
          userId,
          userName: record.userName || record.username || '',
          displayName: record.fullName || record.displayName || record.userName || record.username || `User #${userId}`,
          role: record.roleName || record.role || ''
        };

        if (loginCount > Number(previous.loginCount || 0) || (loginAt && loginAt !== previous.loginAt)) {
          this.record('login', notificationUser, {
            timestamp: loginAt,
            sourceId: `attendance-${key}-login-${loginCount}-${loginAt || Date.now()}`
          });
        }

        const explicitLogoutDetected = (logoutAt && logoutAt !== previous.logoutAt) || (previous.isOnline === true && isOnline === false);
        const completedSessionDetected =
          !explicitLogoutDetected &&
          sessionObservedChanging &&
          !sessionIncreased &&
          stableSessionPolls >= 2 &&
          loginCount === Number(previous.loginCount || 0);

        if (explicitLogoutDetected || completedSessionDetected) {
          this.record('logout', notificationUser, {
            timestamp: logoutAt,
            sourceId: `attendance-${key}-logout-${logoutAt || sessionMinutes || Date.now()}`
          });
          nextSnapshot[key].sessionObservedChanging = false;
          nextSnapshot[key].stableSessionPolls = 0;
        }
      });

      localStorage.setItem(ATTENDANCE_SNAPSHOT_KEY, JSON.stringify(nextSnapshot));
    } catch {
      // A malformed report must not affect the navigation or authentication flow.
    }
  },

  getUnreadCount(user, activities = readActivities()) {
    try {
      const readAt = Number(localStorage.getItem(`${READ_STORAGE_PREFIX}${getViewerKey(user)}`)) || 0;
      return activities.filter((activity) => new Date(activity.timestamp).getTime() > readAt).length;
    } catch {
      return 0;
    }
  },

  markAllAsRead(user) {
    try {
      localStorage.setItem(`${READ_STORAGE_PREFIX}${getViewerKey(user)}`, String(Date.now()));
      notifyChanged();
    } catch {
      // Ignore unavailable browser storage.
    }
  },

  isActivityRead(activity, user) {
    try {
      const readAt = Number(localStorage.getItem(`${READ_STORAGE_PREFIX}${getViewerKey(user)}`)) || 0;
      return new Date(activity.timestamp).getTime() <= readAt;
    } catch {
      return true;
    }
  },

  storageKey: ACTIVITY_STORAGE_KEY
};

export default activityNotificationService;
