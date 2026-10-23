import apiClient from './core/apiClient';

const normalizeList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

export const productService = {
  // GET /api/Product
  async getProducts(params = {}, signal) {
    const payload = await apiClient.get(
      '/Product',
      {
        Text: params.Text || '',
        PageNumber: params.PageNumber || 1,
        PageSize: params.PageSize || 10,
        SortProperty: params.SortProperty || 'productId',
        IsDescending: params.IsDescending ?? false
      },
      signal
    );

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
    return apiClient.post('/Product', productDTO);
  },

  // PUT /api/Product
  async updateProduct(productDTO) {
    return apiClient.put('/Product', productDTO);
  },

  // DELETE /api/Product?id={id} with fallback to /api/Product/{id}
  async deleteProduct(id) {
    try {
      return await apiClient.delete('/Product', { id });
    } catch (error) {
      if (![400, 404, 405].includes(error?.status)) throw error;
      return apiClient.delete(`/Product/${encodeURIComponent(id)}`);
    }
  },

  // GET /api/Product/ProductDropdown
  async getProductDropdown(params = {}, signal) {
    const payload = await apiClient.get(
      '/Product/ProductDropdown',
      {
        Text: params.Text || '',
        PageNumber: params.PageNumber || 1,
        PageSize: params.PageSize || 100,
        SortProperty: params.SortProperty || 'name',
        IsDescending: params.IsDescending ?? false
      },
      signal
    );
    return normalizeList(payload);
  }
};

export default productService;
