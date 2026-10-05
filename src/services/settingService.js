import axios from 'axios';
import { deleteById, getAuthHeaders } from './http';

const getApiBaseUrl = () => {
  return (import.meta.env.VITE_APP_API_URL || 'https://demoapi.enstasol.com/api').replace(/\/$/, '');
};

// In-flight deduplication & Settings cache
const inFlightRequests = new Map();
const settingsCache = new Map();

const normalizeBoolean = (value, fallback = true) => {
  if (value === true || value === false) return value;
  if (value === 1 || value === 0) return value === 1;
  const str = String(value ?? '').trim().toLowerCase();
  if (str === 'true' || str === '1' || str === 'active') return true;
  if (str === 'false' || str === '0' || str === 'inactive') return false;
  return fallback;
};

const normalizeSettingsList = (payload) => {
  if (!payload) return { data: [], totalCount: 0 };

  let list = [];
  let total = 0;

  // Format 1: { data: { data: [], totalCount: number } }
  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    list = Array.isArray(payload.data.data) ? payload.data.data : [];
    total =
      payload.data.totalCount ??
      payload.data.totalRecords ??
      payload.data.count ??
      list.length;
  }
  // Format 2: { success?: boolean, data: [], totalCount?: number }
  else if (Array.isArray(payload.data)) {
    list = payload.data;
    total =
      payload.totalCount ??
      payload.totalRecords ??
      payload.count ??
      list.length;
  }
  // Format 3: Raw array []
  else if (Array.isArray(payload)) {
    list = payload;
    total = payload.length;
  }

  // Ensure each setting has normalized fields and settingValueDTOs array
  const normalizedList = list.map((item) => ({
    settingId: Number(item.settingId ?? item.id ?? 0),
    settingName: String(item.settingName ?? item.name ?? '').trim(),
    settingKey: String(item.settingKey ?? item.key ?? '').trim(),
    isActive: normalizeBoolean(item.isActive ?? item.status, true),
    settingValueDTOs: Array.isArray(item.settingValueDTOs)
      ? item.settingValueDTOs.map((v) => ({
          settingValueId: Number(v.settingValueId ?? v.id ?? 0),
          settingId: Number(v.settingId ?? item.settingId ?? 0),
          settingValueText: String(v.settingValueText ?? v.text ?? v.value ?? '').trim(),
          isActive: normalizeBoolean(v.isActive ?? v.status, true)
        }))
      : []
  }));

  return {
    data: normalizedList,
    totalCount: Number(total) || normalizedList.length
  };
};

const normalizeSettingValuesList = (payload) => {
  if (!payload) return { data: [], totalCount: 0 };
  let list = [];
  let total = 0;

  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    list = Array.isArray(payload.data.data) ? payload.data.data : [];
    total = payload.data.totalCount ?? list.length;
  } else if (Array.isArray(payload.data)) {
    list = payload.data;
    total = payload.totalCount ?? list.length;
  } else if (Array.isArray(payload)) {
    list = payload;
    total = payload.length;
  }

  const normalized = list.map((v) => ({
    settingValueId: Number(v.settingValueId ?? v.id ?? 0),
    settingId: Number(v.settingId ?? 0),
    settingValueText: String(v.settingValueText ?? v.text ?? v.value ?? '').trim(),
    isActive: normalizeBoolean(v.isActive ?? v.status, true)
  }));

  return { data: normalized, totalCount: Number(total) || normalized.length };
};

