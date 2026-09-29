import apiClient from './core/apiClient';

const inFlightRequests = new Map();
const emailCache = new Map();
const dropdownCache = new Map();
let cacheGeneration = 0;

const toBoolean = (value, fallback = true) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return Boolean(value);
};

export const clearGroupEmailCache = () => {
  cacheGeneration += 1;
  emailCache.clear();
  dropdownCache.clear();
};

const unwrapList = (payload) => {
  if (!payload) return { list: [], container: {} };
  if (Array.isArray(payload)) return { list: payload, container: {} };
  if (Array.isArray(payload?.data)) return { list: payload.data, container: payload };
  if (Array.isArray(payload?.data?.data)) {
    return { list: payload.data.data, container: payload.data };
  }
  return { list: [], container: payload?.data || payload || {} };
};

const normalizeGroupEmailList = (payload) => {
  const { list, container } = unwrapList(payload);
  const data = list.map((item) => ({
    groupEmailId: Number(item?.groupEmailId ?? item?.id ?? 0),
    email: String(item?.email ?? '').trim(),
    nameOnEmail: String(item?.nameOnEmail ?? item?.name ?? '').trim(),
    location: String(item?.location ?? '').trim(),
    groupId: Number(item?.groupId ?? 0),
    groupName: String(item?.groupName ?? '').trim(),
    isActive: toBoolean(item?.isActive ?? item?.status)
  }));
  const rawTotal = container?.totalCount ?? container?.totalRecords ?? container?.count;

  return {
    data,
    totalCount: Number.isFinite(Number(rawTotal)) ? Number(rawTotal) : data.length
  };
};

const groupEmailPayload = (item, isCreate = false) => ({
  groupEmailId: isCreate ? 0 : Number(item.groupEmailId || 0),
  email: String(item.email || '').trim(),
  nameOnEmail: String(item.nameOnEmail || '').trim(),
  location: String(item.location || '').trim(),
  groupId: Number(item.groupId || 0),
  groupName: String(item.groupName || '').trim(),
  isActive: item.isActive !== false
});

export const groupEmailService = {
  /**
   * List Group Emails with server-side pagination, search, sorting, and caching.
   * GET /GroupEmail
   */
  async getGroupEmails(params = {}, _signal, forceFresh = false) {
    const queryParams = {
      Text: params.Text || '',
      PageNumber: params.PageNumber || 1,
      PageSize: params.PageSize || 10,
      SortProperty: params.SortProperty || 'groupEmailId',
      IsDescending: params.IsDescending ?? true
    };
    const cacheKey = JSON.stringify(queryParams);

    if (!forceFresh && emailCache.has(cacheKey)) {
      return emailCache.get(cacheKey);
    }

    const requestKey = `${cacheGeneration}:${cacheKey}`;
    if (inFlightRequests.has(requestKey)) {
      return inFlightRequests.get(requestKey);
    }

    const requestGeneration = cacheGeneration;
    const request = apiClient
      .get('/GroupEmail', queryParams)
      .then(normalizeGroupEmailList)
      .then((result) => {
        if (requestGeneration === cacheGeneration) {
          emailCache.set(cacheKey, result);
        }
        return result;
      })
      .finally(() => {
        inFlightRequests.delete(requestKey);
      });

    inFlightRequests.set(requestKey, request);
    return request;
  },

  /**
   * Get single Group Email by ID
   * GET /GroupEmail/{id}
   */
  async getGroupEmailById(groupEmailId, signal) {
    const response = await apiClient.request(`/GroupEmail/${encodeURIComponent(groupEmailId)}`, { signal });
    return response?.data || response;
  },

  /**
   * Create a new Group Email
   * POST /GroupEmail
   */
  async createGroupEmail(data) {
    const payload = groupEmailPayload(data, true);
    const response = await apiClient.post('/GroupEmail', payload);
    clearGroupEmailCache();
    return response?.data || response;
  },

  /**
   * Update an existing Group Email
   * PUT /GroupEmail
   */
  async updateGroupEmail(data) {
    const payload = groupEmailPayload(data, false);
    const response = await apiClient.put('/GroupEmail', payload);
    clearGroupEmailCache();
    return response?.data || response;
  },

  /**
   * Delete a Group Email with fallback support
   * Preferred: DELETE /GroupEmail/{groupEmailId}
   * Fallback: DELETE /GroupEmail?id={groupEmailId}
   */
  async deleteGroupEmail(groupEmailId) {
    const id = Number(groupEmailId);
    if (!Number.isFinite(id) || id <= 0) {
      throw new Error('A valid group email ID is required.');
    }

    let response;
    try {
      response = await apiClient.delete(`/GroupEmail/${encodeURIComponent(id)}`);
    } catch (error) {
      if (![400, 404, 405].includes(error?.status)) throw error;
      response = await apiClient.delete('/GroupEmail', { id });
    }

    clearGroupEmailCache();
    return response?.data || response;
  },

  /**
   * Load Group options for dropdown
   * GET /Group?Text=&PageNumber=1&PageSize=1000
   */
  async getGroupDropdownOptions(_signal, forceFresh = false) {
    const cacheKey = 'groupDropdownOptions';
    if (!forceFresh && dropdownCache.has(cacheKey)) {
      return dropdownCache.get(cacheKey);
    }

    try {
      const response = await apiClient.get('/Group', {
        Text: '',
        PageNumber: 1,
        PageSize: 1000,
        SortProperty: 'groupName',
        IsDescending: false
      });

      const { list } = unwrapList(response);
      const options = list
        .map((g) => ({
          id: Number(g?.groupId ?? g?.id ?? 0),
          name: String(g?.groupName ?? g?.name ?? '').trim(),
          isActive: g?.isActive !== undefined ? toBoolean(g?.isActive) : true
        }))
        .filter((g) => g.id > 0 && g.name);

      dropdownCache.set(cacheKey, options);
      return options;
    } catch (error) {
      console.warn('Failed to load group dropdown options:', error);
      return [];
    }
  },

  clearCache: clearGroupEmailCache
};

export default groupEmailService;
