import axios from 'axios';
import { toast } from 'sonner';

const stripTrailingSlash = (value) => {
  const v = (value || '').toString();
  if (!v) return '';
  return v.endsWith('/') ? v.slice(0, -1) : v;
};

const isFallbackWorthyStatus = (status) => {
  return status === 400 || status === 404 || status === 405;
};

// Global 401 session expiration handling
let isRedirecting401 = false;
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      if (!isRedirecting401) {
        isRedirecting401 = true;
        try {
          toast.error('Session expired. Please sign in again.');
        } catch {
          // ignore
        }
        try {
          localStorage.removeItem('token');
          localStorage.removeItem('userToken');
          localStorage.removeItem('api_token');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          localStorage.removeItem('authData');
        } catch {
          // ignore
        }
        setTimeout(() => {
          if (typeof window !== 'undefined' && !window.location.pathname.toLowerCase().includes('/login')) {
            window.location.href = '/login';
          }
          isRedirecting401 = false;
        }, 1000);
      }
    }
    return Promise.reject(error);
  }
);

export const getAuthHeaders = () => {
  const token = localStorage.getItem('token') || localStorage.getItem('userToken') || '';
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const deleteById = async (baseUrl, id, config = {}) => {
  if (id === undefined || id === null || id === '') {
    throw new Error('deleteById requires a valid id');
  }

  const url = stripTrailingSlash(baseUrl);
  const headers = {
    ...getAuthHeaders(),
    ...(config?.headers || {})
  };

  // 1. Attempt REST style: DELETE /Resource/{id}
  try {
    return await axios.delete(`${url}/${encodeURIComponent(id)}`, {
      ...config,
      headers,
      params: config?.params
    });
  } catch (error) {
    const status = error?.response?.status;
    if (!status || !isFallbackWorthyStatus(status)) {
      throw error;
    }
  }

  // 2. Only for HTTP 400, 404, or 405, retry: DELETE /Resource?id={id}
  return axios.delete(url, {
    ...config,
    headers,
    params: {
      ...(config?.params || {}),
      id
    }
  });
};

export default {
  deleteById,
  getAuthHeaders
};

