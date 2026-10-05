import axios from 'axios';

import { getAuthHeaders } from './http';

const API_BASE_URL = (import.meta.env.VITE_APP_API_URL || 'https://demoapi.enstasol.com/api').replace(/\/$/, '');

const unwrapList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const unwrapReport = (payload) => payload?.data?.data || payload?.data || payload || {};

export const performanceDashboardService = {
  async load({ fromDate, toDate }, signal) {
    const headers = getAuthHeaders();
    const [reportResponse, userResponse, locationResponse] = await Promise.all([
      axios.get(`${API_BASE_URL}/Report/GetUserPerformanceReport`, {
        headers,
        params: { fromDate, toDate },
        signal
      }),
      axios.get(`${API_BASE_URL}/User/UserDropDown`, {
        headers,
        params: { Text: '', PageNumber: 1, PageSize: 5000, SortProperty: 'userId', IsDescending: false },
        signal
      }),
      axios.get(`${API_BASE_URL}/Location/LocationDropdown`, { headers, signal })
    ]);

    return {
      report: unwrapReport(reportResponse.data),
      users: unwrapList(userResponse.data),
      locations: unwrapList(locationResponse.data)
    };
  }
};

export default performanceDashboardService;
