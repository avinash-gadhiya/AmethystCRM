import axios from 'axios';
import { deleteById, getAuthHeaders } from './http';

const getApiBaseUrl = () => {
  return (import.meta.env.VITE_APP_API_URL || 'https://demoapi.enstasol.com/api').replace(/\/$/, '');
};

const normalizeList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

export const userService = {
  // GET /api/User
  async getUsers(params = {}) {
    const API_URL = getApiBaseUrl();
    const queryParams = {
      PageNumber: params.PageNumber || 1,
      PageSize: params.PageSize || 10,
      SortProperty: params.SortProperty || 'userId',
      IsDescending: params.IsDescending ?? true
    };

    if (params.Text && params.Text.trim()) {
      queryParams.Text = params.Text.trim();
    }
    if (params.RoleIds !== undefined && params.RoleIds !== null && params.RoleIds !== '') {
      queryParams.RoleIds = params.RoleIds;
    }
    if (params.LocationId !== undefined && params.LocationId !== null && params.LocationId !== '') {
      queryParams.LocationId = params.LocationId;
    }
    if (params.isActive !== undefined && params.isActive !== null && params.isActive !== '') {
      queryParams.isActive = params.isActive;
    }

    const response = await axios.get(`${API_URL}/User`, {
      headers: getAuthHeaders(),
      params: queryParams
    });

    const resData = response.data;
    const list = normalizeList(resData);
    const count =
      resData?.totalCount ??
      resData?.totalRecords ??
      resData?.count ??
      list.length;

    return {
      data: list,
      totalCount: Number(count) || list.length,
      raw: resData
    };
  },

  // GET /api/User/{id}
  async getUserById(userId) {
    const API_URL = getApiBaseUrl();
    const response = await axios.get(`${API_URL}/User/${encodeURIComponent(userId)}`, {
      headers: getAuthHeaders()
    });
    return response.data?.data || response.data;
  },

  // POST /api/User
  async createUser(userDTO) {
    const API_URL = getApiBaseUrl();
    const payload = {
      userId: 0,
      username: String(userDTO.username || '').trim(),
      email: String(userDTO.email || '').trim(),
      firstName: String(userDTO.firstName || '').trim(),
      lastName: String(userDTO.lastName || '').trim(),
      passwordHash: userDTO.passwordHash || userDTO.password || '',
      roleId: Number(userDTO.roleId) || 0,
      locationId: Number(userDTO.locationId) || 0,
      salesTarget: Number(userDTO.salesTarget) || 0,
      rplTarget: Number(userDTO.rplTarget) || 0,
      isActive: userDTO.isActive !== false,
      isLeadOn: Boolean(userDTO.isLeadOn)
    };

    const response = await axios.post(`${API_URL}/User`, payload, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  // PUT /api/User
  async updateUser(userDTO) {
    const API_URL = getApiBaseUrl();
    const payload = {
      userId: Number(userDTO.userId),
      username: String(userDTO.username || '').trim(),
      email: String(userDTO.email || '').trim(),
      firstName: String(userDTO.firstName || '').trim(),
      lastName: String(userDTO.lastName || '').trim(),
      roleId: Number(userDTO.roleId) || 0,
      locationId: Number(userDTO.locationId) || 0,
      salesTarget: Number(userDTO.salesTarget) || 0,
      rplTarget: Number(userDTO.rplTarget) || 0,
      isActive: userDTO.isActive !== false,
      isLeadOn: Boolean(userDTO.isLeadOn)
    };

    if (userDTO.passwordHash || userDTO.password) {
      payload.passwordHash = userDTO.passwordHash || userDTO.password;
    }

    const response = await axios.put(`${API_URL}/User`, payload, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  // DELETE /api/User/{id} (dual-strategy delete with ?id= fallback)
  async deleteUser(userId) {
    const API_URL = getApiBaseUrl();
    return deleteById(`${API_URL}/User`, userId);
  },

  // PUT /api/User to toggle status
  async toggleUserStatus(user, nextStatus) {
    const API_URL = getApiBaseUrl();
    const payload = {
      ...user,
      isActive: nextStatus
    };
    const response = await axios.put(`${API_URL}/User`, payload, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  // GET roles for filter dropdown & user create/edit
  async getRoles() {
    const API_URL = getApiBaseUrl();
    try {
      const response = await axios.get(`${API_URL}/Role/RoleDropdown`, {
        headers: getAuthHeaders()
      });
      const list = normalizeList(response.data);
      if (list.length > 0) return list;
    } catch {
      // fallback
    }

    try {
      const response = await axios.get(`${API_URL}/Role`, {
        headers: getAuthHeaders(),
        params: { PageNumber: 1, PageSize: 1000 }
      });
      return normalizeList(response.data);
    } catch (err) {
      console.warn('Could not load roles:', err);
      return [];
    }
  },

  // GET locations for filter dropdown & user create/edit
  async getLocations() {
    const API_URL = getApiBaseUrl();
    try {
      const response = await axios.get(`${API_URL}/Location/LocationDropdown`, {
        headers: getAuthHeaders()
      });
      const list = normalizeList(response.data);
      if (list.length > 0) return list;
    } catch {
      // fallback
    }

    try {
      const response = await axios.get(`${API_URL}/Location`, {
        headers: getAuthHeaders(),
        params: { PageNumber: 1, PageSize: 1000 }
      });
      return normalizeList(response.data);
    } catch (err) {
      console.warn('Could not load locations:', err);
      return [];
    }
  },

  // GET available groups
  async getGroups() {
    const API_URL = getApiBaseUrl();
    try {
      const response = await axios.get(`${API_URL}/Group/GroupDropdown`, {
        headers: getAuthHeaders()
      });
      const list = normalizeList(response.data);
      if (list.length > 0) return list;
    } catch {
      // fallback
    }

    try {
      const response = await axios.get(`${API_URL}/Group`, {
        headers: getAuthHeaders(),
        params: { PageNumber: 1, PageSize: 1000 }
      });
      return normalizeList(response.data);
    } catch (err) {
      console.warn('Could not load groups:', err);
      return [];
    }
  },

  // GET /api/UserGroup?id={id}
  async getUserGroup(id) {
    const API_URL = getApiBaseUrl();
    try {
      const response = await axios.get(`${API_URL}/UserGroup`, {
        headers: getAuthHeaders(),
        params: { id }
      });
      return response.data?.data || response.data || [];
    } catch (err) {
      // Fallback try with userId param
      try {
        const fallback = await axios.get(`${API_URL}/UserGroup`, {
          headers: getAuthHeaders(),
          params: { userId: id }
        });
        return fallback.data?.data || fallback.data || [];
      } catch {
        throw err;
      }
    }
  },

  // PUT /api/UserGroup
  async updateUserGroup(data) {
    const API_URL = getApiBaseUrl();
    const response = await axios.put(`${API_URL}/UserGroup`, data, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  // GET /api/UserPermission?userId={userId}
  async getUserPermissions(userId) {
    const API_URL = getApiBaseUrl();
    const response = await axios.get(`${API_URL}/UserPermission`, {
      headers: getAuthHeaders(),
      params: { userId }
    });
    return response.data?.data || response.data || [];
  },

  // POST /api/UserPermission
  async assignUserPermissions(data) {
    const API_URL = getApiBaseUrl();
    const response = await axios.post(`${API_URL}/UserPermission`, data, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  // GET /api/User/UserDropDown
  async getUserDropDown(params = {}) {
    const API_URL = getApiBaseUrl();
    const response = await axios.get(`${API_URL}/User/UserDropDown`, {
      headers: getAuthHeaders(),
      params: {
        isActive: params.isActive ?? true,
        PageNumber: params.PageNumber || 1,
        PageSize: params.PageSize || 100,
        Text: params.Text || ''
      }
    });
    return normalizeList(response.data);
  },

  // PUT /api/User/LeadON
  async setLeadOn(userLeadOnDTO) {
    const API_URL = getApiBaseUrl();
    const response = await axios.put(`${API_URL}/User/LeadON`, userLeadOnDTO, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  // PUT /api/User/ChangePassword
  async changePassword({ oldPassword, newPassword }) {
    const API_URL = getApiBaseUrl();
    const response = await axios.put(
      `${API_URL}/User/ChangePassword`,
      { oldPassword, newPassword },
      { headers: getAuthHeaders() }
    );
    return response.data;
  }
};

export default userService;
