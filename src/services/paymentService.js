import apiClient from './core/apiClient';
import { normalizePaymentGateway } from '@/lib/paymentMethod';
import { buildRefundPayment, isRefundPayment } from '@/lib/paymentRefund';
import { normalizeApiRecord as normalizeFields } from '@/lib/normalizeApiRecord';

const unwrapPayment = (payload) => {
  let value = normalizeFields(payload);
  while (value?.data && !Array.isArray(value.data)) value = value.data;
  return value;
};

const normalizeList = (payload) => {
  const findList = (value) => {
    if (Array.isArray(value)) return value;
    if (value == null) return [];
    if (typeof value !== 'object') return null;
    for (const key of ['data', 'items', 'result']) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const list = findList(value[key]);
        if (list) return list;
      }
    }
    return null;
  };
  const list = findList(normalizeFields(payload));
  if (!list) throw new Error('The Payment API returned an invalid payment list. Please retry.');
  return list;
};

const paymentCount = (payload) => {
  const count = payload?.totalCount ?? payload?.data?.totalCount ?? payload?.result?.totalCount ??
    payload?.data?.data?.totalCount ?? payload?.totalRecords ?? payload?.data?.totalRecords;
  return count != null && Number.isFinite(Number(count)) ? Number(count) : null;
};

const paymentReadSignal = (signal) => signal ||
  (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(15000) : undefined);

export const paymentService = {
  async getPayments(params = {}, signal) {
    const payload = normalizeFields(await apiClient.get(
      '/Payment',
      {
        Text: params.Text || '',
        SearchField: params.SearchField || '',
        PaymentStatus: params.PaymentStatus || '',
        FromDate: params.FromDate || '',
        ToDate: params.ToDate || '',
        PageNumber: params.PageNumber || 1,
        PageSize: params.PageSize || 10,
        SortProperty: params.SortProperty || 'paymentId',
        IsDescending: params.IsDescending ?? true
      },
      signal
    ));
    const data = normalizeList(payload);
    return {
      data,
      totalCount: paymentCount(payload) ?? data.length,
      raw: payload
    };
  },

  async getPayment(id, signal) {
    if (!id) throw new Error('Payment ID is required.');
    const payload = await apiClient.get(`/Payment/${encodeURIComponent(id)}`, undefined, paymentReadSignal(signal));
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
    return { data, totalCount: paymentCount(normalized) };
  },

  async getOrderPayments(orderId, signal) {
    const id = Number(orderId);
    if (!Number.isInteger(id) || id <= 0) throw new Error('Order ID is required.');
    // Use the paginated route used by the Payments page. Let the backend
    // authorize the request instead of guessing grants from a singular code.
    const payments = [];
    const seen = new Set();
    for (let page = 1; page <= 1000; page += 1) {
      const result = await this.getPayments(
        { SearchField: 'OrderId', Text: String(id), PageNumber: page, PageSize: 100 },
        paymentReadSignal(signal)
      );
      const totalCount = paymentCount(result.raw);
      let added = 0;
      for (const payment of result.data) {
        const paymentId = Number(payment.paymentId);
        if (!paymentId || seen.has(paymentId)) continue;
        seen.add(paymentId);
        added += 1;
        // Some API versions ignore SearchField. Never display another order's payments.
        if (Number(payment.orderId) === id && !payment.isDeleted) payments.push(payment);
      }
      if (totalCount !== null && seen.size >= totalCount) return payments;
      if (totalCount === null && result.data.length < 100) return payments;
      if (result.data.length === 0 || added === 0) break;
    }
    throw new Error('The order payment history could not be fully loaded.');
  },

  async getOrderPaymentById(paymentId, orderId, signal) {
    const payment = await this.getPaymentById(paymentId, signal);
    if (Number(payment?.paymentId) !== Number(paymentId) || (Number(orderId) && Number(payment.orderId) !== Number(orderId))) {
      throw new Error('Payment not found in this order.');
    }
    return payment;
  },

  async getRefundContext(paymentId, signal, { orderId } = {}) {
    const orderScoped = Number(orderId) > 0;
    let history = orderScoped ? await this.getOrderPayments(orderId, signal) : null;
    const payment = orderScoped
      ? history.find((row) => Number(row.paymentId) === Number(paymentId))
      : await this.getPaymentById(paymentId, signal);
    if (!Number(payment?.paymentId)) throw new Error('Payment not found.');
    if (Number(payment.paymentId) !== Number(paymentId) || (Number(orderId) && Number(payment.orderId) !== Number(orderId))) {
      throw new Error('Payment not found in this order.');
    }
    if (payment.isVoid || payment.isDeleted) throw new Error('A voided or deleted payment cannot be refunded.');
    const editing = isRefundPayment(payment);
    if (editing && !Number(payment.refundPaymentId)) throw new Error('This refund is missing its original payment link.');
    const original = editing
      ? orderScoped
        ? history.find((row) => Number(row.paymentId) === Number(payment.refundPaymentId))
        : await this.getPaymentById(payment.refundPaymentId, signal)
      : payment;
    if (!Number(original?.orderId) || !Number(original?.paymentId)) throw new Error('The original payment is missing its order details.');
    if (Number(original.orderId) !== Number(payment.orderId) || isRefundPayment(original)) {
      throw new Error('This refund does not link to an original payment in the same order.');
    }
    if (original.isVoid || original.isDeleted) throw new Error('A voided or deleted payment cannot be refunded.');
    if (!history) history = await this.getOrderPayments(original.orderId, signal);
    if (history.some((row) => isRefundPayment(row) && !row.isDeleted && !row.isVoid && !Number(row.refundPaymentId))) {
      throw new Error('Refund history is missing original payment links. Complete payment history is required before refunding.');
    }
    if (!Number.isFinite(Number(original.amount)) || Number(original.amount) <= 0) throw new Error('The original payment amount is invalid.');
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

  async saveRefund({ paymentId, orderId, draft, userId, saleType }, signal) {
    // Re-read the payment and its refund history immediately before saving.
    const context = await this.getRefundContext(paymentId, signal, { orderId });
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
