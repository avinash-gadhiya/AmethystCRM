import apiClient from './core/apiClient';

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
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  return [];
};

export const customerService = {
  async getCustomers(params = {}, signal) {
    const payload = await apiClient.request('/Customer', {
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
      data: normalizeList(payload),
      totalCount: Number(payload?.totalCount ?? payload?.data?.totalCount ?? payload?.totalRecords) || 0
    };
  },

  async searchCustomers(searchText, pageNumber = 1, pageSize = 10, signal) {
    const payload = await apiClient.request('/Customer/search', {
      params: { searchText, pageNumber, pageSize },
      signal
    });
    const data = normalizeList(payload?.data ?? payload);
    return {
      data,
      totalCount: Number(payload?.totalCount ?? payload?.data?.totalCount ?? payload?.totalRecords) || data.length
    };
  },

  async rebuildSearchIndex() {
    try {
      return await apiClient.request('/Customer/index/rebuild', { method: 'POST', data: {} });
    } catch (error) {
      if (![400, 415].includes(error?.status)) throw error;
      return apiClient.request('/Customer/index/rebuild', { method: 'POST' });
    }
  },

  async getCustomerById(customerId, signal) {
    if (!customerId) throw new Error('Customer ID is required.');
    const payload = await apiClient.request(`/Customer/${customerId}`, {
      params: { ip: getViewIp(), customerViewIp: getViewIp() },
      signal
    });
    const data = payload?.data;
    if (Array.isArray(data)) return data.find((customer) => Number(customer.customerId) === Number(customerId)) || null;
    return data || null;
  },

  async getCustomerViews(params = {}, signal) {
    const payload = await apiClient.request('/Customer/GetCustomerView', {
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
      data: normalizeList(payload),
      totalCount: Number(payload?.totalCount ?? payload?.data?.totalCount ?? payload?.totalRecords) || 0
    };
  },

  async createCustomer(customer) {
    const payload = await apiClient.request('/Customer', { method: 'POST', data: customer });
    return payload?.data || null;
  },

  async updateCustomer(customer) {
    const payload = await apiClient.request('/Customer', { method: 'PUT', data: customer });
    return payload?.data || null;
  },

  async toggleCustomerStatus(customerId) {
    if (!customerId) throw new Error('Customer ID is required.');
    const payload = await apiClient.request('/Customer/CanDisableCustomer', { method: 'PUT', params: { id: customerId } });
    return payload?.data;
  },

  async deleteCustomer(customerId) {
    if (!customerId) throw new Error('Customer ID is required.');
    return apiClient.request(`/Customer/${customerId}`, { method: 'DELETE' });
  }
};

export default customerService;
