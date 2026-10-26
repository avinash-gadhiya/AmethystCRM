import apiClient from './core/apiClient';
import { getCurrentLoginIpv4 } from './clientIpService';
import authService from './authService';
import { buildCustomerPayload } from '@/lib/customerPayload';

const normalizeFields = (value) => {
  if (Array.isArray(value)) return value.map(normalizeFields);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key.charAt(0).toLowerCase() + key.slice(1), normalizeFields(item)])
  );
};

const unwrapCustomer = (payload, fallback, requestedId = Number(fallback?.customerId) || 0) => {
  let value = normalizeFields(payload);
  while (value && typeof value === 'object' && !Array.isArray(value) && value.data !== undefined) value = value.data;
  if (Array.isArray(value)) value = requestedId ? value.find((item) => Number(item.customerId) === requestedId) : value[0];
  if (value && typeof value === 'object' && Number(value.customerId) > 0) return { ...fallback, ...value };
  if ((typeof value === 'number' || typeof value === 'string') && Number(value) > 0) return { ...fallback, customerId: Number(value) };
  return fallback || null;
};

const normalizeList = (payload) => {
  payload = normalizeFields(payload);
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
      totalCount:
        Number(
          payload?.totalCount ?? payload?.data?.totalCount ?? payload?.totalRecords ?? payload?.TotalCount ?? normalizeList(payload).length
        ) || 0
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
    const ip = await getCurrentLoginIpv4();
    const payload = await apiClient.request(`/Customer/${customerId}`, {
      params: { ip, customerViewIp: ip },
      signal
    });
    return unwrapCustomer(payload, null, Number(customerId));
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
    const data = buildCustomerPayload(customer, { isCreate: true, user: authService.getUser() || {} });
    const payload = await apiClient.post('/Customer', data);
    return unwrapCustomer(payload, data);
  },

  async updateCustomer(customer) {
    const data = buildCustomerPayload(customer, { user: authService.getUser() || {} });
    const payload = await apiClient.put('/Customer', data);
    return unwrapCustomer(payload, data);
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
