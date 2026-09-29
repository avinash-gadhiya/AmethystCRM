import axios from 'axios';
import { deleteById, getAuthHeaders } from './http';
import apiClient from './core/apiClient';

const getApiBaseUrl = () => {
  return (import.meta.env.VITE_APP_API_URL || 'https://demoapi.enstasol.com/api').replace(/\/$/, '');
};

// In-flight deduplication and cache maps
const inFlightRequests = new Map();
const cacheMap = new Map();
let brandEmailCacheGeneration = 0;

const normalizeBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return Boolean(value);
};

// Helper to normalize lists from varying API response structures
const unwrapList = (payload) => {
  if (!payload) return { data: [], totalCount: 0 };
  let list = [];
  let total = 0;

  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    list = Array.isArray(payload.data.data) ? payload.data.data : [];
    total =
      payload.data.totalCount ??
      payload.data.totalRecords ??
      payload.data.count ??
      list.length;
  } else if (Array.isArray(payload.data)) {
    list = payload.data;
    total =
      payload.totalCount ??
      payload.totalRecords ??
      payload.count ??
      list.length;
  } else if (Array.isArray(payload)) {
    list = payload;
    total = payload.length;
  }

  return { data: list, totalCount: Number(total) || list.length };
};

// Image resize utility for logos to keep raster images compact
const resizeImageToDataUrl = (file, maxWidth = 300, maxHeight = 300) => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('Please select an image file.'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image for resizing.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Export as WebP if supported, fallback to PNG or JPEG
        let dataUrl = '';
        try {
          dataUrl = canvas.toDataURL('image/webp', 0.85);
        } catch {
          dataUrl = canvas.toDataURL('image/png');
        }
        resolve(dataUrl);
      };
      img.src = readerEvent.target.result;
    };
    reader.readAsDataURL(file);
  });
};

