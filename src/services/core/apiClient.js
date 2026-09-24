import authService from '../authService';

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
  const validation = payload?.errors ? Object.values(payload.errors).flat().join(', ') : '';
  return payload?.message || payload?.error || validation || `API request failed (${status}).`;
};

export const apiClient = {
  async request(path, { method = 'GET', params, data, signal, headers: customHeaders = {} } = {}) {
    const token = authService.getToken();
    if (!token) throw new Error('Your session has expired. Please sign in again.');

    const query = buildQuery(params);
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
    const headers = { Accept: 'application/json', Authorization: `Bearer ${token}`, ...customHeaders };
    if (data !== undefined && !isFormData) headers['Content-Type'] = 'application/json';

    const response = await fetch(`${API_BASE_URL}${path}${query ? `?${query}` : ''}`, {
      method,
      headers,
      body: data === undefined ? undefined : isFormData ? data : JSON.stringify(data),
      signal
    });

    if (response.status === 204) return { success: true, data: null, status: response.status };

    const contentType = response.headers.get('content-type') || '';
    let payload;
    try {
      payload = contentType.includes('application/json') ? await response.json() : await response.text();
    } catch {
      throw new Error(`API returned an invalid response (${response.status}).`);
    }

    if (!response.ok || payload?.success === false) {
      const error = new Error(getErrorMessage(payload, response.status));
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
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
