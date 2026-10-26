import apiClient from './core/apiClient';
import { normalizePaymentGateway } from '@/lib/paymentMethod';

const normalizeList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
};

const normalizeSummary = (payload) => {
  if (!payload || typeof payload !== 'object') return {};
  return payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data) ? payload.data : payload;
};

const orderQuery = (params = {}, includePaging = true) => ({
  SearchField: params.SearchField || '',
  Text: params.Text || '',
  Date: params.Date || '',
  FromDate: params.FromDate ?? params.fromDate ?? '',
  ToDate: params.ToDate ?? params.toDate ?? '',
  ...(includePaging
    ? {
        PageNumber: params.PageNumber || 1,
        PageSize: params.PageSize || 10,
        SortProperty: params.SortProperty || 'orderDate',
        IsDescending: params.IsDescending ?? true
      }
    : {})
});

export const orderService = {
  async getOrders(params = {}, signal) {
    const payload = await apiClient.get('/Order', orderQuery(params), signal);
    const data = normalizeList(payload);
    return {
      data,
      totalCount: Number(payload?.totalCount ?? payload?.data?.totalCount ?? payload?.totalRecords ?? data.length) || 0,
      raw: payload
    };
  },

  async createOrder(orderDTO) {
    const payload = { ...(orderDTO || {}) };
    delete payload.payments;
    return apiClient.post('/Order', {
      ...payload,
      payment: normalizePaymentGateway(payload.payment || {}),
      sharePayments: Array.isArray(payload.sharePayments) ? payload.sharePayments : []
    });
  },

  async updateOrder(editOrderDTO) {
    return apiClient.put('/Order', editOrderDTO);
  },

  async deleteOrder(id) {
    return apiClient.delete('/Order', { id });
  },

  async getCustomerOrders(customerId, ip = '127.0.0.1', signal) {
    return normalizeList(await apiClient.get('/Order/GetCustomerOrders', { customerId, ip }, signal));
  },

  async getOrderSummary(params = {}, toDateOrSignal, maybeSignal) {
    let query = params;
    let signal = toDateOrSignal;
    if (typeof params === 'string') {
      query = { FromDate: params, ToDate: typeof toDateOrSignal === 'string' ? toDateOrSignal : '' };
      signal = typeof toDateOrSignal === 'string' ? maybeSignal : toDateOrSignal;
    }
    return normalizeSummary(await apiClient.get('/Order/GetOrderSummary', orderQuery(query, false), signal));
  },

  async getOrderById(id, signal) {
    if (!id) throw new Error('Order ID is required.');
    const payload = await apiClient.get(`/Order/${encodeURIComponent(id)}`, undefined, signal);
    return payload?.data ?? payload;
  }
};

export default orderService;
