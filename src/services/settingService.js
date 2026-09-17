import authService from './authService';

const API_BASE_URL = (import.meta.env.VITE_APP_API_URL || 'https://demoapi.enstasol.com/api').replace(/\/$/, '');

const buildQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === '' || value === null || value === undefined) return;
    query.set(key, String(value));
  });
  return query.toString();
};

const request = async (path, { method = 'GET', params, data, signal } = {}) => {
  const token = authService.getToken();
  if (!token) throw new Error('Your session has expired. Please sign in again.');

  const query = buildQuery(params);
  const response = await fetch(`${API_BASE_URL}${path}${query ? `?${query}` : ''}`, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(data !== undefined ? { 'Content-Type': 'application/json' } : {})
    },
    body: data !== undefined ? JSON.stringify(data) : undefined,
    signal
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.success === false) {
    const validationMessage = payload?.errors ? Object.values(payload.errors).flat().join(', ') : '';
    throw new Error(payload?.message || validationMessage || `Settings request failed (${response.status}).`);
  }

  return payload || {};
};

const unwrapList = (payload) => {
  const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
  return { data: rows, totalCount: Number(payload?.totalCount) || rows.length };
};

const listParams = (params = {}, sortProperty) => ({
  Text: params.Text || '',
  PageNumber: params.PageNumber || 1,
  PageSize: params.PageSize || 10,
  SortProperty: params.SortProperty || sortProperty,
  IsDescending: params.IsDescending !== false,
  SettingId: params.SettingId || ''
});

export const settingService = {
  async getSettings(params = {}, signal) {
    return unwrapList(await request('/Setting', { params: listParams(params, 'settingId'), signal }));
  },

  async createSetting(setting) {
    return request('/Setting', { method: 'POST', data: setting });
  },

  async updateSetting(setting) {
    return request('/Setting', { method: 'PUT', data: setting });
  },

  async deleteSetting(settingId) {
    return request('/Setting', { method: 'DELETE', params: { id: settingId } });
  },

  async getSettingValues(params = {}, signal) {
    return unwrapList(await request('/SettingValue', { params: listParams(params, 'settingValueId'), signal }));
  },

  async createSettingValue(value) {
    return request('/SettingValue', { method: 'POST', data: value });
  },

  async updateSettingValue(value) {
    return request('/SettingValue', { method: 'PUT', data: value });
  },

  async deleteSettingValue(settingValueId) {
    return request(`/SettingValue/${settingValueId}`, { method: 'DELETE' });
  },

  async getSettingValueDropdown(settingKey, signal) {
    if (!String(settingKey || '').trim()) throw new Error('Setting key is required.');
    return unwrapList(
      await request('/SettingValue/SettingValueDropDown', {
        params: { settingKey: String(settingKey).trim() },
        signal
      })
    );
  }
};

export default settingService;
