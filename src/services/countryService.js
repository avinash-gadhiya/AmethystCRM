import axios from 'axios';
import { deleteById, getAuthHeaders } from './http';

const getApiBaseUrl = () => {
  return (import.meta.env.VITE_APP_API_URL || 'https://demoapi.enstasol.com/api').replace(/\/$/, '');
};

// In-flight deduplication and state caching maps
const inFlightRequests = new Map();
const stateCache = new Map();

const normalizeCountryList = (payload) => {
  if (!payload) return { data: [], totalCount: 0 };

  // Format 1: { data: { data: [], totalCount: number } }
  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    const innerData = Array.isArray(payload.data.data) ? payload.data.data : [];
    const innerCount =
      payload.data.totalCount ??
      payload.data.totalRecords ??
      payload.data.count ??
      innerData.length;
    return { data: innerData, totalCount: Number(innerCount) || innerData.length };
  }

  // Format 2: { success?: boolean, data: [], totalCount: number }
  if (Array.isArray(payload.data)) {
    const count =
      payload.totalCount ??
      payload.totalRecords ??
      payload.count ??
      payload.data.length;
    return { data: payload.data, totalCount: Number(count) || payload.data.length };
  }

  // Format 3: Raw array []
  if (Array.isArray(payload)) {
    return { data: payload, totalCount: payload.length };
  }

  return { data: [], totalCount: 0 };
};

const normalizeStateList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

export const countryService = {
  // GET /Country
  async getCountries(params = {}) {
    const API_URL = getApiBaseUrl();
    const queryParams = {
      Text: params.Text || '',
      PageNumber: params.PageNumber || 1,
      PageSize: params.PageSize || 10,
      SortProperty: params.SortProperty || 'countryId',
      IsDescending: params.IsDescending ?? true
    };

    const cacheKey = `countries:${JSON.stringify(queryParams)}`;
    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey);
    }

    const requestPromise = (async () => {
      try {
        const response = await axios.get(`${API_URL}/Country`, {
          headers: getAuthHeaders(),
          params: queryParams
        });
        const parsed = normalizeCountryList(response.data);
        return {
          ...parsed,
          raw: response.data
        };
      } finally {
        inFlightRequests.delete(cacheKey);
      }
    })();

    inFlightRequests.set(cacheKey, requestPromise);
    return requestPromise;
  },

  // POST /Country
  async createCountry({ countryId = 0, countryName }) {
    const API_URL = getApiBaseUrl();
    const payload = {
      countryId: 0,
      countryName: String(countryName || '').trim()
    };
    const response = await axios.post(`${API_URL}/Country`, payload, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  // PUT /Country
  async updateCountry({ countryId, countryName }) {
    const API_URL = getApiBaseUrl();
    const payload = {
      countryId: Number(countryId),
      countryName: String(countryName || '').trim()
    };
    const response = await axios.put(`${API_URL}/Country`, payload, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  // DELETE /Country/{countryId} (dual-strategy delete)
  async deleteCountry(countryId) {
    const API_URL = getApiBaseUrl();
    this.clearStateCache(countryId);
    return deleteById(`${API_URL}/Country`, countryId);
  },

  // GET /State?CountryId={countryId}&PageNumber=1&PageSize=1000
  async getStates(params = {}) {
    const countryId = Number(params.CountryId || params.countryId);
    if (!countryId) return [];

    const pageNumber = params.PageNumber || 1;
    const pageSize = params.PageSize || 1000;
    const cacheKey = `state:${countryId}:${pageNumber}:${pageSize}`;

    // Return cached states if present
    if (stateCache.has(cacheKey)) {
      return stateCache.get(cacheKey);
    }

    // In-flight deduplication
    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey);
    }

    const API_URL = getApiBaseUrl();
    const requestPromise = (async () => {
      try {
        const response = await axios.get(`${API_URL}/State`, {
          headers: getAuthHeaders(),
          params: {
            CountryId: countryId,
            PageNumber: pageNumber,
            PageSize: pageSize
          }
        });

        const list = normalizeStateList(response.data);
        // Requirement: Filter returned states by countryId because the API may return extra records
        const filtered = list.filter((s) => Number(s.countryId) === countryId);
        stateCache.set(cacheKey, filtered);
        return filtered;
      } finally {
        inFlightRequests.delete(cacheKey);
      }
    })();

    inFlightRequests.set(cacheKey, requestPromise);
    return requestPromise;
  },

  // POST /State
  async createState({ stateId = 0, stateName, countryId }) {
    const API_URL = getApiBaseUrl();
    const payload = {
      stateId: 0,
      stateName: String(stateName || '').trim(),
      countryId: Number(countryId)
    };
    const response = await axios.post(`${API_URL}/State`, payload, {
      headers: getAuthHeaders()
    });
    this.clearStateCache(countryId);
    return response.data;
  },

  // PUT /State
  async updateState({ stateId, stateName, countryId }) {
    const API_URL = getApiBaseUrl();
    const payload = {
      stateId: Number(stateId),
      stateName: String(stateName || '').trim(),
      countryId: Number(countryId)
    };
    const response = await axios.put(`${API_URL}/State`, payload, {
      headers: getAuthHeaders()
    });
    this.clearStateCache(countryId);
    return response.data;
  },

  // DELETE /State/{stateId}
  async deleteState(stateId, countryId) {
    const API_URL = getApiBaseUrl();
    if (countryId) {
      this.clearStateCache(countryId);
    } else {
      this.clearStateCache();
    }
    return deleteById(`${API_URL}/State`, stateId);
  },

  // Clear state cache for a specific country or all
  clearStateCache(countryId) {
    if (countryId) {
      const prefix = `state:${Number(countryId)}:`;
      for (const key of stateCache.keys()) {
        if (key.startsWith(prefix)) {
          stateCache.delete(key);
        }
      }
    } else {
      stateCache.clear();
    }
  }
};

export default countryService;
