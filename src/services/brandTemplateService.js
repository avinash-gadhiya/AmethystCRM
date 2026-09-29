import apiClient from './core/apiClient';

const listCache = new Map();
const referenceCache = new Map();
const inFlightRequests = new Map();
let listGeneration = 0;

const normalizeBoolean = (value, fallback = true) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'string') return value.trim().toLowerCase() === 'true';
  return Boolean(value);
};

const unwrapList = (payload) => {
  if (Array.isArray(payload)) return { data: payload, totalCount: payload.length };
  if (Array.isArray(payload?.data)) {
    return {
      data: payload.data,
      totalCount: Number(payload.totalCount ?? payload.totalRecords ?? payload.count ?? payload.data.length)
    };
  }
  if (Array.isArray(payload?.data?.data)) {
    return {
      data: payload.data.data,
      totalCount: Number(payload.data.totalCount ?? payload.data.totalRecords ?? payload.data.count ?? payload.data.data.length)
    };
  }
  if (Array.isArray(payload?.items)) {
    return {
      data: payload.items,
      totalCount: Number(payload.totalCount ?? payload.totalRecords ?? payload.count ?? payload.items.length)
    };
  }
  return { data: [], totalCount: 0 };
};

const normalizeTemplate = (item) => ({
  brandEmailTemplateId: Number(item?.brandEmailTemplateId ?? item?.id ?? 0),
  templateId: Number(item?.templateId ?? 0),
  saleTypeId: Number(item?.saleTypeId ?? 0),
  brandId: Number(item?.brandId ?? 0),
  brandName: String(item?.brandName ?? '').trim(),
  fromEmailId: Number(item?.fromEmailId ?? item?.brandEmailId ?? 0),
  fromEmail: String(item?.fromEmail ?? item?.email ?? '').trim(),
  ccEmail: String(item?.ccEmail ?? '').trim(),
  bccEmail: String(item?.bccEmail ?? '').trim(),
  templateName: String(item?.templateName ?? '').trim(),
  subject: String(item?.subject ?? '').trim(),
  isActive: normalizeBoolean(item?.isActive)
});

const templatePayload = (data, isCreate = false) => ({
  brandEmailTemplateId: isCreate ? 0 : Number(data.brandEmailTemplateId),
  templateName: String(data.templateName ?? '').trim(),
  templateId: Number(data.templateId),
  saleTypeId: Number(data.saleTypeId || 0),
  brandId: Number(data.brandId),
  fromEmailId: Number(data.fromEmailId),
  ccEmail: String(data.ccEmail ?? '').trim(),
  bccEmail: String(data.bccEmail ?? '').trim(),
  subject: String(data.subject ?? '').trim(),
  isActive: Boolean(data.isActive)
});

const cachedReferenceRequest = async (key, loader, forceFresh = false) => {
  if (!forceFresh && referenceCache.has(key)) return referenceCache.get(key);
  if (!forceFresh && inFlightRequests.has(key)) return inFlightRequests.get(key);

  const request = loader().then((result) => {
    referenceCache.set(key, result);
    return result;
  });
  inFlightRequests.set(key, request);
  try {
    return await request;
  } finally {
    if (inFlightRequests.get(key) === request) inFlightRequests.delete(key);
  }
};

const clearTemplateCache = () => {
  listGeneration += 1;
  listCache.clear();
};

