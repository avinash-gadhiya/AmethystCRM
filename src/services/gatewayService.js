import apiClient from './core/apiClient';

const request = (path, options) => apiClient.request(path, options);

const normalizeFields = (value) => {
  if (Array.isArray(value)) return value.map(normalizeFields);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key.charAt(0).toLowerCase() + key.slice(1), normalizeFields(item)])
  );
};

const unwrapList = (payload) => {
  payload = normalizeFields(payload);
  let source = [];
  if (Array.isArray(payload?.data)) {
    source = payload.data;
  } else if (payload?.data && typeof payload.data === 'object') {
    if (Array.isArray(payload.data.data)) {
      source = payload.data.data;
    } else if (
      (payload.data.gatewayPaymentTypeId && payload.data.gatewayPaymentTypeId !== 0) ||
      (payload.data.gatewayId && payload.data.gatewayId !== 0) ||
      (payload.data.paymentTypeIds && payload.data.paymentTypeIds.length > 0)
    ) {
      source = [payload.data];
    } else {
      source = [];
    }
  } else if (Array.isArray(payload)) {
    source = payload;
  }
  return { data: source, totalCount: Number(payload?.totalCount) || source.length };
};

const normalizeGatewayOption = (option) => {
  const gatewayId = option?.gatewayId ?? option?.id ?? option?.value;
  const gatewayName = option?.gatewayName ?? option?.name ?? option?.label ?? option?.text;

  return {
    ...option,
    gatewayId,
    gatewayName: gatewayName || (gatewayId !== undefined && gatewayId !== null ? `Gateway ${gatewayId}` : '')
  };
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
    const result = unwrapList(
      await request('/Gateway/GatewayDropdown', {
        params: { ...pageParams({ ...params, PageSize: params.PageSize || 500 }, 'gatewayId'), IsDescending: false },
        signal
      })
    );

    const data = result.data
      .map(normalizeGatewayOption)
      .filter((option) => option.gatewayId !== undefined && option.gatewayId !== null && option.gatewayName);

    return { data, totalCount: data.length };
  },

  // Gateways that belong to one brand. GatewayDropdown rows carry no brand and the API
  // ignores its BrandId filter, so the full /Gateway records (which include brandId) are
  // used and filtered exactly. Uses only explicitly matching brand IDs if an older API needs the dropdown route.
  async getBrandGateways(brandId, signal) {
    const id = Number(brandId) || 0;
    if (!id) return { data: [], totalCount: 0 };

    try {
      const result = unwrapList(
        await request('/Gateway', { params: pageParams({ BrandId: id, PageSize: 500, IsDescending: false }, 'gatewayId'), signal })
      );
      const data = result.data
        .map(normalizeGatewayOption)
        .filter((option) => Number(option.brandId ?? option.BrandId) === id && option.gatewayName)
        .map((option) => ({ ...option, brandId: id }));
      return { data, totalCount: data.length };
    } catch (error) {
      if (error?.name === 'AbortError' || ![404, 405].includes(error?.status)) throw error;
      const fallback = await this.getGatewayDropdown({ BrandId: id }, signal);
      const data = fallback.data.filter((option) => Number(option.brandId) === id);
      return { data, totalCount: data.length };
    }
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
    const rawBrandId = params.brandId ?? params.BrandId;
    const rawGatewayId = params.getwayId ?? params.gatewayId ?? params.GatewayId;
    const rawPaymentTypeId = params.paymentTypeId ?? params.PaymentTypeId;

    const queryParams = { ...params };
    if (rawBrandId !== undefined && rawBrandId !== null && rawBrandId !== '') {
      queryParams.brandId = Number(rawBrandId);
    }
    if (rawGatewayId !== undefined && rawGatewayId !== null && rawGatewayId !== '') {
      queryParams.getwayId = Number(rawGatewayId);
      queryParams.gatewayId = Number(rawGatewayId);
    }
    if (rawPaymentTypeId !== undefined && rawPaymentTypeId !== null && rawPaymentTypeId !== '') {
      queryParams.paymentTypeId = Number(rawPaymentTypeId);
    }
    if (queryParams.SortProperty === 'gatewayPaymentTypeId') {
      delete queryParams.SortProperty;
    }

    return unwrapList(await request('/GatewayPaymentType', { params: queryParams, signal }));
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
