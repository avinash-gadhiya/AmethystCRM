import axios from 'axios';
import { deleteById, getAuthHeaders } from './http';

const getApiBaseUrl = () => {
  return (import.meta.env.VITE_APP_API_URL || 'https://demoapi.enstasol.com/api').replace(/\/$/, '');
};

const extractListAndCount = (payload) => {
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

  // Format 2: { data: [], totalCount: number }
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

export const blockIpService = {
  // GET /BlockIp
  async getBlockedIps(params = {}) {
    const API_URL = getApiBaseUrl();
    const queryParams = {
      Text: params.Text || '',
      PageNumber: params.PageNumber || 1,
      PageSize: params.PageSize || 10,
      SortProperty: params.SortProperty || 'id',
      IsDescending: params.IsDescending ?? true
    };

    const response = await axios.get(`${API_URL}/BlockIp`, {
      headers: getAuthHeaders(),
      params: queryParams
    });

    const parsed = extractListAndCount(response.data);
    return {
      ...parsed,
      raw: response.data
    };
  },

  // POST /BlockIp
  async createBlockedIp({ id = 0, ip }) {
    const API_URL = getApiBaseUrl();
    const payload = {
      id: 0,
      ip: String(ip || '').trim()
    };

    const response = await axios.post(`${API_URL}/BlockIp`, payload, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  // PUT /BlockIp
  async updateBlockedIp({ id, ip }) {
    const API_URL = getApiBaseUrl();
    const payload = {
      id: Number(id),
      ip: String(ip || '').trim()
    };

    const response = await axios.put(`${API_URL}/BlockIp`, payload, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  // DELETE /BlockIp/{id} (with fallback to DELETE /BlockIp?id={id})
  async deleteBlockedIp(id) {
    const API_URL = getApiBaseUrl();
    return deleteById(`${API_URL}/BlockIp`, id);
  }
};

export default blockIpService;
