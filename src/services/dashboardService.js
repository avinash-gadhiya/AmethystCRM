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

const requestDashboard = async (endpoint, params, signal) => {
  const token = authService.getToken();
  if (!token) throw new Error('Your session has expired. Please sign in again.');

  const query = buildQuery(params);
  const response = await fetch(`${API_BASE_URL}/Dashboard/${endpoint}${query ? `?${query}` : ''}`, {
    method: 'GET',
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

const createDateParams = (fromDate, toDate, userId) => ({
  fromdate: fromDate,
  todate: toDate,
  fromDate,
  toDate,
  userId
});

export const dashboardService = {
  getMonthlyFinancialData(fromDate, toDate, signal) {
    return requestDashboard('MonthlyFinancialData', createDateParams(fromDate, toDate), signal);
  },

  getLocationWiseMonthlyTotalSales(fromDate, toDate, signal) {
    return requestDashboard('LocationWiseMonthlyTotalSales', createDateParams(fromDate, toDate), signal);
  },

  getDayWiseSalesAndRPL(fromDate, toDate, userId, signal) {
    return requestDashboard('DayWiseSalesAndRPL', createDateParams(fromDate, toDate, userId), signal);
  },

  getUserWiseSummary(fromDate, toDate, userId, signal) {
    return requestDashboard('UserWiseSummary', createDateParams(fromDate, toDate, userId), signal);
  },

  getDailyLocationWiseSales(fromDate, toDate, signal) {
    return requestDashboard('DailyLocationWiseSales', createDateParams(fromDate, toDate), signal);
  },

  getGroupWiseLeads(fromDate, toDate, group, signal) {
    return requestDashboard('GroupWiseLeads', { ...createDateParams(fromDate, toDate), Group: group }, signal);
  },

  getSalesPersonWiseLeads(fromDate, toDate, userId, signal) {
    return requestDashboard('SalesPersonWiseLeads', createDateParams(fromDate, toDate, userId), signal);
  },

  getServiceManagerDashboard(fromDate, toDate, userId, signal) {
    return requestDashboard('ServiceManagerDashboard', { ...createDateParams(fromDate, toDate, userId), pageNo: 1, PageSize: 10 }, signal);
  },

  async loadDashboard({ fromDate, toDate, userId, signal }) {
    const requests = {
      monthlyFinancial: this.getMonthlyFinancialData(fromDate, toDate, signal),
      locationSales: this.getLocationWiseMonthlyTotalSales(fromDate, toDate, signal),
      dayWiseSales: this.getDayWiseSalesAndRPL(fromDate, toDate, userId, signal),
      userSummary: this.getUserWiseSummary(fromDate, toDate, userId, signal),
      dailyLocationSales: this.getDailyLocationWiseSales(fromDate, toDate, signal),
      groupLeads: this.getGroupWiseLeads(fromDate, toDate, '', signal),
      salesPersonLeads: this.getSalesPersonWiseLeads(fromDate, toDate, userId, signal),
      serviceManager: this.getServiceManagerDashboard(fromDate, toDate, userId, signal)
    };

    const names = Object.keys(requests);
    const results = await Promise.allSettled(Object.values(requests));
    const data = {};
    const errors = [];

    results.forEach((result, index) => {
      const name = names[index];
      if (result.status === 'fulfilled') {
        data[name] = result.value;
      } else if (result.reason?.name !== 'AbortError') {
        errors.push({ name, message: result.reason?.message || 'Request failed' });
      }
    });

    if (signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
    return { data, errors };
  }
};

export default dashboardService;