export const brandService = {
  // =========================================================================
  // Brand CRUD
  // =========================================================================
  async getBrands(params = {}) {
    const API_URL = getApiBaseUrl();
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

    const requestPromise = (async () => {
      try {
        const response = await axios.get(`${API_URL}/Brand`, {
          headers: getAuthHeaders(),
          params: queryParams
        });
        const parsed = unwrapList(response.data);
        const result = {
          data: parsed.data.map((b) => ({
            brandId: Number(b.brandId ?? b.id ?? 0),
            brandName: String(b.brandName ?? b.name ?? '').trim(),
            brandDisplayName: String(b.brandDisplayName ?? b.displayName ?? '').trim(),
            isActive: Boolean(b.isActive ?? b.status ?? true),
            docAPIKey: String(b.docAPIKey ?? b.docApiKey ?? '').trim(),
            docTemplateId: String(b.docTemplateId ?? '').trim(),
            docRole: String(b.docRole ?? '').trim(),
            isDocAPILive: Boolean(b.isDocAPILive ?? b.isDocApiLive ?? false),
            address: String(b.address ?? '').trim(),
            supportEmail: String(b.supportEmail ?? '').trim(),
            tollfree: String(b.tollfree ?? b.tollFree ?? '').trim(),
            altTollFree: String(b.altTollFree ?? b.altTollfree ?? '').trim(),
            logoUrl: String(b.logoUrl ?? b.logo ?? '').trim(),
            refundPolicyUrl: String(b.refundPolicyUrl ?? '').trim()
          })),
          totalCount: parsed.totalCount
        };
        cacheMap.set(cacheKey, result);
        return result;
      } finally {
        inFlightRequests.delete(cacheKey);
      }
    })();

    inFlightRequests.set(cacheKey, requestPromise);
    return requestPromise;
  },

  async getBrandById(brandId) {
    if (!brandId) return null;
    const API_URL = getApiBaseUrl();
    try {
      const response = await axios.get(`${API_URL}/Brand/${brandId}`, {
        headers: getAuthHeaders()
      });
      const data = response.data?.data || response.data;
      if (data && data.brandId) return data;
    } catch {
      // Fallback: search in list
    }
    const listRes = await this.getBrands({ PageNumber: 1, PageSize: 500 });
    return listRes.data.find((b) => b.brandId === Number(brandId)) || null;
  },

  async createBrand(brandData) {
    const API_URL = getApiBaseUrl();
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

    const response = await axios.post(`${API_URL}/Brand`, payload, {
      headers: getAuthHeaders()
    });
    this.clearBrandCache();
    return response.data;
  },

  async updateBrand(brandData) {
    const API_URL = getApiBaseUrl();
    const payload = {
      brandId: Number(brandData.brandId),
      brandName: String(brandData.brandName || '').trim(),
      brandDisplayName: String(brandData.brandDisplayName || '').trim(),
      isActive: Boolean(brandData.isActive),
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

    const response = await axios.put(`${API_URL}/Brand`, payload, {
      headers: getAuthHeaders()
    });
    this.clearBrandCache();
    return response.data;
  },

  async deleteBrand(brandId) {
    const API_URL = getApiBaseUrl();
    this.clearBrandCache();
    // Dual strategy: DELETE /Brand?id={brandId}, fallback /Brand/{brandId}
    try {
      const response = await axios.delete(`${API_URL}/Brand`, {
        headers: getAuthHeaders(),
        params: { id: brandId }
      });
      return response.data;
    } catch (error) {
      if (error?.response?.status === 404 || error?.response?.status === 405) {
        const fallbackRes = await axios.delete(`${API_URL}/Brand/${brandId}`, {
          headers: getAuthHeaders()
        });
        return fallbackRes.data;
      }
      throw error;
    }
  },

  // Upload/Process Brand Logo
  async uploadLogo(file) {
    if (!file) throw new Error('No file provided.');
    const resizedDataUrl = await resizeImageToDataUrl(file);

    // Try local upload endpoint if available
    try {
      const response = await axios.post(
        '/__local-upload/brand-logo',
        {
          fileName: file.name,
          dataUrl: resizedDataUrl
        },
        { headers: { 'Content-Type': 'application/json' } }
      );
      if (response.data?.url || response.data?.path) {
        return response.data.url || response.data.path;
      }
    } catch {
      // Endpoint not available; return resized dataUrl directly
    }

    return resizedDataUrl;
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
          totalCount: brandId && items.length !== parsed.data.length ? items.length : parsed.totalCount
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
    const id = Number(brandEmailId);
    if (!Number.isFinite(id) || id <= 0) throw new Error('A valid brand email ID is required.');

    let response;
    try {
      response = await apiClient.delete(`/BrandEmail/${encodeURIComponent(id)}`);
    } catch (error) {
      if (![400, 404, 405].includes(error?.status)) throw error;
      response = await apiClient.delete('/BrandEmail', { id });
    }
    this.clearBrandEmailCache();
    return response;
  },

  // =========================================================================
  // Gateway & Gateway Payment Types CRUD
  // =========================================================================
  async getGateways(params = {}) {
    const API_URL = getApiBaseUrl();
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

    const requestPromise = (async () => {
      try {
        const response = await axios.get(`${API_URL}/Gateway`, {
          headers: getAuthHeaders(),
          params: queryParams
        });
        const parsed = unwrapList(response.data);
        let items = parsed.data;
        if (brandId) {
          items = items.filter((g) => Number(g.brandId) === Number(brandId));
        }

        const result = {
          data: items.map((g) => ({
            gatewayId: Number(g.gatewayId ?? g.id ?? 0),
            gatewayName: String(g.gatewayName ?? g.name ?? '').trim(),
            brandId: Number(g.brandId ?? 0),
            brandName: String(g.brandName || '').trim(),
            isActive: Boolean(g.isActive ?? true),
            gatewayType: Number(g.gatewayType ?? 0),
            apiBaseUrl: g.apiBaseUrl ? String(g.apiBaseUrl).trim() : null,
            isSandbox: Boolean(g.isSandbox ?? false),
            lastSyncedAtUtc: g.lastSyncedAtUtc || null,
            hasCredentials: Boolean(g.hasCredentials ?? Boolean(g.apiLoginId || g.apiSecretKey)),
            apiLoginId: g.apiLoginId || '',
            apiSecretKey: g.apiSecretKey || '',
            merchantSiteId: g.merchantSiteId || ''
          })),
          totalCount: brandId ? items.length : parsed.totalCount
        };
        cacheMap.set(cacheKey, result);
        return result;
      } finally {
        inFlightRequests.delete(cacheKey);
      }
    })();

    inFlightRequests.set(cacheKey, requestPromise);
    return requestPromise;
  },

  async createGateway(data) {
    const API_URL = getApiBaseUrl();
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

    const response = await axios.post(`${API_URL}/Gateway`, payload, {
      headers: getAuthHeaders()
    });
    this.clearGatewayCache();
    return response.data;
  },

  async updateGateway(data) {
    const API_URL = getApiBaseUrl();
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
      payload.apiLoginId = data.apiLoginId || '';
      payload.apiSecretKey = data.apiSecretKey || '';
      payload.merchantSiteId = data.merchantSiteId || '';
      payload.hasCredentials = Boolean(payload.apiLoginId && payload.apiSecretKey);
    }

    const response = await axios.put(`${API_URL}/Gateway`, payload, {
      headers: getAuthHeaders()
    });
    this.clearGatewayCache();
    return response.data;
  },

  async deleteGateway(gatewayId) {
    const API_URL = getApiBaseUrl();
    this.clearGatewayCache();
    try {
      const response = await axios.delete(`${API_URL}/Gateway`, {
        headers: getAuthHeaders(),
        params: { id: gatewayId }
      });
      return response.data;
    } catch (error) {
      if (error?.response?.status === 404 || error?.response?.status === 405) {
        const fallbackRes = await axios.delete(`${API_URL}/Gateway/${gatewayId}`, {
          headers: getAuthHeaders()
        });
        return fallbackRes.data;
      }
      throw error;
    }
  },

  // Gateway Payment Types
  async getGatewayPaymentTypes(params = {}) {
    const API_URL = getApiBaseUrl();
    const response = await axios.get(`${API_URL}/GatewayPaymentType`, {
      headers: getAuthHeaders(),
      params
    });
    return unwrapList(response.data);
  },

  async saveGatewayPaymentTypes(data) {
    const API_URL = getApiBaseUrl();
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
      response = await axios.put(`${API_URL}/GatewayPaymentType`, payload, {
        headers: getAuthHeaders()
      });
    } else {
      response = await axios.post(`${API_URL}/GatewayPaymentType`, payload, {
        headers: getAuthHeaders()
      });
    }
    this.clearGatewayCache();
    return response.data;
  },

  async deleteGatewayPaymentType(mapping) {
    const API_URL = getApiBaseUrl();
    this.clearGatewayCache();

    if (mapping.gatewayPaymentTypeId) {
      return deleteById(`${API_URL}/GatewayPaymentType`, mapping.gatewayPaymentTypeId);
    }

    // Fallback: DELETE /GatewayPaymentType?gatewayId={gatewayId}&paymentTypeId={paymentTypeId}
    const attempts = [
      { gatewayId: mapping.gatewayId, paymentTypeId: mapping.paymentTypeId },
      { getwayId: mapping.gatewayId, paymentTypeId: mapping.paymentTypeId }
    ];

    let lastError;
    for (const params of attempts) {
      try {
        const res = await axios.delete(`${API_URL}/GatewayPaymentType`, {
          headers: getAuthHeaders(),
          params
        });
        return res.data;
      } catch (err) {
        lastError = err;
        if (![400, 404, 405].includes(err?.response?.status)) throw err;
      }
    }
    throw lastError;
  },

  // =========================================================================
  // Brand Email Templates CRUD
  // =========================================================================
  async getBrandEmailTemplates(params = {}) {
    const API_URL = getApiBaseUrl();
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

    const requestPromise = (async () => {
      try {
        const response = await axios.get(`${API_URL}/BrandEmailTemplates`, {
          headers: getAuthHeaders(),
          params: queryParams
        });
        const parsed = unwrapList(response.data);
        let items = parsed.data;
        if (brandId) {
          items = items.filter((t) => Number(t.brandId) === Number(brandId));
        }

        const result = {
          data: items.map((t) => ({
            brandEmailTemplateId: Number(t.brandEmailTemplateId ?? t.id ?? 0),
            templateId: Number(t.templateId ?? 0),
            saleTypeId: Number(t.saleTypeId ?? 0),
            brandId: Number(t.brandId ?? 0),
            brandName: String(t.brandName || '').trim(),
            fromEmailId: Number(t.fromEmailId ?? 0),
            fromEmail: t.fromEmail || '',
            ccEmail: String(t.ccEmail || '').trim(),
            bccEmail: String(t.bccEmail || '').trim(),
            templateName: String(t.templateName || '').trim(),
            subject: String(t.subject || '').trim(),
            isActive: Boolean(t.isActive ?? true)
          })),
          totalCount: brandId ? items.length : parsed.totalCount
        };
        cacheMap.set(cacheKey, result);
        return result;
      } finally {
        inFlightRequests.delete(cacheKey);
      }
    })();

    inFlightRequests.set(cacheKey, requestPromise);
    return requestPromise;
  },

  async createBrandEmailTemplate(data) {
    const API_URL = getApiBaseUrl();
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

    const response = await axios.post(`${API_URL}/BrandEmailTemplates`, payload, {
      headers: getAuthHeaders()
    });
    this.clearTemplateCache();
    return response.data;
  },

  async updateBrandEmailTemplate(data) {
    const API_URL = getApiBaseUrl();
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

    const response = await axios.put(`${API_URL}/BrandEmailTemplates`, payload, {
      headers: getAuthHeaders()
    });
    this.clearTemplateCache();
    return response.data;
  },

  async deleteBrandEmailTemplate(templateId) {
    const API_URL = getApiBaseUrl();
    this.clearTemplateCache();
    try {
      const response = await axios.delete(`${API_URL}/BrandEmailTemplates`, {
        headers: getAuthHeaders(),
        params: { id: templateId }
      });
      return response.data;
    } catch (error) {
      if (error?.response?.status === 404 || error?.response?.status === 405) {
        const fallbackRes = await axios.delete(`${API_URL}/BrandEmailTemplates/${templateId}`, {
          headers: getAuthHeaders()
        });
        return fallbackRes.data;
      }
      throw error;
    }
  },

  // =========================================================================
  // Reference Data (Master Templates, Sale Types, Payment Types)
  // =========================================================================
  async getMasterTemplates() {
    const API_URL = getApiBaseUrl();
    const cacheKey = 'masterTemplates';
    if (cacheMap.has(cacheKey)) return cacheMap.get(cacheKey);

    try {
      const response = await axios.get(`${API_URL}/Template`, {
        headers: getAuthHeaders(),
        params: { PageNumber: 1, PageSize: 1000 }
      });
      const parsed = unwrapList(response.data);
      const list = parsed.data.map((t) => ({
        templateId: Number(t.templateId ?? t.id ?? 0),
        templateName: String(t.templateName ?? t.name ?? `Template #${t.templateId}`).trim(),
        subject: String(t.subject || '').trim(),
        isActive: Boolean(t.isActive ?? true)
      }));
      cacheMap.set(cacheKey, list);
      return list;
    } catch (e) {
      console.warn('Failed to load master templates:', e);
      return [];
    }
  },

  async getSaleTypes() {
    const API_URL = getApiBaseUrl();
    const cacheKey = 'saleTypes';
    if (cacheMap.has(cacheKey)) return cacheMap.get(cacheKey);

    try {
      const response = await axios.get(`${API_URL}/SaleType`, {
        headers: getAuthHeaders(),
        params: { PageNumber: 1, PageSize: 1000 }
      });
      const parsed = unwrapList(response.data);
      if (parsed.data.length > 0) {
        const list = parsed.data.map((s) => ({
          saleTypeId: Number(s.saleTypeId ?? s.id ?? 0),
          saleTypeName: String(s.saleTypeName ?? s.name ?? '').trim()
        }));
        cacheMap.set(cacheKey, list);
        return list;
      }
    } catch {}

    // Fallback options
    const defaults = [
      { saleTypeId: 1, saleTypeName: 'Sale' },
      { saleTypeId: 2, saleTypeName: 'Renewal' },
      { saleTypeId: 3, saleTypeName: 'Upsell' },
      { saleTypeId: 4, saleTypeName: 'Recurring' }
    ];
    cacheMap.set(cacheKey, defaults);
    return defaults;
  },

  async getPaymentTypes() {
    const API_URL = getApiBaseUrl();
    const cacheKey = 'paymentTypes';
    if (cacheMap.has(cacheKey)) return cacheMap.get(cacheKey);

    try {
      const response = await axios.get(`${API_URL}/PaymentType`, {
        headers: getAuthHeaders(),
        params: { PageNumber: 1, PageSize: 1000 }
      });
      const parsed = unwrapList(response.data);
      if (parsed.data.length > 0) {
        const list = parsed.data.map((p) => ({
          paymentTypeId: Number(p.paymentTypeId ?? p.id ?? 0),
          paymentTypeName: String(p.paymentTypeName ?? p.name ?? '').trim()
        }));
        cacheMap.set(cacheKey, list);
        return list;
      }
    } catch {}

    // Fallback payment types
    const defaults = [
      { paymentTypeId: 1, paymentTypeName: 'Card' },
      { paymentTypeId: 2, paymentTypeName: 'Cheque' },
      { paymentTypeId: 3, paymentTypeName: 'Zelle' },
      { paymentTypeId: 4, paymentTypeName: 'PayPal' },
      { paymentTypeId: 5, paymentTypeName: 'Bank Transfer' }
    ];
    cacheMap.set(cacheKey, defaults);
    return defaults;
  },

  // Cache clearance
  clearBrandCache() {
    for (const key of cacheMap.keys()) {
      if (key.startsWith('brands:')) cacheMap.delete(key);
    }
  },
  clearBrandEmailCache() {
    brandEmailCacheGeneration += 1;
    for (const key of cacheMap.keys()) {
      if (key.startsWith('brandEmails:')) cacheMap.delete(key);
    }
  },
  clearGatewayCache() {
    for (const key of cacheMap.keys()) {
      if (key.startsWith('gateways:')) cacheMap.delete(key);
    }
  },
  clearTemplateCache() {
    for (const key of cacheMap.keys()) {
      if (key.startsWith('brandTemplates:')) cacheMap.delete(key);
    }
  },
  clearAllCache() {
    cacheMap.clear();
  }
};

export default brandService;
