import axios from 'axios';
import activityNotificationService from './activityNotificationService';

const API_BASE_URL = (import.meta.env.VITE_APP_API_URL || 'https://demoapi.enstasol.com/api').replace(/\/$/, '');
export const AUTH_SESSION_CHANGED_EVENT = 'auth-session-changed';

const notifySessionChanged = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT));
  }
};

const parseExpirationTime = (value) => {
  if (value === undefined || value === null || value === '') return null;

  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) {
    // APIs commonly return Unix timestamps in seconds; JavaScript uses milliseconds.
    return numericValue < 1e12 ? numericValue * 1000 : numericValue;
  }

  const parsedValue = new Date(value).getTime();
  return Number.isNaN(parsedValue) ? null : parsedValue;
};

const getJwtExpirationTime = (token) => {
  try {
    const encodedPayload = token.split('.')[1];
    if (!encodedPayload) return null;

    const base64Payload = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const normalizedPayload = base64Payload.padEnd(Math.ceil(base64Payload.length / 4) * 4, '=');
    const payload = JSON.parse(atob(normalizedPayload));
    return parseExpirationTime(payload?.exp);
  } catch {
    return null;
  }
};

const normalizePermissionCodes = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((permission) => (typeof permission === 'string' ? permission : permission?.permissionCode))
      .map((code) => String(code ?? '').trim())
      .filter(Boolean);
  }

  return String(value ?? '')
    .split(',')
    .map((code) => code.trim())
    .filter(Boolean);
};

const clearPermissionMenuCache = () => {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith('crm_permission_menus:') || key === 'crm_permission_menus')
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }
};

