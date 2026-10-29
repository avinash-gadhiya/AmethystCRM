import authService from './authService';
import { handleSessionExpired } from './http';

const API_BASE_URL = (import.meta.env.VITE_APP_API_URL || 'https://demoapi.enstasol.com/api').replace(/\/$/, '');

const buildQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === '' || value === null || value === undefined) return;
    query.set(key, String(value));
  });
  return query.toString();
};

// Reports use both direct lists and named collection envelopes.
export const reportRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload == null) return [];
  for (const key of ['data', 'Data', 'items', 'Items', 'rows', 'Rows', 'results', 'Results', 'users', 'Users']) {
    if (payload[key] !== undefined && payload[key] !== payload) return reportRows(payload[key]);
  }
  throw new Error('The report returned an unexpected response. Please try again.');
};

const requestReport = async (endpoint, params = {}, signal, resource = 'Report') => {
  const token = authService.getToken();
  if (!token) throw new Error('Your session has expired. Please sign in again.');

  const query = buildQuery(params);
  const response = await fetch(`${API_BASE_URL}/${resource}/${endpoint}${query ? `?${query}` : ''}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    },
    signal
  });

  if (response.status === 401) handleSessionExpired(token);
  if (response.status === 204) return { data: [], totalCount: 0 };
  let payload;
  try {
    payload = await response.json();
  } catch {
    const error = new Error(response.status === 403
      ? 'You do not have permission to view this report.'
      : `Unable to load the report (${response.status}). Please try again.`);
    error.statusCode = response.status;
    throw error;
  }

  if (!response.ok || payload?.success === false || payload?.Success === false) {
    const validationMessage = payload?.errors ? Object.values(payload.errors).flat().join(', ') : '';
    const error = new Error(payload?.message || payload?.Message || validationMessage || `${endpoint} failed (${response.status}).`);
    error.statusCode = Number(payload?.statusCode) || response.status;
    error.endpoint = endpoint;
    throw error;
  }

  const data = payload?.data !== undefined ? payload.data : payload?.Data !== undefined ? payload.Data : payload;
  if (data !== null && typeof data !== 'object') throw new Error('The report returned an unexpected response. Please try again.');
  return {
    data: data ?? [],
    totalCount: Number(payload?.totalCount ?? payload?.TotalCount ?? data?.totalCount ?? data?.TotalCount) || 0
  };
};

const dateTime = (value, endOfDay = false) => {
  if (!value) return '';
  return value.includes('T') ? value : `${value}T${endOfDay ? '23:59:59' : '00:00:00'}`;
};

const dateParams = ({ fromDate = '', toDate = '' } = {}) => ({
  fromDate: dateTime(fromDate),
  toDate: dateTime(toDate, true)
});

const pagedParams = (filters = {}) => ({
  ...dateParams(filters),
  PageNumber: filters.page || 1,
  PageSize: filters.pageSize || 10,
  SortProperty: filters.sortProperty || '',
  IsDescending: filters.isDescending ?? true,
  Text: filters.search || ''
});

const leadDateParams = (filters = {}) => ({
  fromdate: dateTime(filters.fromDate),
  todate: dateTime(filters.toDate, true)
});

export const reportService = {
  getSalesReport(filters, signal) {
    return requestReport('SalesReport', pagedParams(filters), signal);
  },

  getTicketStatusReport(filters, signal) {
    return requestReport('TicketStatusReport', dateParams(filters), signal);
  },

  getServiceReport(filters, signal) {
    return requestReport('ServiceReport', pagedParams(filters), signal);
  },

  getUserPerformanceReport(filters, signal) {
    return requestReport('GetUserPerformanceReport', dateParams(filters), signal);
  },

  getRenewalReport(filters, signal) {
    return requestReport('RenewalReport', pagedParams(filters), signal);
  },

  getLeadsByDisposition(filters, signal) {
    return requestReport(
      'LeadsByDisposition',
      {
        ...leadDateParams(filters),
        userId: filters?.userId || '',
        vendorId: filters?.vendorId || ''
      },
      signal,
      'LeadReport'
    );
  },

  getLeadPickByUsers(filters, signal) {
    return requestReport(
      'LeadPickByUsers',
      {
        ...leadDateParams(filters),
        groupId: filters?.groupId || ''
      },
      signal,
      'LeadReport'
    );
  },

  getGroupDropdown(signal) {
    return requestReport(
      'GroupDropdown',
      { PageNumber: 1, PageSize: 250, SortProperty: 'groupName', IsDescending: false },
      signal,
      'Group'
    );
  }
};

export default reportService;
