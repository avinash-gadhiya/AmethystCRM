import authService from './authService';

const API_BASE_URL = (import.meta.env.VITE_APP_API_URL || 'https://demoapi.enstasol.com/api').replace(/\/$/, '');

const buildQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === '' || value === null || value === undefined) return;
    query.set(key, String(value));
  });
  return query.toString();
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

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`${endpoint} returned an invalid response (${response.status}).`);
  }

  if (!response.ok || payload?.success === false) {
    const validationMessage = payload?.errors ? Object.values(payload.errors).flat().join(', ') : '';
    const error = new Error(payload?.message || validationMessage || `${endpoint} failed (${response.status}).`);
    error.statusCode = Number(payload?.statusCode) || response.status;
    error.endpoint = endpoint;
    throw error;
  }

  return {
    data: payload?.data !== undefined ? payload.data : payload,
    totalCount: Number(payload?.totalCount) || 0
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
