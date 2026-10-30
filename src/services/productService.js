import apiClient from './core/apiClient';

const normalizeList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

// Exactly the ProductDTO fields documented for POST/PUT /api/Product, with the API's types.
export const toProductDTO = (product = {}) => ({
  productId: Number(product.productId) || 0,
  name: String(product.name ?? '').trim(),
  description: String(product.description ?? '').trim(),
  price: Number(product.price) || 0,
  productType: String(product.productType ?? '').trim(),
  photo: String(product.photo ?? '').trim(),
  isActive: product.isActive !== false,
  createdBy: Number(product.createdBy) || 0,
  createdByName: String(product.createdByName ?? '').trim(),
  createdDate: product.createdDate || new Date().toISOString()
});

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

  // POST /api/Product — new products always go out with productId 0.
  async createProduct(productDTO) {
    return apiClient.post('/Product', { ...toProductDTO(productDTO), productId: 0 });
  },

  // PUT /api/Product
  async updateProduct(productDTO) {
    return apiClient.put('/Product', toProductDTO(productDTO));
  },

  // DELETE /api/Product?id={id}
  async deleteProduct(id) {
    return apiClient.delete('/Product', { id });
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