export const settingService = {
  // GET /Setting
  async getSettings(params = {}, signal) {
    const API_URL = getApiBaseUrl();
    const queryParams = {
      Text: params.Text || '',
      PageNumber: params.PageNumber || 1,
      PageSize: params.PageSize || 10000,
      SortProperty: params.SortProperty || 'settingId',
      IsDescending: params.IsDescending ?? true
    };

    const cacheKey = `settings:${JSON.stringify(queryParams)}`;

    // Return cached data if present (unless force refresh requested)
    if (!params.force && settingsCache.has(cacheKey)) {
      return settingsCache.get(cacheKey);
    }

    // In-flight deduplication
    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey);
    }

    const requestPromise = (async () => {
      try {
        const response = await axios.get(`${API_URL}/Setting`, {
          headers: getAuthHeaders(),
          params: queryParams,
          signal
        });

        const parsed = normalizeSettingsList(response.data);
        const result = {
          ...parsed,
          raw: response.data
        };
        settingsCache.set(cacheKey, result);
        return result;
      } finally {
        inFlightRequests.delete(cacheKey);
      }
    })();

    inFlightRequests.set(cacheKey, requestPromise);
    return requestPromise;
  },

  // POST /Setting
  async createSetting({ settingId = 0, settingName, settingKey, isActive = true, settingValueDTOs = [] }) {
    const API_URL = getApiBaseUrl();
    const payload = {
      settingId: 0,
      settingName: String(settingName || '').trim(),
      settingKey: String(settingKey || '').trim(),
      isActive: Boolean(isActive),
      settingValueDTOs: Array.isArray(settingValueDTOs)
        ? settingValueDTOs.map((v) => ({
            settingValueId: Number(v.settingValueId ?? v.id ?? 0),
            settingId: 0,
            settingValueText: String(v.settingValueText ?? v.text ?? v.value ?? '').trim(),
            isActive: normalizeBoolean(v.isActive ?? v.status, true)
          }))
        : []
    };

    const response = await axios.post(`${API_URL}/Setting`, payload, {
      headers: getAuthHeaders()
    });

    this.clearCache();
    return response.data;
  },

  // PUT /Setting
  async updateSetting({ settingId, settingName, settingKey, isActive, settingValueDTOs = [] }) {
    const API_URL = getApiBaseUrl();
    const cleanSettingId = Number(settingId);
    const payload = {
      settingId: cleanSettingId,
      settingName: String(settingName || '').trim(),
      settingKey: String(settingKey || '').trim(),
      isActive: Boolean(isActive),
      settingValueDTOs: Array.isArray(settingValueDTOs)
        ? settingValueDTOs.map((v) => ({
            settingValueId: Number(v.settingValueId ?? v.id ?? 0),
            settingId: Number(v.settingId ?? cleanSettingId),
            settingValueText: String(v.settingValueText ?? v.text ?? v.value ?? '').trim(),
            isActive: normalizeBoolean(v.isActive ?? v.status, true)
          }))
        : []
    };

    const response = await axios.put(`${API_URL}/Setting`, payload, {
      headers: getAuthHeaders()
    });

    this.clearCache();
    return response.data;
  },

  // DELETE /Setting?id={settingId}
  async deleteSetting(settingId) {
    const API_URL = getApiBaseUrl();
    this.clearCache();

    // Dual-strategy deletion: query param first as requested by backend spec, then REST path fallback
    try {
      const response = await axios.delete(`${API_URL}/Setting`, {
        headers: getAuthHeaders(),
        params: { id: settingId }
      });
      return response.data;
    } catch (error) {
      const status = error?.response?.status;
      if (status === 404 || status === 405) {
        const fallbackRes = await axios.delete(`${API_URL}/Setting/${settingId}`, {
          headers: getAuthHeaders()
        });
        return fallbackRes.data;
      }
      throw error;
    }
  },

  // GET /SettingValue
  async getSettingValues(params = {}, signal) {
    const API_URL = getApiBaseUrl();
    const queryParams = {
      Text: params.Text || '',
      PageNumber: params.PageNumber || 1,
      PageSize: params.PageSize || 1000,
      SortProperty: params.SortProperty || 'settingValueId',
      IsDescending: params.IsDescending ?? true,
      SettingId: params.SettingId || ''
    };

    const response = await axios.get(`${API_URL}/SettingValue`, {
      headers: getAuthHeaders(),
      params: queryParams,
      signal
    });

    return normalizeSettingValuesList(response.data);
  },

  // POST /SettingValue
  async createSettingValue({ settingValueId = 0, settingId, settingValueText, isActive = true }) {
    const API_URL = getApiBaseUrl();
    const payload = {
      settingValueId: 0,
      settingId: Number(settingId),
      settingValueText: String(settingValueText || '').trim(),
      isActive: Boolean(isActive)
    };

    const response = await axios.post(`${API_URL}/SettingValue`, payload, {
      headers: getAuthHeaders()
    });

    this.clearCache();
    return response.data;
  },

  // PUT /SettingValue
  async updateSettingValue({ settingValueId, settingId, settingValueText, isActive }) {
    const API_URL = getApiBaseUrl();
    const payload = {
      settingValueId: Number(settingValueId),
      settingId: Number(settingId),
      settingValueText: String(settingValueText || '').trim(),
      isActive: Boolean(isActive)
    };

    const response = await axios.put(`${API_URL}/SettingValue`, payload, {
      headers: getAuthHeaders()
    });

    this.clearCache();
    return response.data;
  },

  // DELETE /SettingValue/{settingValueId} (preferred) with fallback DELETE /SettingValue?id={settingValueId}
  async deleteSettingValue(settingValueId) {
    const API_URL = getApiBaseUrl();
    this.clearCache();
    return deleteById(`${API_URL}/SettingValue`, settingValueId);
  },

  // GET /SettingValue/SettingValueDropDown?settingKey={settingKey}
  async getSettingValueDropdown(settingKey, signal) {
    const key = String(settingKey || '').trim();
    if (!key) throw new Error('Setting key is required.');

    const API_URL = getApiBaseUrl();
    const response = await axios.get(`${API_URL}/SettingValue/SettingValueDropDown`, {
      headers: getAuthHeaders(),
      params: { settingKey: key },
      signal
    });

    return normalizeSettingValuesList(response.data);
  },

  // Invalidate cache
  clearCache() {
    settingsCache.clear();
  }
};

export default settingService;
