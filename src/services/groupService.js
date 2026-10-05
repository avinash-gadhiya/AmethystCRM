import apiClient from './core/apiClient';

// In-flight request deduplication and cache maps
const inFlightRequests = new Map();
const cacheMap = new Map();
let cacheGeneration = 0;

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
  async getGroups(params = {}, signal, forceFresh = false) {
    const queryParams = {
      Text: params.Text || '',
      PageNumber: params.PageNumber || 1,
      PageSize: params.PageSize || 10,
      SortProperty: params.SortProperty || 'groupId',
      IsDescending: params.IsDescending ?? true
    };

    const cacheKey = `groups:${JSON.stringify(queryParams)}`;
    if (!forceFresh && cacheMap.has(cacheKey)) {
      return cacheMap.get(cacheKey);
    }

    const requestKey = `${cacheGeneration}:${cacheKey}`;
    if (!forceFresh && inFlightRequests.has(requestKey)) {
      return inFlightRequests.get(requestKey);
    }

    const requestGeneration = cacheGeneration;
    const requestPromise = (async () => {
      try {
        const response = await apiClient.get('/Group', queryParams, signal);
        const parsed = unwrapList(response);
        const result = {
          data: parsed.data.map((g) => ({
            groupId: Number(g.groupId ?? g.id ?? 0),
            groupName: String(g.groupName ?? g.name ?? '').trim(),
            isActive: Boolean(g.isActive ?? true)
          })),
          totalCount: parsed.totalCount
        };
        if (requestGeneration === cacheGeneration) {
          cacheMap.set(cacheKey, result);
        }
        return result;
      } finally {
        inFlightRequests.delete(requestKey);
      }
    })();

    inFlightRequests.set(requestKey, requestPromise);
    return requestPromise;
  },

  async getGroupDropdownOptions(signal, forceFresh = false) {
    const cacheKey = 'groupDropdownOptions';
    if (!forceFresh && cacheMap.has(cacheKey)) {
      return cacheMap.get(cacheKey);
    }

    try {
      let response;
      try {
        response = await apiClient.get('/Group/GroupDropdown', {}, signal);
      } catch {
        response = await apiClient.get(
          '/Group',
          {
            Text: '',
            PageNumber: 1,
            PageSize: 1000,
            SortProperty: 'groupName',
            IsDescending: false
          },
          signal
        );
      }
      const parsed = unwrapList(response);
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
    const payload = {
      groupId: 0,
      groupName: String(data.groupName || '').trim(),
      isActive: Boolean(data.isActive ?? true)
    };

    const response = await apiClient.post('/Group', payload);
    this.clearGroupCache();
    return response;
  },

  async updateGroup(data) {
    const payload = {
      groupId: Number(data.groupId),
      groupName: String(data.groupName || '').trim(),
      isActive: Boolean(data.isActive)
    };

    const response = await apiClient.put('/Group', payload);
    this.clearGroupCache();
    return response;
  },

  async deleteGroup(groupId) {
    const id = Number(groupId);
    if (!Number.isFinite(id) || id <= 0) {
      throw new Error('A valid group ID is required.');
    }

    const response = await apiClient.delete('/Group', { id });
    this.clearGroupCache();
    return response;
  },

  // =========================================================================
  // Group Email CRUD
  // =========================================================================
  async getGroupEmails(params = {}, signal, forceFresh = false) {
    const queryParams = {
      Text: params.Text || '',
      PageNumber: params.PageNumber || 1,
      PageSize: params.PageSize || 10,
      SortProperty: params.SortProperty || 'groupEmailId',
      IsDescending: params.IsDescending ?? true
    };

    const cacheKey = `groupEmails:${JSON.stringify(queryParams)}`;
    if (!forceFresh && cacheMap.has(cacheKey)) {
      return cacheMap.get(cacheKey);
    }

    const requestKey = `${cacheGeneration}:${cacheKey}`;
    if (!forceFresh && inFlightRequests.has(requestKey)) {
      return inFlightRequests.get(requestKey);
    }

    const requestGeneration = cacheGeneration;
    const requestPromise = (async () => {
      try {
        const response = await apiClient.get('/GroupEmail', queryParams, signal);
        const parsed = unwrapList(response);
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
        if (requestGeneration === cacheGeneration) {
          cacheMap.set(cacheKey, result);
        }
        return result;
      } finally {
        inFlightRequests.delete(requestKey);
      }
    })();

    inFlightRequests.set(requestKey, requestPromise);
    return requestPromise;
  },

  async createGroupEmail(data) {
    const payload = {
      groupEmailId: 0,
      email: String(data.email || '').trim(),
      nameOnEmail: String(data.nameOnEmail || '').trim(),
      location: String(data.location || '').trim(),
      groupId: Number(data.groupId),
      groupName: String(data.groupName || '').trim(),
      isActive: Boolean(data.isActive ?? true)
    };

    const response = await apiClient.post('/GroupEmail', payload);
    this.clearGroupEmailCache();
    return response;
  },

  async updateGroupEmail(data) {
    const payload = {
      groupEmailId: Number(data.groupEmailId),
      email: String(data.email || '').trim(),
      nameOnEmail: String(data.nameOnEmail || '').trim(),
      location: String(data.location || '').trim(),
      groupId: Number(data.groupId),
      groupName: String(data.groupName || '').trim(),
      isActive: Boolean(data.isActive)
    };

    const response = await apiClient.put('/GroupEmail', payload);
    this.clearGroupEmailCache();
    return response;
  },

  async deleteGroupEmail(groupEmailId) {
    const id = Number(groupEmailId);
    if (!Number.isFinite(id) || id <= 0) {
      throw new Error('A valid group email ID is required.');
    }

    const response = await apiClient.delete('/GroupEmail', { id });
    this.clearGroupEmailCache();
    return response;
  },

  // =========================================================================
  // Cache Management
  // =========================================================================
  clearGroupCache() {
    cacheGeneration += 1;
    for (const key of cacheMap.keys()) {
      if (key.startsWith('groups:') || key === 'groupDropdownOptions') {
        cacheMap.delete(key);
      }
    }
    inFlightRequests.clear();
  },

  clearGroupEmailCache() {
    cacheGeneration += 1;
    for (const key of cacheMap.keys()) {
      if (key.startsWith('groupEmails:')) {
        cacheMap.delete(key);
      }
    }
    inFlightRequests.clear();
  },

  clearAllCache() {
    cacheGeneration += 1;
    cacheMap.clear();
    inFlightRequests.clear();
  }
};

export default groupService;
