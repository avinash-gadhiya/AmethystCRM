import { resizeImageToDataUrl } from './brandLogoAdapter';
import apiClient from './core/apiClient';

// In-flight deduplication and cache maps
const inFlightRequests = new Map();
const cacheMap = new Map();
let brandEmailCacheGeneration = 0;
const normalizeFields = (value) => {
  if (Array.isArray(value)) return value.map(normalizeFields);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key[0].toLowerCase() + key.slice(1), normalizeFields(item)]));
};
const invalidate = () => {
  brandEmailCacheGeneration += 1;
  cacheMap.clear();
  inFlightRequests.clear();
};
const cachedReference = (key, loader) => {
  if (cacheMap.has(key)) return Promise.resolve(cacheMap.get(key));
  if (inFlightRequests.has(key)) return inFlightRequests.get(key);
  const generation = brandEmailCacheGeneration;
  const request = loader()
    .then((data) => {
      if (generation === brandEmailCacheGeneration) cacheMap.set(key, data);
      return data;
    })
    .finally(() => {
      if (inFlightRequests.get(key) === request) inFlightRequests.delete(key);
    });
  inFlightRequests.set(key, request);
  return request;
};

const normalizeBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return Boolean(value);
};

// Helper to normalize lists from varying API response structures
const unwrapList = (payload) => {
  payload = normalizeFields(payload);
  if (!payload) return { success: true, data: [], totalCount: 0 };
  let list = [];
  let total = 0;

  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    list = Array.isArray(payload.data.data) ? payload.data.data : [];
    total = payload.data.totalCount ?? payload.data.totalRecords ?? payload.data.count ?? list.length;
  } else if (Array.isArray(payload.data)) {
    list = payload.data;
    total = payload.totalCount ?? payload.totalRecords ?? payload.count ?? list.length;
  } else if (Array.isArray(payload)) {
    list = payload;
    total = payload.length;
  }

  return { success: payload.success !== false, data: list, totalCount: Number(total) };
};

