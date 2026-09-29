import axios from 'axios';
import { deleteById, getAuthHeaders } from './http';

const getApiBaseUrl = () => {
  return (import.meta.env.VITE_APP_API_URL || 'https://demoapi.enstasol.com/api').replace(/\/$/, '');
};

// In-flight request deduplication and cache maps
const inFlightRequests = new Map();
const cacheMap = new Map();

// Helper to normalize lists from varying API response formats
const unwrapList = (payload) => {
  if (!payload) return { data: [], totalCount: 0 };
  let list = [];
  let total = 0;

  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    list = Array.isArray(payload.data.data) ? payload.data.data : [];
    total =
      payload.data.totalCount ??
      payload.data.totalRecords ??
      payload.data.count ??
      list.length;
  } else if (Array.isArray(payload.data)) {
    list = payload.data;
    total =
      payload.totalCount ??
      payload.totalRecords ??
      payload.count ??
      list.length;
  } else if (Array.isArray(payload)) {
    list = payload;
    total = payload.length;
  }

  return { data: list, totalCount: Number(total) || list.length };
};

export const groupService = {
  // =========================================================================
  // Group CRUD
  // =========================================================================
  async getGroups(params = {}) {
    const API_URL = getApiBaseUrl();
    const queryParams = {
      Text: params.Text || '',
      PageNumber: params.PageNumber || 1,
      PageSize: params.PageSize || 10,
      SortProperty: params.SortProperty || 'groupId',
      IsDescending: params.IsDescending ?? true
    };

    const cacheKey = `groups:${JSON.stringify(queryParams)}`;
    if (cacheMap.has(cacheKey)) {
      return cacheMap.get(cacheKey);
    }
    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey);
    }

    const requestPromise = (async () => {
      try {
        const response = await axios.get(`${API_URL}/Group`, {
          headers: getAuthHeaders(),
          params: queryParams
        });
        const parsed = unwrapList(response.data);
        const result = {
          data: parsed.data.map((g) => ({
            groupId: Number(g.groupId ?? g.id ?? 0),
            groupName: String(g.groupName ?? g.name ?? '').trim(),
            isActive: Boolean(g.isActive ?? true)
          })),
          totalCount: parsed.totalCount
        };
        cacheMap.set(cacheKey, result);
        return result;
      } finally {
        inFlightRequests.delete(cacheKey);
      }
    })();

    inFlightRequests.set(cacheKey, requestPromise);
    return requestPromise;
  },

  async getGroupDropdownOptions() {
    const API_URL = getApiBaseUrl();
    const cacheKey = 'groupDropdownOptions';
    if (cacheMap.has(cacheKey)) {
      return cacheMap.get(cacheKey);
    }

    try {
      const response = await axios.get(`${API_URL}/Group`, {
        headers: getAuthHeaders(),
        params: {
          Text: '',
          PageNumber: 1,
          PageSize: 1000,
          SortProperty: 'groupName',
          IsDescending: false
        }
      });
      const parsed = unwrapList(response.data);
      const options = parsed.data.map((g) => ({
        id: Number(g.groupId ?? g.id ?? 0),
        name: String(g.groupName ?? g.name ?? '').trim(),
        isActive: Boolean(g.isActive ?? true)
      }));
      cacheMap.set(cacheKey, options);
      return options;
    } catch (error) {
      console.warn('Failed to load group dropdown options:', error);
      return [];
    }
  },

  async createGroup(data) {
    const API_URL = getApiBaseUrl();
    const payload = {
      groupId: 0,
      groupName: String(data.groupName || '').trim(),
      isActive: Boolean(data.isActive ?? true)
    };

    const response = await axios.post(`${API_URL}/Group`, payload, {
      headers: getAuthHeaders()
    });
    this.clearGroupCache();
    return response.data;
  },

  async updateGroup(data) {
    const API_URL = getApiBaseUrl();
    const payload = {
      groupId: Number(data.groupId),
      groupName: String(data.groupName || '').trim(),
      isActive: Boolean(data.isActive)
    };

    const response = await axios.put(`${API_URL}/Group`, payload, {
      headers: getAuthHeaders()
    });
    this.clearGroupCache();
    return response.data;
  },

  async deleteGroup(groupId) {
    const API_URL = getApiBaseUrl();
    this.clearGroupCache();
    return deleteById(`${API_URL}/Group`, groupId);
  },

  // =========================================================================
  // Group Email CRUD
  // =========================================================================
  async getGroupEmails(params = {}) {
    const API_URL = getApiBaseUrl();
    const queryParams = {
      Text: params.Text || '',
      PageNumber: params.PageNumber || 1,
      PageSize: params.PageSize || 10,
      SortProperty: params.SortProperty || 'groupEmailId',
      IsDescending: params.IsDescending ?? true
    };

    const cacheKey = `groupEmails:${JSON.stringify(queryParams)}`;
    if (cacheMap.has(cacheKey)) {
      return cacheMap.get(cacheKey);
    }
    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey);
    }

    const requestPromise = (async () => {
      try {
        const response = await axios.get(`${API_URL}/GroupEmail`, {
          headers: getAuthHeaders(),
          params: queryParams
        });
        const parsed = unwrapList(response.data);
        const result = {
          data: parsed.data.map((item) => ({
            groupEmailId: Number(item.groupEmailId ?? item.id ?? 0),
            email: String(item.email || '').trim(),
            nameOnEmail: String(item.nameOnEmail || item.name || '').trim(),
            location: String(item.location || '').trim(),
            groupId: Number(item.groupId || 0),
            groupName: String(item.groupName || '').trim(),
            isActive: Boolean(item.isActive ?? true)
          })),
          totalCount: parsed.totalCount
        };
        cacheMap.set(cacheKey, result);
        return result;
      } finally {
        inFlightRequests.delete(cacheKey);
      }
    })();

    inFlightRequests.set(cacheKey, requestPromise);
    return requestPromise;
  },

  async createGroupEmail(data) {
    const API_URL = getApiBaseUrl();
    const payload = {
      groupEmailId: 0,
      email: String(data.email || '').trim(),
      nameOnEmail: String(data.nameOnEmail || '').trim(),
      location: String(data.location || '').trim(),
      groupId: Number(data.groupId),
      groupName: String(data.groupName || '').trim(),
      isActive: Boolean(data.isActive ?? true)
    };

    const response = await axios.post(`${API_URL}/GroupEmail`, payload, {
      headers: getAuthHeaders()
    });
    this.clearGroupEmailCache();
    return response.data;
  },

  async updateGroupEmail(data) {
    const API_URL = getApiBaseUrl();
    const payload = {
      groupEmailId: Number(data.groupEmailId),
      email: String(data.email || '').trim(),
      nameOnEmail: String(data.nameOnEmail || '').trim(),
      location: String(data.location || '').trim(),
      groupId: Number(data.groupId),
      groupName: String(data.groupName || '').trim(),
      isActive: Boolean(data.isActive)
    };

    const response = await axios.put(`${API_URL}/GroupEmail`, payload, {
      headers: getAuthHeaders()
    });
    this.clearGroupEmailCache();
    return response.data;
  },

  async deleteGroupEmail(groupEmailId) {
    const API_URL = getApiBaseUrl();
    this.clearGroupEmailCache();
    return deleteById(`${API_URL}/GroupEmail`, groupEmailId);
  },

  // =========================================================================
  // Cache Management
  // =========================================================================
  clearGroupCache() {
    for (const key of cacheMap.keys()) {
      if (key.startsWith('groups:') || key === 'groupDropdownOptions') {
        cacheMap.delete(key);
      }
    }
  },

  clearGroupEmailCache() {
    for (const key of cacheMap.keys()) {
      if (key.startsWith('groupEmails:')) {
        cacheMap.delete(key);
      }
    }
  },

  clearAllCache() {
    cacheMap.clear();
  }
};

export default groupService;
