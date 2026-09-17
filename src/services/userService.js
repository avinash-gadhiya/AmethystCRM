import authService from './authService';

const API_BASE_URL = (import.meta.env.VITE_APP_API_URL || 'https://demoapi.enstasol.com/api').replace(/\/$/, '');

const buildQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === '' || value === null || value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach((val) => query.append(key, String(val)));
    } else {
      query.set(key, String(value));
    }
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
    throw new Error(`User API returned an invalid response (${response.status}).`);
  }

  if (!response.ok || payload?.success === false) {
    const validationMessage = payload?.errors ? Object.values(payload.errors).flat().join(', ') : '';
    throw new Error(payload?.message || validationMessage || `User request failed (${response.status}).`);
  }

  return payload;
};

const normalizeList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

export const userService = {
  // GET /api/User
  async getUsers(params = {}, signal) {
    const payload = await request('/User', {
      params: {
        Text: params.Text || '',
        RoleIds: params.RoleIds,
        LocationId: params.LocationId,
        isActive: params.isActive,
        PageNumber: params.PageNumber || 1,
        PageSize: params.PageSize || 10,
        SortProperty: params.SortProperty || 'userId',
        IsDescending: params.IsDescending ?? true
      },
      signal
    });

    return {
      data: normalizeList(payload),
      totalCount: payload?.totalCount ?? payload?.totalRecords ?? normalizeList(payload).length,
      raw: payload
    };
  },

  // POST /api/User
  async createUser(userDTO) {
    return request('/User', {
      method: 'POST',
      data: userDTO
    });
  },

  // PUT /api/User
  async updateUser(userDTO) {
    return request('/User', {
      method: 'PUT',
      data: userDTO
    });
  },

  // DELETE /api/User?id={id}
  async deleteUser(userId) {
    return request('/User', {
      method: 'DELETE',
      params: { id: userId }
    });
  },

  // GET /api/User/UserDropDown
  async getUserDropDown(params = {}, signal) {
    const payload = await request('/User/UserDropDown', {
      params: {
        isActive: params.isActive ?? true,
        PageNumber: params.PageNumber || 1,
        PageSize: params.PageSize || 100,
        Text: params.Text || ''
      },
      signal
    });
    return normalizeList(payload);
  },

  // GET /api/User/GetLeadOn
  async getLeadOn(params = {}, signal) {
    const payload = await request('/User/GetLeadOn', {
      params,
      signal
    });
    return {
      data: normalizeList(payload),
      totalCount: payload?.totalCount ?? normalizeList(payload).length
    };
  },

  // GET /api/User/GetUserLeadOn
  async getUserLeadOn(signal) {
    return request('/User/GetUserLeadOn', { signal });
  },

  // PUT /api/User/LeadON
  async setLeadOn(userLeadOnDTO) {
    return request('/User/LeadON', {
      method: 'PUT',
      data: userLeadOnDTO
    });
  },

  // PUT /api/User/UserLeadON
  async toggleCurrentUserLeadOn() {
    return request('/User/UserLeadON', {
      method: 'PUT'
    });
  },

  // PUT /api/User/ChangeProfile
  async changeProfile({ firstName, lastName, email }) {
    return request('/User/ChangeProfile', {
      method: 'PUT',
      data: {
        firstName: firstName?.trim(),
        lastName: lastName?.trim(),
        email: email?.trim()
      }
    });
  },

  // PUT /api/User/ChangePassword
  async changePassword({ oldPassword, newPassword }) {
    return request('/User/ChangePassword', {
      method: 'PUT',
      data: {
        oldPassword,
        newPassword
      }
    });
  },

  // PUT /api/User/ReviseSalesTargets
  async reviseSalesTargets(data) {
    return request('/User/ReviseSalesTargets', {
      method: 'PUT',
      data
    });
  },

  // GET /api/UserGroup?id={id}
  async getUserGroup(id, signal) {
    return request('/UserGroup', {
      params: { id },
      signal
    });
  },

  // PUT /api/UserGroup
  async updateUserGroup(data) {
    return request('/UserGroup', {
      method: 'PUT',
      data
    });
  },

  // GET /api/UserPermission?userId={userId}
  async getUserPermissions(userId, signal) {
    return request('/UserPermission', {
      params: { userId },
      signal
    });
  },

  // POST /api/UserPermission
  async assignUserPermissions(data) {
    return request('/UserPermission', {
      method: 'POST',
      data
    });
  }
};

export default userService;
