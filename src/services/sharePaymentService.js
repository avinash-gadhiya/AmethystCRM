import apiClient from './core/apiClient';

const normalizeList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  return [];
};

export const sharePaymentService = {
  async getSharePayments(params = {}, signal) {
    return normalizeList(
      await apiClient.get(
        '/SharePayment',
        {
          PaymentId: params.PaymentId || '',
          ShareWithId: params.ShareWithId || '',
          ShareTypeId: params.ShareTypeId || ''
        },
        signal
      )
    );
  },

  createSharePayment(payload) {
    return apiClient.post('/SharePayment', payload);
  },

  updateSharePayment(payload) {
    return apiClient.put('/SharePayment', payload);
  },

  async deleteSharePayment(id) {
    let lastError;
    for (const attempt of [
      () => apiClient.delete('/SharePayment', { id }),
      () => apiClient.delete('/SharePayment', { sharePaymentId: id }),
      () => apiClient.delete(`/SharePayment/${encodeURIComponent(id)}`)
    ]) {
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

export default sharePaymentService;
