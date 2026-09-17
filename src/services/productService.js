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
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`
  };
  if (data !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${API_BASE_URL}${path}${query ? `?${query}` : ''}`, {
    method,
    headers,
    body: data === undefined ? undefined : JSON.stringify(data),
    signal
  });

  if (response.status === 204) return { success: true };

  let payload;
  try {
    payload = await response.json();
  } catch {
    if (response.ok) return { success: true };
    throw new Error(`Product API returned an invalid response (${response.status}).`);
  }

  if (!response.ok || payload?.success === false) {
    const validationMessage = payload?.errors ? Object.values(payload.errors).flat().join(', ') : '';
    throw new Error(payload?.message || payload?.error || validationMessage || `Product request failed (${response.status}).`);
  }

  return payload;
};

const normalizeList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

export const productService = {
  // GET /api/Product
  async getProducts(params = {}, signal) {
    const payload = await request('/Product', {
      params: {
        Text: params.Text || '',
        PageNumber: params.PageNumber || 1,
        PageSize: params.PageSize || 10,
        SortProperty: params.SortProperty || 'productId',
        IsDescending: params.IsDescending ?? true
      },
      signal
    });

    const data = normalizeList(payload);
    const totalCount = Number(payload?.totalCount ?? payload?.totalRecords ?? data.length) || 0;

    return {
      data,
      totalCount,
      raw: payload
    };
  },

  // POST /api/Product
  async createProduct(productDTO) {
    return request('/Product', {
      method: 'POST',
      data: productDTO
    });
  },

  // PUT /api/Product
  async updateProduct(productDTO) {
    return request('/Product', {
      method: 'PUT',
      data: productDTO
    });
  },

  // DELETE /api/Product?id={id}
  async deleteProduct(id) {
    return request('/Product', {
      method: 'DELETE',
      params: { id }
    });
  },

  // GET /api/Product/ProductDropdown
  async getProductDropdown(params = {}, signal) {
    const payload = await request('/Product/ProductDropdown', {
      params: {
        Text: params.Text || '',
        PageNumber: params.PageNumber || 1,
        PageSize: params.PageSize || 100,
        SortProperty: params.SortProperty || 'name',
        IsDescending: params.IsDescending ?? false
      },
      signal
    });
    return normalizeList(payload);
  }
};

export default productService;
