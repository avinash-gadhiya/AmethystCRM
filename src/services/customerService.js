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

const request = async (path, { method = 'GET', params, data, signal } = {}) => {
  const token = authService.getToken();
  if (!token) throw new Error('Your session has expired. Please sign in again.');

  const query = buildQuery(params);
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`
  };
  if (data !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${API_BASE_URL}${path}${query ? `?${query}` : ''}`, {
    method,
    headers,
    body: data === undefined ? undefined : JSON.stringify(data),
    signal
  });

  if (response.status === 204) return { success: true };

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Customer API returned an invalid response (${response.status}).`);
  }

  if (!response.ok || payload?.success === false) {
    const validationMessage = payload?.errors ? Object.values(payload.errors).flat().join(', ') : '';
    throw new Error(payload?.message || validationMessage || `Customer request failed (${response.status}).`);
  }

  return payload;
};

const getViewIp = () => {
  try {
    return (
      localStorage.getItem('clientIp') ||
      localStorage.getItem('client_ip') ||
      localStorage.getItem('loginIp') ||
      window.location.hostname ||
      '127.0.0.1'
    );
  } catch {
    return '127.0.0.1';
  }
};

const normalizeList = (payload) => {
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload?.data) ? payload.data : [];
};

export const customerService = {
  async getCustomers(params = {}, signal) {
    const payload = await request('/Customer', {
      params: {
        Text: params.Text || '',
        SearchField: params.SearchField || '',
        FromDate: params.FromDate || '',
        ToDate: params.ToDate || '',
        PageNumber: params.PageNumber || 1,
        PageSize: params.PageSize || 10,
        SortProperty: params.SortProperty || 'customerId',
        IsDescending: params.IsDescending !== false,
        SalesPersonId: params.SalesPersonId || ''
      },
      signal
    });

    return {
      data: normalizeList(payload?.data),
      totalCount: Number(payload?.totalCount) || 0
    };
  },

  async searchCustomers(searchText, pageNumber = 1, pageSize = 10, signal) {
    const payload = await request('/Customer/search', {
      params: { searchText, pageNumber, pageSize },
      signal
    });
    const data = normalizeList(payload?.data ?? payload);
    return { data, totalCount: Number(payload?.totalCount) || data.length };
  },

  async rebuildSearchIndex() {
    try {
      return await request('/Customer/index/rebuild', { method: 'POST', data: {} });
    } catch {
      return request('/Customer/index/rebuild', { method: 'POST' });
    }
  },

  async getCustomerById(customerId, signal) {
    if (!customerId) throw new Error('Customer ID is required.');
    const payload = await request(`/Customer/${customerId}`, {
      params: { ip: getViewIp(), customerViewIp: getViewIp() },
      signal
    });
    const data = payload?.data;
    if (Array.isArray(data)) return data.find((customer) => Number(customer.customerId) === Number(customerId)) || null;
    return data || null;
  },

  async getCustomerViews(params = {}, signal) {
    const payload = await request('/Customer/GetCustomerView', {
      params: {
        Text: params.Text || '',
        PageNumber: params.PageNumber || 1,
        PageSize: params.PageSize || 20,
        SortProperty: params.SortProperty || 'customerId',
        IsDescending: params.IsDescending !== false
      },
      signal
    });
    return {
      data: normalizeList(payload?.data),
      totalCount: Number(payload?.totalCount) || 0
    };
  },

  async createCustomer(customer) {
    const payload = await request('/Customer', { method: 'POST', data: customer });
    return payload?.data || null;
  },

  async updateCustomer(customer) {
    const payload = await request('/Customer', { method: 'PUT', data: customer });
    return payload?.data || null;
  },

  async toggleCustomerStatus(customerId) {
    if (!customerId) throw new Error('Customer ID is required.');
    const payload = await request('/Customer/CanDisableCustomer', { method: 'PUT', params: { id: customerId } });
    return payload?.data;
  },

  async deleteCustomer(customerId) {
    if (!customerId) throw new Error('Customer ID is required.');
    return request(`/Customer/${customerId}`, { method: 'DELETE' });
  }
};

export default customerService;
