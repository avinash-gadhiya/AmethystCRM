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
 * Defensively normalize Page list response shapes
 */
const normalizePageList = (payload) => {
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
    pageId: Number(item.pageId ?? item.id ?? 0),
    menuId: Number(item.menuId ?? 0),
    pageName: String(item.pageName ?? item.name ?? '').trim(),
    pageDisplayName: String(item.pageDisplayName ?? item.displayName ?? item.pageName ?? '').trim(),
    pageUrl: String(item.pageUrl ?? item.url ?? '').trim(),
    pageIcon: String(item.pageIcon ?? item.icon ?? '').trim(),
    pageOrder: Number(item.pageOrder ?? item.order ?? 0),
    parentPageId: Number(item.parentPageId ?? 0),
    isActive: Boolean(item.isActive ?? item.status ?? true)
  }));

  return {
    data: normalized,
    totalCount: Number(total) || normalized.length
  };
};

/**
 * Defensively normalize PagePermission list response shapes
 */
const normalizePermissionList = (payload) => {
  if (!payload) return [];

  let list = [];
  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    list = Array.isArray(payload.data.data) ? payload.data.data : [];
  } else if (Array.isArray(payload.data)) {
    list = payload.data;
  } else if (Array.isArray(payload)) {
    list = payload;
  }

  return list.map((item) => ({
    pagePermissionId: Number(item.pagePermissionId ?? item.id ?? 0),
    pageId: Number(item.pageId ?? 0),
    permissionName: String(item.permissionName ?? item.name ?? '').trim(),
    permissionCode: String(item.permissionCode ?? item.code ?? '').trim(),
    permissionDescription: String(item.permissionDescription ?? item.description ?? '').trim(),
    permissionOrder: Number(item.permissionOrder ?? item.order ?? 0),
    isActive: Boolean(item.isActive ?? item.status ?? true)
  }));
};

/**
 * Defensively normalize Menu options for dropdown
 */
const normalizeMenuList = (payload) => {
  if (!payload) return [];

  let list = [];
  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    list = Array.isArray(payload.data.data) ? payload.data.data : [];
  } else if (Array.isArray(payload.data)) {
    list = payload.data;
  } else if (Array.isArray(payload)) {
    list = payload;
  }

  return list.map((item) => ({
    id: Number(item.menuId ?? item.id ?? 0),
    name: String(item.menuDisplayName || item.menuName || item.name || `Menu #${item.menuId ?? item.id}`).trim()
  })).filter((m) => m.id > 0);
};

