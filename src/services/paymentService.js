import apiClient from './core/apiClient';
import { normalizePaymentGateway } from '@/lib/paymentMethod';
import { buildRefundPayment, isRefundPayment } from '@/lib/paymentRefund';

const normalizeFields = (value) => {
  if (Array.isArray(value)) return value.map(normalizeFields);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key.charAt(0).toLowerCase() + key.slice(1), normalizeFields(item)])
  );
};

const unwrapPayment = (payload) => {
  let value = normalizeFields(payload);
  while (value?.data && !Array.isArray(value.data)) value = value.data;
  return value;
};

const normalizeList = (payload) => {
  payload = normalizeFields(payload);
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

export const paymentService = {
  async getPayments(params = {}, signal) {
    const payload = await apiClient.get(
      '/Payment',
      {
        Text: params.Text || '',
        SearchField: params.SearchField || '',
        PaymentStatus: params.PaymentStatus || '',
        FromDate: params.FromDate || '',
        ToDate: params.ToDate || '',
        BrandId: params.BrandId || '',
        GatewayId: params.GatewayId || '',
        PageNumber: params.PageNumber || 1,
        PageSize: params.PageSize || 10,
        SortProperty: params.SortProperty || 'paymentId',
        IsDescending: params.IsDescending ?? true
      },
      signal
    );
    const data = normalizeList(payload);
    return {
      data,
      totalCount: Number(payload?.totalCount ?? payload?.data?.totalCount ?? payload?.totalRecords ?? data.length) || 0,
      raw: payload
    };
  },

  async getPayment(id, signal) {
    if (!id) throw new Error('Payment ID is required.');
    const payload = await apiClient.get(`/Payment/${encodeURIComponent(id)}`, undefined, signal);
    return unwrapPayment(payload);
  },

  async getPaymentById(id, signal) {
    return this.getPayment(id, signal);
  },

  async getAllPayments(params = {}, signal) {
    const query = {
      Text: params.Text || '',
      SearchField: params.SearchField || '',
      FromDate: params.FromDate || '',
      ToDate: params.ToDate || '',
      PaymentStatus: params.PaymentStatus || '',
      PageNumber: params.PageNumber || 1,
      PageSize: params.PageSize || 100,
      SortProperty: params.SortProperty || 'paymentId',
      IsDescending: params.IsDescending ?? false
    };
    let payload;
    try {
      payload = await apiClient.get('/Payment/GetAllPayment', query, signal);
    } catch (error) {
      if (![404, 405].includes(error?.status)) throw error;
      payload = await apiClient.get('/Payment', query, signal);
    }
    const normalized = normalizeFields(payload);
    const data = normalizeList(normalized);
    return { data, totalCount: Number(normalized?.totalCount ?? normalized?.data?.totalCount ?? normalized?.totalRecords) || null };
  },

  async getRefundContext(paymentId, signal) {
    const payment = await this.getPaymentById(paymentId, signal);
    if (!Number(payment?.paymentId)) throw new Error('Payment not found.');
    if (payment.isVoid || payment.isDeleted) throw new Error('A voided or deleted payment cannot be refunded.');
    const editing = isRefundPayment(payment);
    if (editing && !Number(payment.refundPaymentId)) throw new Error('This refund is missing its original payment link.');
    const original = editing ? await this.getPaymentById(payment.refundPaymentId, signal) : payment;
    if (!Number(original?.orderId) || !Number(original?.paymentId)) throw new Error('The original payment is missing its order details.');
    if (original.isVoid || original.isDeleted) throw new Error('A voided or deleted payment cannot be refunded.');
    const history = [];
    const seen = new Set();
    for (let page = 1; ; page += 1) {
      if (page > 1000) throw new Error('The refund history could not be fully loaded.');
      const result = await this.getAllPayments(
        { SearchField: 'OrderId', Text: String(original.orderId), PageNumber: page, PageSize: 100 },
        signal
      );
      let added = 0;
      for (const row of result.data) {
        const id = Number(row.paymentId);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        added += 1;
        if (Number(row.orderId) === Number(original.orderId)) history.push(row);
      }
      if (result.totalCount !== null && seen.size >= result.totalCount) break;
      if (result.totalCount === null && result.data.length < 100) break;
      if (result.data.length === 0 || added === 0) throw new Error('The refund history could not be fully loaded.');
    }
    const refundedCents = history
      .filter(
        (row) =>
          isRefundPayment(row) &&
          Number(row.refundPaymentId) === Number(original.paymentId) &&
          (!editing || Number(row.paymentId) !== Number(payment.paymentId)) &&
          !row.isDeleted &&
          !row.isVoid
      )
      .reduce((sum, row) => sum + Math.round(Math.abs(Number(row.amount) || 0) * 100), 0);
    const availableAmount = Math.max(0, Math.round(Number(original.amount || 0) * 100) - refundedCents) / 100;
    return { payment, original, availableAmount };
  },

  async saveRefund({ paymentId, draft, userId, saleType }, signal) {
    // Re-read the payment and its refund history immediately before saving.
    const context = await this.getRefundContext(paymentId, signal);
    const payload = buildRefundPayment({ ...context, draft, userId, saleType });
    const response = isRefundPayment(context.payment) ? await this.updatePayment(payload) : await this.createPayment(payload);
    const saved = unwrapPayment(response);
    return Number(saved?.paymentId) > 0 ? { ...payload, ...saved } : payload;
  },

  createPayment(payload) {
    return apiClient.post('/Payment', normalizePaymentGateway(payload));
  },

  updatePayment(payload) {
    return apiClient.put('/Payment', normalizePaymentGateway(payload));
  },

  deletePayment(id) {
    return apiClient.delete(`/Payment/${encodeURIComponent(id)}`);
  },

  sendMail(paymentId, brandEmailTempleteId) {
    return apiClient.get('/Payment/SendMail', { paymentId, brandEmailTempleteId });
  },

  sendPaymentMail({ paymentId, brandEmailTempleteId }) {
    return this.sendMail(paymentId, brandEmailTempleteId);
  },

  sendPandaDocMail(paymentId) {
    return apiClient.get('/Payment/SendPandaDocMail', { paymentId });
  },

  uploadRefundFile(file) {
    if (!file) throw new Error('Please select an Excel file.');
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.request('/Payment/UploadExcel', { method: 'POST', data: formData });
  },

  uploadRefundExcel(file) {
    return this.uploadRefundFile(file);
  },

  async getSharePayments({ paymentId = 0, shareWithId = 0, shareTypeId = 0 } = {}) {
    const endpoint =
      import.meta.env.VITE_APP_SHARE_PAYMENT_ENDPOINT || import.meta.env.VITE_APP_ORDER_SALE_SHARE_ENDPOINT || '/SharePayment';
    return normalizeList(
      await apiClient.get(endpoint, {
        PaymentId: Number(paymentId) || 0,
        ShareWithId: Number(shareWithId) || 0,
        ShareTypeId: Number(shareTypeId) || 0
      })
    );
  },

  createSharePayments(payload) {
    const endpoint =
      import.meta.env.VITE_APP_SHARE_PAYMENT_ENDPOINT || import.meta.env.VITE_APP_ORDER_SALE_SHARE_ENDPOINT || '/SharePayment';
    return apiClient.post(endpoint, Array.isArray(payload) ? payload : [payload]);
  },

  updateSharePayments(payload) {
    const endpoint =
      import.meta.env.VITE_APP_SHARE_PAYMENT_ENDPOINT || import.meta.env.VITE_APP_ORDER_SALE_SHARE_ENDPOINT || '/SharePayment';
    return apiClient.put(endpoint, Array.isArray(payload) ? payload : [payload]);
  },

  async deleteSharePayment(id) {
    const endpoint =
      import.meta.env.VITE_APP_SHARE_PAYMENT_ENDPOINT || import.meta.env.VITE_APP_ORDER_SALE_SHARE_ENDPOINT || '/SharePayment';
    const attempts = [
      () => apiClient.delete(endpoint, { id }),
      () => apiClient.delete(endpoint, { sharePaymentId: id }),
      () => apiClient.delete(`${endpoint}/${encodeURIComponent(id)}`)
    ];

    let lastError;
    for (const attempt of attempts) {
      try {
        return await attempt();
      } catch (error) {
        lastError = error;
        if (![400, 404, 405].includes(error?.status)) throw error;
      }
    }
    throw lastError;
  }
};

export default paymentService;
