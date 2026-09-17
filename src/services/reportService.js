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

const requestReport = async (endpoint, params = {}, signal) => {
  const token = authService.getToken();
  if (!token) throw new Error('Your session has expired. Please sign in again.');

  const query = buildQuery(params);
  const response = await fetch(`${API_BASE_URL}/Report/${endpoint}${query ? `?${query}` : ''}`, {
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
    throw new Error(payload?.message || validationMessage || `${endpoint} failed (${response.status}).`);
  }

  return {
    data: payload?.data !== undefined ? payload.data : payload,
    totalCount: Number(payload?.totalCount) || 0
  };
};

const dateParams = ({ fromDate = '', toDate = '' } = {}) => ({ fromDate, toDate });

export const reportService = {
  getSalesReport(filters, signal) {
    const groupId = filters?.groupId || '';
    return requestReport('SalesReport', { ...dateParams(filters), groupId, GroupId: groupId }, signal);
  },

  getTicketStatusReport(filters, signal) {
    return requestReport('TicketStatusReport', dateParams(filters), signal);
  },

  getServiceReport(filters, signal) {
    return requestReport('ServiceReport', dateParams(filters), signal);
  },

  getUserPerformanceReport(filters, signal) {
    const brandId = filters?.brandId || '';
    const gatewayId = filters?.gatewayId || '';
    const userId = filters?.userId || '';
    return requestReport(
      'GetUserPerformanceReport',
      {
        ...dateParams(filters),
        brandId,
        BrandId: brandId,
        gatewayId,
        GatewayId: gatewayId,
        userId,
        UserId: userId
      },
      signal
    );
  },

  getRenewalReport(filters, signal) {
    return requestReport('RenewalReport', dateParams(filters), signal);
  }
};

export default reportService;
