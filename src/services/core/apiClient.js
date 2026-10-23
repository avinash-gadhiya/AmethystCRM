import authService from '../authService';
import { handleSessionExpired } from '../http';

const API_BASE_URL = (import.meta.env.VITE_APP_API_URL || 'https://demoapi.enstasol.com/api').replace(/\/$/, '');

const buildQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === '' || value === null || value === undefined) return;
    if (Array.isArray(value)) value.forEach((item) => query.append(key, String(item)));
    else query.set(key, String(value));
  });
  return query.toString();
};

const getErrorMessage = (payload, status) => {
  const errors = payload?.errors || payload?.Errors;
  const validation = errors && typeof errors === 'object' ? Object.values(errors).flat().join(', ') : '';
  return (
    payload?.message ||
    payload?.Message ||
    payload?.error ||
    payload?.title ||
    validation ||
    (typeof payload === 'string' && payload.trim() ? payload.trim() : '') ||
    `API request failed (${status}).`
  );
};

// Reads the body once as text so empty and non-JSON success responses don't throw.
const readPayload = async (response) => {
  const text = await response.text();
  if (!text) return null;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('json')) return text;
  try {
    return JSON.parse(text);
  } catch {
    if (response.ok) return text;
    throw new Error(`API returned an invalid response (${response.status}).`);
  }
};

export const apiClient = {
  async request(path, { method = 'GET', params, data, signal, headers: customHeaders = {} } = {}) {
    const token = authService.getToken();
    if (!token) throw new Error('Your session has expired. Please sign in again.');

    const query = buildQuery(params);
    const hasBody = data !== undefined && data !== null;
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
    const headers = { Accept: 'application/json', Authorization: `Bearer ${token}`, ...customHeaders };
    if (hasBody && !isFormData) headers['Content-Type'] = 'application/json';

    const response = await fetch(`${API_BASE_URL}${path}${query ? `?${query}` : ''}`, {
      method,
      headers,
      body: !hasBody ? undefined : isFormData ? data : JSON.stringify(data),
      signal
    });

    if (response.status === 401) handleSessionExpired();
    if (response.status === 204) return { success: true, data: null, status: response.status };

    const payload = await readPayload(response);

    if (!response.ok || payload?.success === false || payload?.Success === false) {
      const error = new Error(getErrorMessage(payload, response.status));
      error.status = response.status;
      error.payload = payload;
      error.data = payload;
      throw error;
    }

    return payload ?? { success: true, data: null, status: response.status };
  },

  get(path, params, signal) {
    return this.request(path, { params, signal });
  },

  post(path, data, params) {
    return this.request(path, { method: 'POST', data, params });
  },

  put(path, data, params) {
    return this.request(path, { method: 'PUT', data, params });
  },

  delete(path, params) {
    return this.request(path, { method: 'DELETE', params });
  }
};

export default apiClient;