export const authService = {
  async login(userName, password) {
    try {
      const response = await fetch(`${API_BASE_URL}/Login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          userName: userName.trim(),
          password: password,
          loginIp: ''
        })
      });

      let resData = null;
      try {
        resData = await response.json();
      } catch {
        return {
          success: false,
          message: `Server returned ${response.status} (${response.statusText || 'Invalid response'})`
        };
      }

      // Check if API response indicates failure
      if (!response.ok || (resData && resData.success === false)) {
        const errorMsg =
          resData?.message ||
          resData?.error ||
          (resData?.errors ? Object.values(resData.errors).flat().join(', ') : null) ||
          'Invalid Email and/or Password';
        return {
          success: false,
          message: errorMsg
        };
      }

      const payload = resData.data || {};

      // 1. Extract API token - prioritize userToken matching the exact CRM schema
      let token =
        payload.userToken ||
        payload.token ||
        payload.accessToken ||
        payload.jwtToken ||
        payload.jwt ||
        payload.id_token ||
        (typeof resData.data === 'string' ? resData.data : null);

      // Fallback: search any key containing 'token'
      if (!token && typeof payload === 'object') {
        const tokenKey = Object.keys(payload).find((key) => key.toLowerCase().includes('token'));
        if (tokenKey) {
          token = payload[tokenKey];
        }
      }

      const finalToken = token ? String(token).trim() : '';
      if (!finalToken) {
        return {
          success: false,
          message: 'Login succeeded but the server did not return an authentication token.'
        };
      }

      // 2. Format user profile from CRM API fields
      const firstName = payload.firstName || '';
      const lastName = payload.lastName || '';
      const fullName = [firstName, lastName].filter(Boolean).join(' ');
      const email = payload.email || (userName.includes('@') ? userName.trim() : '');

      const storedUser = {
        userId: payload.userId || 0,
        userName: userName.trim(),
        email: email,
        firstName: firstName,
        lastName: lastName,
        displayName: fullName || email || userName.trim(),
        role: payload.roleName || 'Developer',
        roleId: payload.roleId || 0,
        locationId: payload.locationId || 0,
        lastLoginDate: payload.lastLoginDate || new Date().toISOString(),
        tokenExpirationTime: payload.tokenExpirationTime || resData.tokenExpirationTime || null,
        permissionCodes: normalizePermissionCodes(payload.permissionCodes ?? payload.permissionCode),
        isBlockedBy2FA: payload.isBlockedBy2FA || false,
        isAssignPersonalPermission: payload.isAssignPersonalPermission || false,
        userToken: finalToken
      };

      clearPermissionMenuCache();

      // 3. Persist tokens and user details into localStorage
      localStorage.setItem('token', finalToken);
      localStorage.setItem('userToken', finalToken);
      localStorage.setItem('api_token', finalToken);
      localStorage.setItem('accessToken', finalToken);
      localStorage.setItem('authToken', finalToken);
      localStorage.setItem('userId', String(storedUser.userId));
      localStorage.setItem('roleId', String(storedUser.roleId));
      localStorage.setItem('user', JSON.stringify(storedUser));
      localStorage.setItem('authData', JSON.stringify(resData));

      if (storedUser.permissionCodes.length > 0) {
        localStorage.setItem('permissionCodes', JSON.stringify(storedUser.permissionCodes));
        localStorage.setItem('permissions', JSON.stringify(storedUser.permissionCodes));
      } else {
        localStorage.removeItem('permissionCodes');
        localStorage.removeItem('permissions');
      }

      activityNotificationService.record('login', storedUser);

      notifySessionChanged();

      return {
        success: true,
        message: resData.message || 'User logged in successfully.',
        data: payload
      };
    } catch (networkError) {
      console.error('Login network error:', networkError);
      return {
        success: false,
        message: 'Unable to connect to the CRM server. Please check your network connection.'
      };
    }
  },

  /**
   * Retrieve the stored authorization API token from localStorage
   * Prioritizes userToken from CRM API
   * @returns {string | null}
   */
  getToken() {
    try {
      return (
        localStorage.getItem('userToken') ||
        localStorage.getItem('token') ||
        localStorage.getItem('api_token') ||
        localStorage.getItem('accessToken') ||
        localStorage.getItem('authToken')
      );
    } catch {
      return null;
    }
  },

  /**
   * Retrieve the stored user object from localStorage
   * @returns {any | null}
   */
  getUser() {
    try {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  },

  /**
   * Check whether a specific permission code is granted to the active user
   * @param {string} permissionCode
   * @returns {boolean}
   */
  hasPermission(permissionCode) {
    try {
      const user = this.getUser();
      if (!user || !user.permissionCodes) return false;
      return normalizePermissionCodes(user.permissionCodes).includes(permissionCode);
    } catch {
      return false;
    }
  },

  /**
   * Return the session expiry timestamp in milliseconds.
   * Uses the API expiry value first and falls back to the JWT exp claim.
   * @returns {number | null}
   */
  getExpirationTime() {
    const userExpirationTime = parseExpirationTime(this.getUser()?.tokenExpirationTime);
    if (userExpirationTime !== null) return userExpirationTime;

    const token = this.getToken();
    return token ? getJwtExpirationTime(token) : null;
  },

  /**
   * Check whether a user is currently authenticated with a valid API token
   * @returns {boolean}
   */
  isAuthenticated() {
    const token = this.getToken();
    if (!token || token === 'null' || token === 'undefined') {
      return false;
    }

    // Optional expiration check
    const expirationTime = this.getExpirationTime();
    if (expirationTime !== null && Date.now() >= expirationTime) {
      this.logout();
      return false;
    }

    return true;
  },

  /**
   * Log out by clearing stored credentials, tokens, and permissions from localStorage
   */
  logout() {
    try {
      const currentUser = this.getUser();
      if (currentUser && this.getToken()) {
        activityNotificationService.record('logout', currentUser);
      }
      localStorage.removeItem('token');
      localStorage.removeItem('userToken');
      localStorage.removeItem('api_token');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('authToken');
      localStorage.removeItem('userId');
      localStorage.removeItem('roleId');
      localStorage.removeItem('user');
      localStorage.removeItem('permissionCodes');
      localStorage.removeItem('permissions');
      localStorage.removeItem('authData');
      clearPermissionMenuCache();
      delete axios.defaults.headers.common['Authorization'];
      notifySessionChanged();
    } catch {
      // ignore
    }
  },

  /**
   * Configure Axios default authorization header with stored token
   */
  setupAxios() {
    const token = this.getToken();
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }
};

export default authService;