export const brandService = {
  // =========================================================================
  // Brand CRUD
  // =========================================================================
  async getBrands(params = {}) {
    const queryParams = {
      Text: params.Text || '',
      PageNumber: params.PageNumber || 1,
      PageSize: params.PageSize || 10,
      SortProperty: params.SortProperty || 'brandId',
      IsDescending: params.IsDescending ?? true
    };

    const cacheKey = `brands:${JSON.stringify(queryParams)}`;
    if (cacheMap.has(cacheKey)) {
      return cacheMap.get(cacheKey);
    }
    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey);
    }

    const cacheGeneration = brandEmailCacheGeneration;
    const requestPromise = (async () => {
      try {
        const response = await apiClient.get('/Brand', queryParams);
        const parsed = unwrapList(response);
        const result = {
          success: true,
          data: parsed.data.map((b) => ({
            brandId: Number(b.brandId ?? b.id ?? 0),
            brandName: String(b.brandName ?? b.name ?? ''),
            brandDisplayName: String(b.brandDisplayName ?? b.displayName ?? ''),
            isActive: normalizeBoolean(b.isActive ?? b.status, true),
            docAPIKey: String(b.docAPIKey ?? b.docApiKey ?? ''),
            docTemplateId: String(b.docTemplateId ?? ''),
            docRole: String(b.docRole ?? ''),
            isDocAPILive: normalizeBoolean(b.isDocAPILive ?? b.isDocApiLive),
            address: String(b.address ?? ''),
            supportEmail: String(b.supportEmail ?? ''),
            tollfree: String(b.tollfree ?? b.tollFree ?? ''),
            altTollFree: String(b.altTollFree ?? b.altTollfree ?? ''),
            logoUrl: String(b.logoUrl ?? b.logo ?? ''),
            refundPolicyUrl: String(b.refundPolicyUrl ?? '')
          })),
          totalCount: parsed.totalCount
        };
        if (cacheGeneration === brandEmailCacheGeneration) cacheMap.set(cacheKey, result);
        return result;
      } finally {
        if (cacheGeneration === brandEmailCacheGeneration) inFlightRequests.delete(cacheKey);
      }
    })();

    inFlightRequests.set(cacheKey, requestPromise);
    return requestPromise;
  },

  async getBrandById(brandId) {
    if (!brandId) return null;
    let page = 1;
    let result;
    do {
      result = await this.getBrands({ PageNumber: page, PageSize: 100 });
      const brand = result.data.find((item) => item.brandId === Number(brandId));
      if (brand) return brand;
      page += 1;
    } while (result.data.length && (page - 1) * 100 < result.totalCount);
    return null;
  },

  async createBrand(brandData) {
    const payload = {
      brandId: 0,
      brandName: String(brandData.brandName || '').trim(),
      brandDisplayName: String(brandData.brandDisplayName || '').trim(),
      isActive: Boolean(brandData.isActive ?? true),
      docAPIKey: String(brandData.docAPIKey || '').trim(),
      docTemplateId: String(brandData.docTemplateId || '').trim(),
      docRole: String(brandData.docRole || '').trim(),
      isDocAPILive: Boolean(brandData.isDocAPILive ?? false),
      address: String(brandData.address || '').trim(),
      supportEmail: String(brandData.supportEmail || '').trim(),
      tollfree: String(brandData.tollfree || '').trim(),
      altTollFree: String(brandData.altTollFree || '').trim(),
      logoUrl: String(brandData.logoUrl || '').trim(),
      refundPolicyUrl: String(brandData.refundPolicyUrl || '').trim()
    };

    const response = await apiClient.post('/Brand', payload);
    this.clearBrandCache();
    return response;
  },

  async updateBrand(brandData) {
    const payload = {
      brandId: Number(brandData.brandId),
      brandName: String(brandData.brandName || ''),
      brandDisplayName: String(brandData.brandDisplayName || ''),
      isActive: Boolean(brandData.isActive),
      docAPIKey: String(brandData.docAPIKey || ''),
      docTemplateId: String(brandData.docTemplateId || ''),
      docRole: String(brandData.docRole || ''),
      isDocAPILive: Boolean(brandData.isDocAPILive ?? false),
      address: String(brandData.address || ''),
      supportEmail: String(brandData.supportEmail || ''),
      tollfree: String(brandData.tollfree || ''),
      altTollFree: String(brandData.altTollFree || ''),
      logoUrl: String(brandData.logoUrl || ''),
      refundPolicyUrl: String(brandData.refundPolicyUrl || '')
    };

    const response = await apiClient.put('/Brand', payload);
    this.clearBrandCache();
    return response;
  },

  async deleteBrand(brandId) {
    const response = await apiClient.delete(`/Brand`, { id: brandId });
    this.clearAllCache();
    return response;
  },

  // Upload/Process Brand Logo
  async uploadLogo(file) {
    if (!file) throw new Error('No file provided.');
    return resizeImageToDataUrl(file);
  },

  // =========================================================================
  // Brand Email CRUD
  // =========================================================================
  async getBrandEmails(params = {}, _signal, forceFresh = false) {
    const brandId = params.BrandId || params.brandId;
    const queryParams = {
      Text: params.Text || '',
      PageNumber: params.PageNumber || 1,
      PageSize: params.PageSize || 10,
      SortProperty: params.SortProperty || 'brandEmailId',
      IsDescending: params.IsDescending ?? true
    };
    if (brandId) {
      queryParams.BrandId = Number(brandId);
    }

    const cacheKey = `brandEmails:${JSON.stringify(queryParams)}`;
    if (!forceFresh && cacheMap.has(cacheKey)) {
      return cacheMap.get(cacheKey);
    }
    const requestKey = `${brandEmailCacheGeneration}:${cacheKey}`;
    if (inFlightRequests.has(requestKey)) {
      return inFlightRequests.get(requestKey);
    }

    const requestGeneration = brandEmailCacheGeneration;
    const requestPromise = (async () => {
      try {
        const response = await apiClient.get('/BrandEmail', queryParams);
        const parsed = unwrapList(response);

        // Filter client-side by BrandId if specified (API may return extra records)
        let items = parsed.data;
        if (brandId) {
          items = items.filter((item) => Number(item.brandId) === Number(brandId));
        }

        const result = {
          success: true,
          data: items.map((e) => ({
            brandEmailId: Number(e.brandEmailId ?? e.id ?? 0),
            brandId: Number(e.brandId ?? 0),
            brandName: String(e.brandName || '').trim(),
            email: String(e.email || '').trim(),
            userName: String(e.userName || '').trim(),
            host: String(e.host || '').trim(),
            sslEnable: normalizeBoolean(e.sslEnable ?? e.sslEnabled),
            port: Number(e.port ?? 587),
            password: e.password ?? e.Password ?? e.passWord ?? e.PassWord ?? e.PASSWORD ?? '',
            isActive: normalizeBoolean(e.isActive, true)
          })),
          totalCount: parsed.totalCount
        };
        if (requestGeneration === brandEmailCacheGeneration) cacheMap.set(cacheKey, result);
        return result;
      } finally {
        inFlightRequests.delete(requestKey);
      }
    })();

    inFlightRequests.set(requestKey, requestPromise);
    return requestPromise;
  },

  async createBrandEmail(data) {
    const payload = {
      brandEmailId: 0,
      brandId: Number(data.brandId),
      brandName: String(data.brandName || '').trim(),
      email: String(data.email || '').trim(),
      userName: String(data.userName || '').trim(),
      host: String(data.host || '').trim(),
      sslEnable: Boolean(data.sslEnable),
      port: Number(data.port || 587),
      password: String(data.password || ''),
      isActive: Boolean(data.isActive ?? true)
    };

    const response = await apiClient.post('/BrandEmail', payload);
    this.clearBrandEmailCache();
    return response;
  },

  async updateBrandEmail(data) {
    const payload = {
      brandEmailId: Number(data.brandEmailId),
      brandId: Number(data.brandId),
      brandName: String(data.brandName || '').trim(),
      email: String(data.email || '').trim(),
      userName: String(data.userName || '').trim(),
      host: String(data.host || '').trim(),
      sslEnable: Boolean(data.sslEnable),
      port: Number(data.port || 587),
      isActive: Boolean(data.isActive)
    };
    // Only send password if user intentionally entered a new password
    if (data.password && String(data.password).trim()) {
      payload.password = data.password;
    }

    const response = await apiClient.put('/BrandEmail', payload);
    this.clearBrandEmailCache();
    return response;
  },

  async deleteBrandEmail(brandEmailId) {
    const response = await apiClient.delete(`/BrandEmail/${brandEmailId}`);
    this.clearAllCache();
    return response;
  },

  // =========================================================================
  // Gateway & Gateway Payment Types CRUD
  // =========================================================================
  async getGateways(params = {}) {
    const brandId = params.BrandId || params.brandId;
    const queryParams = {
      Text: params.Text || '',
      PageNumber: params.PageNumber || 1,
      PageSize: params.PageSize || 10,
      SortProperty: params.SortProperty || 'gatewayId',
      IsDescending: params.IsDescending ?? true
    };
    if (brandId) {
      queryParams.BrandId = Number(brandId);
    }

    const cacheKey = `gateways:${JSON.stringify(queryParams)}`;
    if (cacheMap.has(cacheKey)) {
      return cacheMap.get(cacheKey);
    }
    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey);
    }

    const cacheGeneration = brandEmailCacheGeneration;
    const requestPromise = (async () => {
      try {
        const response = await apiClient.get('/Gateway', queryParams);
        const parsed = unwrapList(response);
        let items = parsed.data;
        if (brandId) {
          items = items.filter((g) => Number(g.brandId) === Number(brandId));
        }

        const result = {
          success: true,
          data: items.map((g) => ({
            gatewayId: Number(g.gatewayId ?? g.id ?? 0),
            gatewayName: String(g.gatewayName ?? g.name ?? '').trim(),
            brandId: Number(g.brandId ?? 0),
            brandName: String(g.brandName || '').trim(),
            isActive: normalizeBoolean(g.isActive, true),
            gatewayType: Number(g.gatewayType ?? 0),
            apiBaseUrl: g.apiBaseUrl ? String(g.apiBaseUrl).trim() : null,
            isSandbox: normalizeBoolean(g.isSandbox),
            lastSyncedAtUtc: g.lastSyncedAtUtc || null,
            hasCredentials: normalizeBoolean(g.hasCredentials, Boolean(g.apiLoginId || g.apiSecretKey)),
            apiLoginId: g.apiLoginId || '',
            apiSecretKey: g.apiSecretKey || '',
            merchantSiteId: g.merchantSiteId || ''
          })),
          totalCount: parsed.totalCount
        };
        if (cacheGeneration === brandEmailCacheGeneration) cacheMap.set(cacheKey, result);
        return result;
      } finally {
        if (cacheGeneration === brandEmailCacheGeneration) inFlightRequests.delete(cacheKey);
      }
    })();

    inFlightRequests.set(cacheKey, requestPromise);
    return requestPromise;
  },

  async createGateway(data) {
    const payload = {
      gatewayId: 0,
      gatewayName: String(data.gatewayName || '').trim(),
      brandId: Number(data.brandId),
      brandName: String(data.brandName || '').trim(),
      isActive: Boolean(data.isActive ?? true),
      gatewayType: Number(data.gatewayType || 0),
      apiBaseUrl: data.apiBaseUrl && String(data.apiBaseUrl).trim() ? String(data.apiBaseUrl).trim() : null,
      isSandbox: Boolean(data.isSandbox ?? false),
      lastSyncedAtUtc: data.lastSyncedAtUtc || null,
      hasCredentials: Boolean(data.hasCredentials)
    };
    if (data.apiLoginId) payload.apiLoginId = data.apiLoginId;
    if (data.apiSecretKey) payload.apiSecretKey = data.apiSecretKey;
    if (data.merchantSiteId) payload.merchantSiteId = data.merchantSiteId;

    const response = await apiClient.post('/Gateway', payload);
    this.clearGatewayCache();
    return response;
  },

  async updateGateway(data) {
    const payload = {
      gatewayId: Number(data.gatewayId),
      gatewayName: String(data.gatewayName || '').trim(),
      brandId: Number(data.brandId),
      brandName: String(data.brandName || '').trim(),
      isActive: Boolean(data.isActive),
      gatewayType: Number(data.gatewayType || 0),
      apiBaseUrl: data.apiBaseUrl && String(data.apiBaseUrl).trim() ? String(data.apiBaseUrl).trim() : null,
      isSandbox: Boolean(data.isSandbox ?? false),
      lastSyncedAtUtc: data.lastSyncedAtUtc || null,
      hasCredentials: Boolean(data.hasCredentials)
    };
    // Only send credentials when user explicitly chose to edit/regenerate them
    if (data.changeCredentials) {
      if (data.apiLoginId?.trim()) payload.apiLoginId = data.apiLoginId;
      if (data.apiSecretKey?.trim()) payload.apiSecretKey = data.apiSecretKey;
      if (data.merchantSiteId?.trim()) payload.merchantSiteId = data.merchantSiteId;
      payload.hasCredentials = Boolean(payload.apiLoginId && payload.apiSecretKey);
    }

    const response = await apiClient.put('/Gateway', payload);
    this.clearGatewayCache();
    return response;
  },

  async deleteGateway(gatewayId) {
    const response = await apiClient.delete(`/Gateway`, { id: gatewayId });
    this.clearAllCache();
    return response;
  },

  // Gateway Payment Types
  async getGatewayPaymentTypes(params = {}) {
    const response = await apiClient.get('/GatewayPaymentType', {
      Text: '',
      PageNumber: 1,
      PageSize: 1000,
      SortProperty: 'gatewayPaymentTypeId',
      IsDescending: false,
      ...params
    });
    return unwrapList(response);
  },

  async saveGatewayPaymentTypes(data) {
    const payload = {
      gatewayPaymentTypeId: Number(data.gatewayPaymentTypeId || 0),
      gatewayId: Number(data.gatewayId),
      brandId: Number(data.brandId),
      gatewayName: String(data.gatewayName || '').trim(),
      paymentTypeIds: Array.isArray(data.paymentTypeIds) ? data.paymentTypeIds.map(Number) : [],
      isActive: Boolean(data.isActive ?? true)
    };

    let response;
    if (payload.gatewayPaymentTypeId > 0) {
      response = await apiClient.put('/GatewayPaymentType', payload);
    } else {
      response = await apiClient.post('/GatewayPaymentType', payload);
    }
    this.clearGatewayCache();
    return response;
  },

  async deleteGatewayPaymentType(mapping) {
    const params = { gatewayId: mapping.gatewayId, paymentTypeId: mapping.paymentTypeId };
    const path = mapping.gatewayPaymentTypeId ? `/GatewayPaymentType/${mapping.gatewayPaymentTypeId}` : '/GatewayPaymentType';
    const response = await apiClient.delete(path, params);
    this.clearAllCache();
    return response;
  },

  // =========================================================================
  // Brand Email Templates CRUD
  // =========================================================================
  async getBrandEmailTemplates(params = {}) {
    const brandId = params.BrandId || params.brandId;
    const queryParams = {
      Text: params.Text || '',
      PageNumber: params.PageNumber || 1,
      PageSize: params.PageSize || 10,
      SortProperty: params.SortProperty || 'brandEmailTemplateId',
      IsDescending: params.IsDescending ?? true
    };
    if (brandId) {
      queryParams.BrandId = Number(brandId);
    }

    const cacheKey = `brandTemplates:${JSON.stringify(queryParams)}`;
    if (cacheMap.has(cacheKey)) {
      return cacheMap.get(cacheKey);
    }
    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey);
    }

    const cacheGeneration = brandEmailCacheGeneration;
    const requestPromise = (async () => {
      try {
        const response = await apiClient.get('/BrandEmailTemplates', queryParams);
        const parsed = unwrapList(response);
        let items = parsed.data;
        if (brandId) {
          items = items.filter((t) => Number(t.brandId) === Number(brandId));
        }

        const emailOptions = await this.getBrandEmailOptions(brandId);
        const result = {
          success: true,
          data: items.map((t) => ({
            brandEmailTemplateId: Number(t.brandEmailTemplateId ?? t.id ?? 0),
            templateId: Number(t.templateId ?? 0),
            saleTypeId: Number(t.saleTypeId ?? 0),
            brandId: Number(t.brandId ?? 0),
            brandName: String(t.brandName || '').trim(),
            fromEmailId: Number(t.fromEmailId ?? 0),
            fromEmail: t.fromEmail || emailOptions.find((e) => Number(e.brandEmailId) === Number(t.fromEmailId))?.email || '',
            ccEmail: String(t.ccEmail || '').trim(),
            bccEmail: String(t.bccEmail || '').trim(),
            templateName: String(t.templateName || '').trim(),
            subject: String(t.subject || '').trim(),
            isActive: normalizeBoolean(t.isActive, true)
          })),
          totalCount: parsed.totalCount
        };
        if (cacheGeneration === brandEmailCacheGeneration) cacheMap.set(cacheKey, result);
        return result;
      } finally {
        if (cacheGeneration === brandEmailCacheGeneration) inFlightRequests.delete(cacheKey);
      }
    })();

    inFlightRequests.set(cacheKey, requestPromise);
    return requestPromise;
  },

  async createBrandEmailTemplate(data) {
    const payload = {
      brandEmailTemplateId: 0,
      templateName: String(data.templateName || '').trim(),
      templateId: Number(data.templateId),
      saleTypeId: Number(data.saleTypeId || 0),
      brandId: Number(data.brandId),
      fromEmailId: Number(data.fromEmailId),
      ccEmail: String(data.ccEmail || '').trim(),
      bccEmail: String(data.bccEmail || '').trim(),
      subject: String(data.subject || '').trim(),
      isActive: Boolean(data.isActive ?? true)
    };

    const response = await apiClient.post('/BrandEmailTemplates', payload);
    this.clearTemplateCache();
    return response;
  },

  async updateBrandEmailTemplate(data) {
    const payload = {
      brandEmailTemplateId: Number(data.brandEmailTemplateId),
      templateName: String(data.templateName || '').trim(),
      templateId: Number(data.templateId),
      saleTypeId: Number(data.saleTypeId || 0),
      brandId: Number(data.brandId),
      fromEmailId: Number(data.fromEmailId),
      ccEmail: String(data.ccEmail || '').trim(),
      bccEmail: String(data.bccEmail || '').trim(),
      subject: String(data.subject || '').trim(),
      isActive: Boolean(data.isActive)
    };

    const response = await apiClient.put('/BrandEmailTemplates', payload);
    this.clearTemplateCache();
    return response;
  },

  async deleteBrandEmailTemplate(templateId) {
    const response = await apiClient.delete(`/BrandEmailTemplates`, { id: templateId });
    this.clearAllCache();
    return response;
  },

  // =========================================================================
  // Reference Data (Master Templates, Sale Types, Payment Types)
  // =========================================================================
  async getMasterTemplates() {
    return cachedReference('masterTemplates', async () =>
      (await this.getAllPages('/Template')).map((t) => ({
        ...t,
        templateId: Number(t.templateId ?? t.id),
        templateName: t.templateName ?? t.name ?? ''
      }))
    );
  },
  async getSaleTypes() {
    return cachedReference('saleTypes', async () =>
      unwrapList(await apiClient.get('/SettingValue/SettingValueDropDown', { settingKey: 'SaleTypes' })).data.map((s) => ({
        saleTypeId: Number(s.settingValueId ?? s.id ?? s.valueId),
        saleTypeName: s.settingValueText ?? s.name ?? s.text ?? ''
      }))
    );
  },
  async getPaymentTypes() {
    return cachedReference('paymentTypes', async () =>
      (await this.getAllPages('/PaymentType')).map((p) => ({
        paymentTypeId: Number(p.paymentTypeId ?? p.id),
        paymentTypeName: p.paymentTypeName ?? p.name ?? ''
      }))
    );
  },
  async getBrandDropdown() {
    return cachedReference('brandDropdown', async () =>
      unwrapList(await apiClient.get('/Brand/BrandDropDown')).data.map((b) => ({
        ...b,
        brandId: Number(b.brandId ?? b.id ?? b.value),
        brandName: b.brandName ?? b.name ?? b.text ?? b.label ?? ''
      }))
    );
  },
  async getAllPages(path, params = {}) {
    const rows = [];
    let result;
    let page = 1;
    do {
      result = unwrapList(
        await apiClient.get(path, {
          Text: '',
          SortProperty: path === '/Template' ? 'templateId' : path === '/PaymentType' ? 'paymentTypeId' : 'brandEmailId',
          IsDescending: false,
          ...params,
          PageNumber: page++,
          PageSize: 100
        })
      );
      rows.push(...result.data);
    } while (result.data.length && rows.length < result.totalCount);
    return rows;
  },
  async getBrandEmailOptions(brandId) {
    return cachedReference(`emailOptions:${brandId}`, () => this.getAllPages('/BrandEmail', { BrandId: brandId }));
  },
  clearBrandCache: invalidate,
  clearBrandEmailCache: invalidate,
  clearGatewayCache: invalidate,
  clearTemplateCache: invalidate,
  clearAllCache: invalidate
};

export default brandService;
