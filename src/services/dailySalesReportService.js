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

const assertSuccessfulPayload = (payload, fallbackMessage) => {
  if (payload?.success !== false) return;

  const validationMessage = payload?.errors ? Object.values(payload.errors).flat().join(', ') : '';
  const error = new Error(payload?.message || validationMessage || fallbackMessage);
  error.data = payload;
  throw error;
};

export const dailySalesReportService = {
  async getPerformanceReport({ fromDate, toDate }, signal) {
    const response = await axios.get(`${API_BASE_URL}/Report/GetUserPerformanceReport`, {
      headers: getAuthHeaders(),
      params: { fromDate, toDate },
      signal
    });

    assertSuccessfulPayload(response.data, 'Unable to load the daily sales performance report.');
    const data = response.data?.data || {};

    return {
      userSalePayments: Array.isArray(data.userSalePayments) ? data.userSalePayments : [],
      userLeads: Array.isArray(data.userLeads) ? data.userLeads : []
    };
  },

  async getLocations(signal) {
    const response = await axios.get(`${API_BASE_URL}/Location/LocationDropdown`, {
      headers: getAuthHeaders(),
      signal
    });

    assertSuccessfulPayload(response.data, 'Unable to load locations.');
    return unwrapList(response.data)
      .map((location) => ({
        locationId: Number(location?.locationId ?? location?.id ?? 0),
        name: String(location?.name ?? location?.locationName ?? '').trim()
      }))
      .filter((location) => location.locationId > 0);
  },

  async getUsers(signal) {
    const response = await axios.get(`${API_BASE_URL}/User`, {
      headers: getAuthHeaders(),
      params: {
        Text: '',
        PageNumber: 1,
        PageSize: 5000,
        SortProperty: 'userId',
        IsDescending: false
      },
      signal
    });

    assertSuccessfulPayload(response.data, 'Unable to load users.');
    return unwrapList(response.data);
  },

  async getDashboardData(filters, signal) {
    const [report, locations, users] = await Promise.all([
      this.getPerformanceReport(filters, signal),
      this.getLocations(signal),
      this.getUsers(signal)
    ]);

    return { report, locations, users };
  }
};

export default dailySalesReportService;