export const pageService = {
  // ---------------------------------------------------------------------------
  // 1. Page List and CRUD
  // ---------------------------------------------------------------------------

  /**
   * GET /Page
   */
  async getPages(params = {}, signal) {
    const API_URL = getApiBaseUrl();
    const queryParams = {
      Text: params.Text || '',
      PageNumber: params.PageNumber || 1,
      PageSize: params.PageSize || 10,
      SortProperty: params.SortProperty || 'pageId',
      IsDescending: params.IsDescending ?? true
    };

    const cacheKey = `pages:${JSON.stringify(queryParams)}`;
    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey);
    }

    const requestPromise = (async () => {
      try {
        const response = await axios.get(`${API_URL}/Page`, {
          headers: getAuthHeaders(),
          params: queryParams,
          signal
        });
        return normalizePageList(response.data);
      } finally {
        inFlightRequests.delete(cacheKey);
      }
    })();

    inFlightRequests.set(cacheKey, requestPromise);
    return requestPromise;
  },

  /**
   * GET /Page/{id}
   */
  async getPageById(pageId, signal) {
    const API_URL = getApiBaseUrl();
    const response = await axios.get(`${API_URL}/Page/${encodeURIComponent(pageId)}`, {
      headers: getAuthHeaders(),
      signal
    });
    return response.data?.data || response.data;
  },

  /**
   * POST /Page
   */
  async createPage(pageDTO) {
    const API_URL = getApiBaseUrl();
    const payload = {
      pageId: 0,
      menuId: Number(pageDTO.menuId) || 0,
      pageName: String(pageDTO.pageName || '').trim(),
      pageDisplayName: String(pageDTO.pageDisplayName || pageDTO.pageName || '').trim(),
      pageUrl: String(pageDTO.pageUrl || '').trim(),
      pageIcon: String(pageDTO.pageIcon || '').trim(),
      pageOrder: Number(pageDTO.pageOrder) || 0,
      parentPageId: Number(pageDTO.parentPageId) || 0,
      isActive: pageDTO.isActive !== false
    };

    const response = await axios.post(`${API_URL}/Page`, payload, {
      headers: getAuthHeaders()
    });

    triggerNavigationInvalidation();
    return response.data;
  },

  /**
   * PUT /Page
   */
  async updatePage(pageDTO) {
    const API_URL = getApiBaseUrl();
    const payload = {
      pageId: Number(pageDTO.pageId),
      menuId: Number(pageDTO.menuId) || 0,
      pageName: String(pageDTO.pageName || '').trim(),
      pageDisplayName: String(pageDTO.pageDisplayName || pageDTO.pageName || '').trim(),
      pageUrl: String(pageDTO.pageUrl || '').trim(),
      pageIcon: String(pageDTO.pageIcon || '').trim(),
      pageOrder: Number(pageDTO.pageOrder) || 0,
      parentPageId: Number(pageDTO.parentPageId) || 0,
      isActive: Boolean(pageDTO.isActive)
    };

    const response = await axios.put(`${API_URL}/Page`, payload, {
      headers: getAuthHeaders()
    });

    triggerNavigationInvalidation();
    return response.data;
  },

  /**
   * DELETE /Page?id={pageId}
   */
  async deletePage(pageId) {
    const API_URL = getApiBaseUrl();
    const id = Number(pageId);

    // Primary: DELETE /Page?id={id}, fallback to /Page/{id}
    const result = await deleteById(
      `${API_URL}/Page?id=${encodeURIComponent(id)}`,
      `${API_URL}/Page/${encodeURIComponent(id)}`
    );

    triggerNavigationInvalidation();
    return result;
  },

  // ---------------------------------------------------------------------------
  // 2. Menu Dropdown Options
  // ---------------------------------------------------------------------------

  /**
   * GET /Menu (for Page form dropdown)
   */
  async getMenus(params = {}, signal) {
    const API_URL = getApiBaseUrl();
    const queryParams = {
      Text: params.Text || '',
      PageNumber: params.PageNumber || 1,
      PageSize: params.PageSize || 1000
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

  // ---------------------------------------------------------------------------
  // 3. Page Permissions API
  // ---------------------------------------------------------------------------

  /**
   * GET /PagePermission?PageId={pageId}
   */
  async getPagePermissions(pageId, signal) {
    const API_URL = getApiBaseUrl();
    const id = Number(pageId);

    const response = await axios.get(`${API_URL}/PagePermission`, {
      headers: getAuthHeaders(),
      params: { PageId: id },
      signal
    });

    const list = normalizePermissionList(response.data);
    // Defensive filter: only return permissions matching the selected page
    return list.filter((p) => p.pageId === id || p.pageId === 0 || !p.pageId);
  },

  /**
   * POST /PagePermission
   */
  async createPagePermission(permDTO) {
    const API_URL = getApiBaseUrl();
    const payload = {
      pagePermissionId: 0,
      pageId: Number(permDTO.pageId),
      permissionName: String(permDTO.permissionName || '').trim(),
      permissionCode: String(permDTO.permissionCode || '').trim(),
      permissionDescription: String(permDTO.permissionDescription || '').trim(),
      permissionOrder: Number(permDTO.permissionOrder) || 0,
      isActive: permDTO.isActive !== false
    };

    const response = await axios.post(`${API_URL}/PagePermission`, payload, {
      headers: getAuthHeaders()
    });

    triggerNavigationInvalidation();
    return response.data;
  },

  /**
   * PUT /PagePermission
   */
  async updatePagePermission(permDTO) {
    const API_URL = getApiBaseUrl();
    const payload = {
      pagePermissionId: Number(permDTO.pagePermissionId),
      pageId: Number(permDTO.pageId),
      permissionName: String(permDTO.permissionName || '').trim(),
      permissionCode: String(permDTO.permissionCode || '').trim(),
      permissionDescription: String(permDTO.permissionDescription || '').trim(),
      permissionOrder: Number(permDTO.permissionOrder) || 0,
      isActive: Boolean(permDTO.isActive)
    };

    const response = await axios.put(`${API_URL}/PagePermission`, payload, {
      headers: getAuthHeaders()
    });

    triggerNavigationInvalidation();
    return response.data;
  },

  /**
   * DELETE /PagePermission/{pagePermissionId}
   */
  async deletePagePermission(pagePermissionId) {
    const API_URL = getApiBaseUrl();
    const id = Number(pagePermissionId);

    const result = await deleteById(
      `${API_URL}/PagePermission/${encodeURIComponent(id)}`,
      `${API_URL}/PagePermission?id=${encodeURIComponent(id)}`
    );

    triggerNavigationInvalidation();
    return result;
  }
};

export default pageService;