export const brandTemplateService = {
  async getBrandTemplates(params = {}, forceFresh = false) {
    const queryParams = {
      Text: String(params.Text ?? '').trim(),
      PageNumber: Number(params.PageNumber) || 1,
      PageSize: Number(params.PageSize) || 10,
      SortProperty: params.SortProperty || 'brandEmailTemplateId',
      IsDescending: params.IsDescending ?? true
    };
    const brandId = Number(params.BrandId ?? params.brandId);
    if (Number.isFinite(brandId) && brandId > 0) queryParams.BrandId = brandId;

    const cacheKey = JSON.stringify(queryParams);
    if (!forceFresh && listCache.has(cacheKey)) return listCache.get(cacheKey);

    const requestKey = `brand-templates:${listGeneration}:${cacheKey}`;
    if (inFlightRequests.has(requestKey)) return inFlightRequests.get(requestKey);

    const requestGeneration = listGeneration;
    const request = apiClient.get('/BrandEmailTemplates', queryParams).then((response) => {
      const parsed = unwrapList(response);
      const result = {
        data: parsed.data.map(normalizeTemplate).filter((item) => item.brandEmailTemplateId > 0),
        totalCount: Number.isFinite(parsed.totalCount) ? parsed.totalCount : parsed.data.length
      };
      if (requestGeneration === listGeneration) listCache.set(cacheKey, result);
      return result;
    });

    inFlightRequests.set(requestKey, request);
    try {
      return await request;
    } finally {
      if (inFlightRequests.get(requestKey) === request) inFlightRequests.delete(requestKey);
    }
  },

  async getBrands(forceFresh = false) {
    return cachedReferenceRequest(
      'brand-template:brands',
      async () => {
        const response = await apiClient.get('/Brand', { PageNumber: 1, PageSize: 500 });
        return unwrapList(response)
          .data.map((item) => ({
            brandId: Number(item?.brandId ?? item?.id ?? 0),
            brandName: String(item?.brandName ?? item?.name ?? '').trim()
          }))
          .filter((item) => item.brandId > 0);
      },
      forceFresh
    );
  },

  async getBrandEmails(brandId, forceFresh = false) {
    const id = Number(brandId);
    if (!Number.isFinite(id) || id <= 0) return [];

    const key = `brand-template:emails:${id}`;
    return cachedReferenceRequest(
      key,
      async () => {
        const response = await apiClient.get('/BrandEmail', {
          PageNumber: 1,
          PageSize: 500,
          BrandId: id
        });
        return unwrapList(response)
          .data.map((item) => ({
            brandEmailId: Number(item?.brandEmailId ?? item?.id ?? 0),
            brandId: Number(item?.brandId ?? 0),
            email: String(item?.email ?? '').trim(),
            brandName: String(item?.brandName ?? '').trim(),
            isActive: normalizeBoolean(item?.isActive)
          }))
          .filter((item) => item.brandEmailId > 0 && item.brandId === id);
      },
      forceFresh
    );
  },

  async getMasterTemplates(forceFresh = false) {
    return cachedReferenceRequest(
      'brand-template:master-templates',
      async () => {
        const response = await apiClient.get('/Template', {
          PageNumber: 1,
          PageSize: 1000,
          IsDescending: false
        });
        return unwrapList(response)
          .data.map((item) => ({
            templateId: Number(item?.templateId ?? item?.id ?? 0),
            templateName: String(item?.templateName ?? item?.name ?? '').trim()
          }))
          .filter((item) => item.templateId > 0);
      },
      forceFresh
    );
  },

  async getSaleTypes(forceFresh = false) {
    return cachedReferenceRequest(
      'brand-template:sale-types',
      async () => {
        const response = await apiClient.get('/SettingValue/SettingValueDropDown', { settingKey: 'SaleTypes' });
        return unwrapList(response)
          .data.filter((item) => normalizeBoolean(item?.isActive, true))
          .map((item) => ({
            id: Number(item?.settingValueId ?? item?.id ?? item?.valueId ?? 0),
            name: String(item?.settingValueText ?? item?.name ?? item?.text ?? '').trim()
          }))
          .filter((item) => item.id > 0 && item.name);
      },
      forceFresh
    );
  },

  async createBrandTemplate(data) {
    const response = await apiClient.post('/BrandEmailTemplates', templatePayload(data, true));
    clearTemplateCache();
    return response;
  },

  async updateBrandTemplate(data) {
    const response = await apiClient.put('/BrandEmailTemplates', templatePayload(data));
    clearTemplateCache();
    return response;
  },

  async deleteBrandTemplate(brandEmailTemplateId) {
    const id = Number(brandEmailTemplateId);
    if (!Number.isFinite(id) || id <= 0) throw new Error('A valid Brand Template ID is required.');
    const response = await apiClient.delete('/BrandEmailTemplates', { id });
    clearTemplateCache();
    return response;
  },

  clearTemplateCache,

  clearReferenceCache() {
    referenceCache.clear();
  }
};

export default brandTemplateService;
