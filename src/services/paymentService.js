import apiClient from './core/apiClient';

const normalizeList = (payload) => {
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
    return payload?.data ?? payload;
  },

  async getPaymentById(id, signal) {
    return this.getPayment(id, signal);
  },

  createPayment(payload) {
    return apiClient.post('/Payment', payload);
  },

  updatePayment(payload) {
    return apiClient.put('/Payment', payload);
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
      import.meta.env.VITE_APP_SHARE_PAYMENT_ENDPOINT ||
      import.meta.env.VITE_APP_ORDER_SALE_SHARE_ENDPOINT ||
      '/SharePayment';
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
      import.meta.env.VITE_APP_SHARE_PAYMENT_ENDPOINT ||
      import.meta.env.VITE_APP_ORDER_SALE_SHARE_ENDPOINT ||
      '/SharePayment';
    return apiClient.post(endpoint, Array.isArray(payload) ? payload : [payload]);
  },

  updateSharePayments(payload) {
    const endpoint =
      import.meta.env.VITE_APP_SHARE_PAYMENT_ENDPOINT ||
      import.meta.env.VITE_APP_ORDER_SALE_SHARE_ENDPOINT ||
      '/SharePayment';
    return apiClient.put(endpoint, Array.isArray(payload) ? payload : [payload]);
  },

  async deleteSharePayment(id) {
    const endpoint =
      import.meta.env.VITE_APP_SHARE_PAYMENT_ENDPOINT ||
      import.meta.env.VITE_APP_ORDER_SALE_SHARE_ENDPOINT ||
      '/SharePayment';
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
