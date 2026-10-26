import apiClient from './core/apiClient';
import groupEmailService from './groupEmailService';

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
    total = payload.data.totalCount ?? payload.data.totalRecords ?? payload.data.count ?? list.length;
  } else if (Array.isArray(payload.data)) {
    list = payload.data;
    total = payload.totalCount ?? payload.totalRecords ?? payload.count ?? list.length;
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

  getGroupDropdownOptions(signal, forceFresh = false) {
    return groupEmailService.getGroupDropdownOptions(signal, forceFresh);
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
  getGroupEmails(params = {}, signal, forceFresh = false) {
    return groupEmailService.getGroupEmails(params, signal, forceFresh);
  },

  createGroupEmail(data) {
    return groupEmailService.createGroupEmail(data);
  },

  updateGroupEmail(data) {
    return groupEmailService.updateGroupEmail(data);
  },

  deleteGroupEmail(groupEmailId) {
    return groupEmailService.deleteGroupEmail(groupEmailId);
  },
  // =========================================================================
  // Cache Management
  // =========================================================================
  clearGroupCache() {
    groupEmailService.clearCache();
    cacheGeneration += 1;
    for (const key of cacheMap.keys()) {
      if (key.startsWith('groups:') || key === 'groupDropdownOptions') {
        cacheMap.delete(key);
      }
    }
    inFlightRequests.clear();
  },

  clearGroupEmailCache() {
    groupEmailService.clearCache();
  },
  clearAllCache() {
    groupEmailService.clearCache();
    cacheGeneration += 1;
    cacheMap.clear();
    inFlightRequests.clear();
  }
};

export default groupService;
