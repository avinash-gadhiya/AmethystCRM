import axios from 'axios';
import { deleteById, getAuthHeaders } from './http';

const getApiBaseUrl = () => {
  return (import.meta.env.VITE_APP_API_URL || 'https://demoapi.enstasol.com/api').replace(/\/$/, '');
};

// In-flight request deduplication map
const inFlightRequests = new Map();

/**
 * Read current user ID from local storage using keys: userId, id, userID
 */
export const getCurrentUserId = () => {
  const keys = ['userId', 'id', 'userID'];
  for (const key of keys) {
    try {
      const val = localStorage.getItem(key);
      const num = Number(val);
      if (num && num > 0) return num;
    } catch {}
  }

  try {
    const rawUser = localStorage.getItem('user');
    if (rawUser) {
      const u = JSON.parse(rawUser);
      const num = Number(u.userId || u.id || u.userID);
      if (num && num > 0) return num;
    }
  } catch {}

  return 1;
};

/**
 * Defensively normalize Template list response shapes
 */
const normalizeTemplateList = (payload) => {
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

  const normalized = list.map((item) => ({
    templateId: Number(item.templateId ?? item.id ?? 0),
    templateName: String(item.templateName ?? item.name ?? '').trim(),
    emailTypeId: Number(item.emailTypeId ?? item.typeId ?? 0),
    body: String(item.body ?? item.content ?? item.templateBody ?? ''),
    isActive: Boolean(item.isActive ?? item.status ?? true),
    createdById: Number(item.createdById ?? 0),
    updatedById: Number(item.updatedById ?? 0),
    createdDate: item.createdDate || '',
    updatedDate: item.updatedDate || ''
  }));

  return {
    data: normalized,
    totalCount: Number(total) || normalized.length
  };
};

const DEFAULT_PLACEHOLDERS = [
  '{{CustomerId}}',
  '{{CustomerName}}',
  '{{CustomerAddress}}',
  '{{CustomerEmail}}',
  '{{CustomerPhone}}',
  '{{OrderId}}',
  '{{OrderAmount}}',
  '{{DiscountAmount}}',
  '{{ProductAmount}}',
  '{{ProductName}}',
  '{{Amount}}',
  '{{RefundAmount}}',
  '{{Duration}}',
  '{{InvoiceDate}}',
  '{{BrandDisplayName}}',
  '{{BrandAddress}}',
  '{{SupportEmail}}',
  '{{RefundUrl}}',
  '{{TollFree}}',
  '{{AltTollFree}}'
];

