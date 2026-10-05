import axios from 'axios';
import { deleteById, getAuthHeaders } from './http';

const getApiBaseUrl = () => {
  return (import.meta.env.VITE_APP_API_URL || 'https://demoapi.enstasol.com/api').replace(/\/$/, '');
};

const roleService = {
  // GET ${VITE_APP_API_URL}/Role
  getRoles: async (params = {}) => {
    try {
      const API_URL = getApiBaseUrl();
      const {
        Text = '',
        PageNumber = 1,
        PageSize = 1000,
        SortProperty = 'roleId',
        IsDescending = true
      } = params;

      const response = await axios.get(`${API_URL}/Role`, {
        headers: getAuthHeaders(),
        params: {
          Text,
          PageNumber,
          PageSize,
          SortProperty,
          IsDescending
        }
      });

      if (response.data && response.data.success) {
        return {
          data: response.data.data || [],
          totalCount: response.data.totalCount || 0
        };
      }

      const rows = Array.isArray(response.data?.data)
        ? response.data.data
        : Array.isArray(response.data)
        ? response.data
        : [];
      return {
        data: rows,
        totalCount: response.data?.totalCount ?? rows.length
      };
    } catch (error) {
      console.error('Error fetching roles:', error);
      throw error;
    }
  },

  // GET ${VITE_APP_API_URL}/Role/{id}
  getRoleById: async (roleId) => {
    try {
      const API_URL = getApiBaseUrl();
      const response = await axios.get(`${API_URL}/Role/${encodeURIComponent(roleId)}`, {
        headers: getAuthHeaders()
      });

      if (response.data && response.data.success) {
        return response.data.data;
      }

      return response.data?.data || response.data || null;
    } catch (error) {
      console.error('Error fetching role:', error);
      throw error;
    }
  },

  // POST ${VITE_APP_API_URL}/Role
  createRole: async (roleData) => {
    try {
      const API_URL = getApiBaseUrl();
      const response = await axios.post(`${API_URL}/Role`, {
        roleId: 0,
        roleName: String(roleData.roleName || '').trim(),
        roleDescription: String(roleData.roleDescription || '').trim(),
        isSystemRole: Boolean(roleData.isSystemRole),
        isActive: roleData.isActive !== false
      }, {
        headers: getAuthHeaders()
      });

      return response.data;
    } catch (error) {
      console.error('Error creating role:', error);
      throw error;
    }
  },

  // PUT ${VITE_APP_API_URL}/Role
  updateRole: async (roleData) => {
    try {
      const API_URL = getApiBaseUrl();
      const response = await axios.put(`${API_URL}/Role`, {
        roleId: Number(roleData.roleId),
        roleName: String(roleData.roleName || '').trim(),
        roleDescription: String(roleData.roleDescription || '').trim(),
        isSystemRole: Boolean(roleData.isSystemRole),
        isActive: roleData.isActive !== false
      }, {
        headers: getAuthHeaders()
      });

      return response.data;
    } catch (error) {
      console.error('Error updating role:', error);
      throw error;
    }
  },

  // DELETE role (try /Role/{id} then fallback to /Role?id={id})
  deleteRole: async (roleId) => {
    try {
      const API_URL = getApiBaseUrl();
      const response = await deleteById(`${API_URL}/Role`, roleId);
      return response.data;
    } catch (error) {
      console.error('Error deleting role:', error);
      throw error;
    }
  },

  // GET ${VITE_APP_API_URL}/Permission?roleId={roleId}
  getPermissions: async (roleId) => {
    try {
      const API_URL = getApiBaseUrl();
      const response = await axios.get(`${API_URL}/Permission`, {
        headers: getAuthHeaders(),
        params: { roleId: Number(roleId) }
      });

      if (response.data && response.data.success) {
        return response.data.data;
      }

      return response.data?.data ?? (Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      throw error;
    }
  },

  // POST ${VITE_APP_API_URL}/Permission
  assignPermissions: async (payload) => {
    try {
      const API_URL = getApiBaseUrl();
      const cleanRoleId = Number(payload.roleId);
      const cleanPayload = {
        roleId: cleanRoleId,
        assignPermissionDTOs: Array.isArray(payload.assignPermissionDTOs)
          ? payload.assignPermissionDTOs.map((p) => ({
              rolePermissionId: Number(p.rolePermissionId || 0),
              roleId: cleanRoleId,
              pagePermissionId: Number(p.pagePermissionId || 0),
              isGranted: Boolean(p.isGranted)
            }))
          : []
      };

      const response = await axios.post(`${API_URL}/Permission`, cleanPayload, {
        headers: getAuthHeaders()
      });

      return response.data;
    } catch (error) {
      console.error('Error assigning permissions:', error);
      throw error;
    }
  }
};

export default roleService;
