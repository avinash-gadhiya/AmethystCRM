import axios from 'axios';
import { deleteById, getAuthHeaders } from './http';
import permissionService from './permissionService';

const getApiBaseUrl = () => {
  return (import.meta.env.VITE_APP_API_URL || 'https://demoapi.enstasol.com/api').replace(/\/$/, '');
};

// In-flight request deduplication map
const inFlightRequests = new Map();

// Helper to broadcast route & menu invalidation across the app
export const triggerNavigationInvalidation = () => {
  try {
    permissionService.clearCache();
  } catch (err) {
    console.warn('Failed to clear permission cache:', err);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app:routes-invalidated'));
  }
};

/**
 * Defensively normalize Menu list response shapes
 */
const normalizeMenuList = (payload) => {
  if (!payload) return { data: [], totalCount: 0 };

  let list = [];
  let total = 0;

  // Format 1: { data: { data: [], totalCount: number } }
  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    list = Array.isArray(payload.data.data) ? payload.data.data : [];
    total =
      payload.data.totalCount ??
      payload.data.totalRecords ??
      payload.data.count ??
      list.length;
  }
  // Format 2: { success?: boolean, data: [], totalCount?: number }
  else if (Array.isArray(payload.data)) {
    list = payload.data;
    total =
      payload.totalCount ??
      payload.totalRecords ??
      payload.count ??
      list.length;
  }
  // Format 3: Raw array []
  else if (Array.isArray(payload)) {
    list = payload;
    total = payload.length;
  }

  const normalized = list.map((item) => ({
    menuId: Number(item.menuId ?? item.id ?? 0),
    menuName: String(item.menuName ?? item.name ?? '').trim(),
    menuDisplayName: String(item.menuDisplayName ?? item.displayName ?? item.menuName ?? '').trim(),
    menuIcon: String(item.menuIcon ?? item.icon ?? '').trim(),
    menuOrder: Number(item.menuOrder ?? item.order ?? 0),
    menuUrl: String(item.menuUrl ?? item.url ?? '').trim(),
    isActive: Boolean(item.isActive ?? item.status ?? true)
  }));

  return {
    data: normalized,
    totalCount: Number(total) || normalized.length
  };
};

export const menuService = {
  /**
   * GET /Menu
   */
  async getMenus(params = {}, signal) {
    const API_URL = getApiBaseUrl();
    const queryParams = {
      Text: params.Text || '',
      PageNumber: params.PageNumber || 1,
      PageSize: params.PageSize || 10,
      SortProperty: params.SortProperty || 'menuId',
      IsDescending: params.IsDescending ?? true
    };

    const cacheKey = `menus:${JSON.stringify(queryParams)}`;
    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey);
    }

    const requestPromise = (async () => {
      try {
        const response = await axios.get(`${API_URL}/Menu`, {
          headers: getAuthHeaders(),
          params: queryParams,
          signal
        });
        return normalizeMenuList(response.data);
      } finally {
        inFlightRequests.delete(cacheKey);
      }
    })();

    inFlightRequests.set(cacheKey, requestPromise);
    return requestPromise;
  },

  /**
   * GET /Menu/{id}
   */
  async getMenuById(menuId, signal) {
    const API_URL = getApiBaseUrl();
    const response = await axios.get(`${API_URL}/Menu/${encodeURIComponent(menuId)}`, {
      headers: getAuthHeaders(),
      signal
    });
    return response.data?.data || response.data;
  },

  /**
   * POST /Menu
   */
  async createMenu(menuDTO) {
    const API_URL = getApiBaseUrl();
    const payload = {
      menuId: 0,
      menuName: String(menuDTO.menuName || '').trim(),
      menuDisplayName: String(menuDTO.menuDisplayName || menuDTO.menuName || '').trim(),
      menuIcon: String(menuDTO.menuIcon || '').trim(),
      menuOrder: Number(menuDTO.menuOrder) || 0,
      menuUrl: String(menuDTO.menuUrl || '').trim(),
      isActive: menuDTO.isActive !== false
    };

    const response = await axios.post(`${API_URL}/Menu`, payload, {
      headers: getAuthHeaders()
    });

    triggerNavigationInvalidation();
    return response.data;
  },

  /**
   * PUT /Menu
   */
  async updateMenu(menuDTO) {
    const API_URL = getApiBaseUrl();
    const payload = {
      menuId: Number(menuDTO.menuId),
      menuName: String(menuDTO.menuName || '').trim(),
      menuDisplayName: String(menuDTO.menuDisplayName || menuDTO.menuName || '').trim(),
      menuIcon: String(menuDTO.menuIcon || '').trim(),
      menuOrder: Number(menuDTO.menuOrder) || 0,
      menuUrl: String(menuDTO.menuUrl || '').trim(),
      isActive: Boolean(menuDTO.isActive)
    };

    const response = await axios.put(`${API_URL}/Menu`, payload, {
      headers: getAuthHeaders()
    });

    triggerNavigationInvalidation();
    return response.data;
  },

  /**
   * DELETE /Menu/{menuId} with fallback to /Menu?id={menuId}
   */
  async deleteMenu(menuId) {
    const API_URL = getApiBaseUrl();
    const id = Number(menuId);

    const result = await deleteById(
      `${API_URL}/Menu/${encodeURIComponent(id)}`,
      `${API_URL}/Menu?id=${encodeURIComponent(id)}`
    );

    triggerNavigationInvalidation();
    return result;
  },

  triggerNavigationInvalidation
};

export default menuService;
