import apiClient from './core/apiClient';

const inFlightRequests = new Map();
const locationCache = new Map();
let cacheGeneration = 0;

const toBoolean = (value, fallback = true) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return Boolean(value);
};

export const clearLocationCache = () => {
  cacheGeneration += 1;
  locationCache.clear();
};

const unwrapList = (payload) => {
  if (Array.isArray(payload)) return { list: payload, container: {} };
  if (Array.isArray(payload?.data)) return { list: payload.data, container: payload };
  if (Array.isArray(payload?.data?.data)) {
    return { list: payload.data.data, container: payload.data };
  }
  return { list: [], container: payload?.data || payload || {} };
};

const normalizeLocationList = (payload) => {
  const { list, container } = unwrapList(payload);
  const data = list.map((item) => ({
    locationId: Number(item?.locationId ?? item?.id ?? 0),
    name: String(item?.name ?? item?.locationName ?? '').trim(),
    isActive: toBoolean(item?.isActive ?? item?.status)
  }));
  const rawTotal = container?.totalCount ?? container?.totalRecords ?? container?.count;

  return {
    data,
    totalCount: Number.isFinite(Number(rawTotal)) ? Number(rawTotal) : data.length
  };
};

const locationPayload = (location, isCreate = false) => ({
  locationId: isCreate ? 0 : Number(location.locationId),
  name: String(location.name || '').trim(),
  isActive: location.isActive !== false
});

export const locationService = {
  async getLocations(params = {}, _signal, forceFresh = false) {
    const queryParams = {
      Text: params.Text || '',
      PageNumber: params.PageNumber || 1,
      PageSize: params.PageSize || 10,
      SortProperty: params.SortProperty || 'locationId',
      IsDescending: params.IsDescending ?? true
    };
    const cacheKey = JSON.stringify(queryParams);

    if (!forceFresh && locationCache.has(cacheKey)) return locationCache.get(cacheKey);

    // Generation-scoped keys prevent a pre-mutation request from being reused after cache invalidation.
    const requestKey = `${cacheGeneration}:${cacheKey}`;
    if (inFlightRequests.has(requestKey)) return inFlightRequests.get(requestKey);

    const requestGeneration = cacheGeneration;
    const request = apiClient
      .get('/Location', queryParams)
      .then(normalizeLocationList)
      .then((result) => {
        if (requestGeneration === cacheGeneration) locationCache.set(cacheKey, result);
        return result;
      })
      .finally(() => inFlightRequests.delete(requestKey));

    inFlightRequests.set(requestKey, request);
    return request;
  },

  async getLocationById(locationId, signal) {
    const response = await apiClient.request(`/Location/${encodeURIComponent(locationId)}`, { signal });
    return response?.data || response;
  },

  async createLocation(location) {
    const response = await apiClient.post('/Location', locationPayload(location, true));
    clearLocationCache();
    return response;
  },

  async updateLocation(location) {
    const response = await apiClient.put('/Location', locationPayload(location));
    clearLocationCache();
    return response;
  },

  async deleteLocation(locationId) {
    const id = Number(locationId);
    if (!Number.isFinite(id) || id <= 0) throw new Error('A valid location ID is required.');

    const response = await apiClient.delete('/Location', { id });
    clearLocationCache();
    return response;
  },

  async getLocationDropdown(signal) {
    const response = await apiClient.request('/Location/LocationDropdown', { signal });
    const { list } = unwrapList(response);

    return list
      .map((item) => ({
        locationId: Number(item?.locationId ?? item?.id ?? 0),
        name: String(item?.name ?? item?.locationName ?? '').trim()
      }))
      .filter((item) => item.locationId > 0);
  },

  clearCache: clearLocationCache
};

export default locationService;
