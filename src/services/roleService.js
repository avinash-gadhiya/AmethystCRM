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
    throw new Error(`Role API returned an invalid response (${response.status}).`);
  }

  if (!response.ok || payload?.success === false) {
    const validationMessage = payload?.errors ? Object.values(payload.errors).flat().join(', ') : '';
    throw new Error(payload?.message || validationMessage || `Role request failed (${response.status}).`);
  }

  return payload;
};

const normalizeList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

export const roleService = {
  // GET /api/Role
  async getRoles(params = {}, signal) {
    const payload = await request('/Role', {
      params: {
        Text: params.Text || '',
        PageNumber: params.PageNumber || 1,
        PageSize: params.PageSize || 10,
        SortProperty: params.SortProperty || 'roleId',
        IsDescending: params.IsDescending ?? false
      },
      signal
    });

    return {
      data: normalizeList(payload),
      totalCount: payload?.totalCount ?? payload?.totalRecords ?? normalizeList(payload).length,
      raw: payload
    };
  },

  // POST /api/Role
  async createRole(roleDTO) {
    return request('/Role', {
      method: 'POST',
      data: roleDTO
    });
  },

  // PUT /api/Role
  async updateRole(roleDTO) {
    return request('/Role', {
      method: 'PUT',
      data: roleDTO
    });
  },

  // DELETE /api/Role?id={id}
  async deleteRole(roleId) {
    return request('/Role', {
      method: 'DELETE',
      params: { id: roleId }
    });
  },

  // GET /api/Role/RoleDropdown
  async getRoleDropdown(params = {}, signal) {
    const payload = await request('/Role/RoleDropdown', {
      params: {
        Text: params.Text || '',
        PageNumber: params.PageNumber || 1,
        PageSize: params.PageSize || 100,
        SortProperty: 'roleName',
        IsDescending: false
      },
      signal
    });
    return normalizeList(payload);
  },

  // GET /api/Role/{id}
  async getRoleById(roleId, signal) {
    return request(`/Role/${encodeURIComponent(roleId)}`, { signal });
  }
};

export default roleService;
