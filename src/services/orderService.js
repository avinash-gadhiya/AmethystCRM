import apiClient from './core/apiClient';
import { normalizePaymentGateway } from '@/lib/paymentMethod';
import { normalizeApiRecord } from '@/lib/normalizeApiRecord';

const normalizeList = (payload) => {
  payload = normalizeApiRecord(payload);
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

const dateBound = (value, end = false) => /^\d{4}-\d{2}-\d{2}$/.test(value || '')
  ? `${value}T${end ? '23:59:59.999' : '00:00:00'}` : value || '';

const orderQuery = (params = {}, includePaging = true) => ({
  SearchField: params.SearchField || '',
  Text: params.Text || '',
  fromDate: dateBound(params.Date || params.FromDate || params.fromDate),
  toDate: dateBound(params.Date || params.ToDate || params.toDate, true),
  ...(includePaging
    ? {
        PageNumber: params.PageNumber || 1,
        PageSize: params.PageSize || 10,
        SortProperty: params.SortProperty || 'orderDate',
        IsDescending: params.IsDescending ?? true,
        CustomerId: params.CustomerId ?? params.customerId ?? ''
      }
    : {})
});

export const orderService = {
  async getOrders(params = {}, signal) {
    const payload = normalizeApiRecord(await apiClient.get('/Order', orderQuery(params), signal));
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
    const { fromDate, toDate } = orderQuery(query, false);
    return normalizeSummary(normalizeApiRecord(await apiClient.get('/Order/GetOrderSummary', { fromDate, toDate }, signal)));
  },

  async getOrderById(id, signal) {
    if (!id) throw new Error('Order ID is required.');
    const payload = await apiClient.get(`/Order/${encodeURIComponent(id)}`, undefined, signal);
    let order = normalizeApiRecord(payload);
    while (order && !Array.isArray(order) && order.data !== undefined) order = order.data;
    if (Array.isArray(order)) order = order.find((row) => Number(row.orderId) === Number(id));
    if (Number(order?.orderId) !== Number(id)) throw new Error('Order not found.');
    return order;
  }
};

export default orderService;