export const templateService = {
  /**
   * GET /Template
   */
  async getTemplates(params = {}, signal) {
    const API_URL = getApiBaseUrl();
    const queryParams = {
      Text: params.Text || '',
      PageNumber: params.PageNumber || 1,
      PageSize: params.PageSize || 10,
      SortProperty: params.SortProperty || 'templateId',
      IsDescending: params.IsDescending ?? true
    };

    const cacheKey = `templates:${JSON.stringify(queryParams)}`;
    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey);
    }

    const requestPromise = (async () => {
      try {
        const response = await axios.get(`${API_URL}/Template`, {
          headers: getAuthHeaders(),
          params: queryParams,
          signal
        });
        return normalizeTemplateList(response.data);
      } finally {
        inFlightRequests.delete(cacheKey);
      }
    })();

    inFlightRequests.set(cacheKey, requestPromise);
    return requestPromise;
  },

  /**
   * GET /Template/{id}
   */
  async getTemplateById(templateId, signal) {
    const API_URL = getApiBaseUrl();
    const response = await axios.get(`${API_URL}/Template/${encodeURIComponent(templateId)}`, {
      headers: getAuthHeaders(),
      signal
    });
    return response.data?.data || response.data;
  },

  /**
   * POST /Template
   */
  async createTemplate(templateDTO) {
    const API_URL = getApiBaseUrl();
    const currentUserId = getCurrentUserId();
    const nowIso = new Date().toISOString();

    const payload = {
      templateId: 0,
      templateName: String(templateDTO.templateName || '').trim(),
      emailTypeId: Number(templateDTO.emailTypeId) || 0,
      body: String(templateDTO.body || ''),
      isActive: templateDTO.isActive !== false,
      createdById: currentUserId,
      updatedById: currentUserId,
      createdDate: nowIso,
      updatedDate: nowIso
    };

    const response = await axios.post(`${API_URL}/Template`, payload, {
      headers: getAuthHeaders()
    });

    return response.data;
  },

  /**
   * PUT /Template
   */
  async updateTemplate(templateDTO) {
    const API_URL = getApiBaseUrl();
    const currentUserId = getCurrentUserId();
    const nowIso = new Date().toISOString();

    const payload = {
      templateId: Number(templateDTO.templateId),
      templateName: String(templateDTO.templateName || '').trim(),
      emailTypeId: Number(templateDTO.emailTypeId) || 0,
      body: String(templateDTO.body || ''),
      isActive: Boolean(templateDTO.isActive),
      createdById: Number(templateDTO.createdById) || currentUserId,
      updatedById: currentUserId,
      createdDate: templateDTO.createdDate || nowIso,
      updatedDate: nowIso
    };

    const response = await axios.put(`${API_URL}/Template`, payload, {
      headers: getAuthHeaders()
    });

    return response.data;
  },

  /**
   * DELETE /Template?id={templateId}
   */
  async deleteTemplate(templateId) {
    const API_URL = getApiBaseUrl();
    const id = Number(templateId);

    const result = await deleteById(
      `${API_URL}/Template?id=${encodeURIComponent(id)}`,
      `${API_URL}/Template/${encodeURIComponent(id)}`
    );

    return result;
  },

  /**
   * Load email types: GET /SettingValue/SettingValueDropDown?settingKey=email_types
   */
  async getEmailTypes(signal) {
    const API_URL = getApiBaseUrl();
    try {
      const response = await axios.get(
        `${API_URL}/SettingValue/SettingValueDropDown?settingKey=email_types`,
        {
          headers: getAuthHeaders(),
          signal
        }
      );

      const raw = response.data?.data || response.data || [];
      const list = Array.isArray(raw) ? raw : [];

      return list
        .filter((item) => item && item.isActive !== false)
        .map((item) => ({
          id: Number(item.settingValueId ?? item.id ?? item.valueId ?? 0),
          name: String(item.settingValueText ?? item.name ?? item.text ?? '').trim()
        }))
        .filter((item) => item.id > 0);
    } catch (err) {
      console.warn('Failed to load email types from SettingValueDropDown:', err);
      return [];
    }
  },

  /**
   * Load configurable placeholders from Setting API
   */
  async getPlaceholders(signal) {
    const API_URL = getApiBaseUrl();
    const candidates = [
      'TemplatePlaceholder',
      'TemplatePlaceholders',
      'EmailPlaceholder',
      'EmailPlaceholders'
    ];

    const foundTokens = new Set();

    for (const candidate of candidates) {
      try {
        const response = await axios.get(`${API_URL}/Setting`, {
          headers: getAuthHeaders(),
          params: { Text: candidate, PageNumber: 1, PageSize: 50 },
          signal
        });

        const data = response.data?.data || response.data || [];
        const settings = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
          ? data.data
          : [];

        for (const s of settings) {
          const sName = String(s.settingName || s.settingKey || '').toLowerCase();
          if (sName.includes('placeholder')) {
            const values = s.settingValueDTOs || [];
            for (const v of values) {
              if (v.isActive !== false && v.settingValueText) {
                // Split by commas and newlines
                const chunks = String(v.settingValueText).split(/[\r\n,]+/);
                for (const chunk of chunks) {
                  const trimmed = chunk.trim();
                  if (trimmed) {
                    const normalized = trimmed.startsWith('{{') && trimmed.endsWith('}}')
                      ? trimmed
                      : `{{${trimmed.replace(/^{{|}}$/g, '')}}}`;
                    foundTokens.add(normalized);
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        // Continue checking candidates
      }
    }

    if (foundTokens.size > 0) {
      return Array.from(foundTokens);
    }

    return DEFAULT_PLACEHOLDERS;
  }
};

export default templateService;
