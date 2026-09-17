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
  const response = await fetch(`${API_BASE_URL}${path}${query ? `?${query}` : ''}`, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(data !== undefined ? { 'Content-Type': 'application/json' } : {})
    },
    body: data !== undefined ? JSON.stringify(data) : undefined,
    signal
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.success === false) {
    const validationMessage = payload?.errors ? Object.values(payload.errors).flat().join(', ') : '';
    const error = new Error(payload?.message || validationMessage || `Gateway request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }

  return payload || {};
};

const unwrapList = (payload) => {
  const source = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
  return { data: source, totalCount: Number(payload?.totalCount) || source.length };
};

const pageParams = (params = {}, defaultSort) => ({
  Text: params.Text || '',
  PageNumber: params.PageNumber || 1,
  PageSize: params.PageSize || 10,
  SortProperty: params.SortProperty || defaultSort,
  IsDescending: params.IsDescending !== false,
  BrandId: params.BrandId || '',
  GatewayId: params.GatewayId || ''
});

export const gatewayService = {
  async getGateways(params = {}, signal) {
    return unwrapList(await request('/Gateway', { params: pageParams(params, 'gatewayId'), signal }));
  },

  async getGatewayDropdown(params = {}, signal) {
    return unwrapList(
      await request('/Gateway/GatewayDropdown', {
        params: { ...pageParams({ ...params, PageSize: params.PageSize || 500 }, 'gatewayId'), IsDescending: false },
        signal
      })
    );
  },

  async createGateway(gateway) {
    return request('/Gateway', { method: 'POST', data: gateway });
  },

  async updateGateway(gateway) {
    return request('/Gateway', { method: 'PUT', data: gateway });
  },

  async deleteGateway(gatewayId) {
    return request('/Gateway', { method: 'DELETE', params: { id: gatewayId } });
  },

  async getGatewayPaymentTypes(params = {}, signal) {
    return unwrapList(await request('/GatewayPaymentType', { params, signal }));
  },

  async createGatewayPaymentType(mapping) {
    return request('/GatewayPaymentType', { method: 'POST', data: mapping });
  },

  async updateGatewayPaymentType(mapping) {
    return request('/GatewayPaymentType', { method: 'PUT', data: mapping });
  },

  async deleteGatewayPaymentType(mapping) {
    const attempts = mapping.gatewayPaymentTypeId
      ? [{ id: mapping.gatewayPaymentTypeId }, { gatewayPaymentTypeId: mapping.gatewayPaymentTypeId }]
      : [
          { gatewayId: mapping.gatewayId, paymentTypeId: mapping.paymentTypeId },
          { getwayId: mapping.gatewayId, paymentTypeId: mapping.paymentTypeId }
        ];

    let lastError;
    for (const params of attempts) {
      try {
        return await request('/GatewayPaymentType', { method: 'DELETE', params });
      } catch (error) {
        lastError = error;
        if (![400, 404, 405].includes(error.status)) throw error;
      }
    }
    throw lastError;
  },

  async getTransactions(params = {}, signal) {
    return unwrapList(
      await request('/GatewayTransaction', {
        params: {
          ...pageParams(params, 'transactionDateUtc'),
          FromDate: params.FromDate || '',
          ToDate: params.ToDate || '',
          NormalizedStatus: params.NormalizedStatus,
          CardLast4: params.CardLast4 || '',
          GatewayTransactionRef: params.GatewayTransactionRef || ''
        },
        signal
      })
    );
  },

  async syncTransactions(syncRequest) {
    const gatewayIds = Array.isArray(syncRequest.gatewayIds)
      ? syncRequest.gatewayIds.map(Number).filter((id) => Number.isFinite(id) && id > 0)
      : [];
    return request('/GatewayTransaction/Sync', {
      method: 'POST',
      data: {
        brandId: Number(syncRequest.brandId) || 0,
        fromDate: syncRequest.fromDate || null,
        toDate: syncRequest.toDate || null,
        gatewayIds: gatewayIds.length ? gatewayIds : null
      }
    });
  },

  async getSyncLogs(params = {}, signal) {
    return unwrapList(await request('/GatewayTransaction/SyncLog', { params: pageParams(params, 'startedAtUtc'), signal }));
  }
};

export default gatewayService;
