import axios from 'axios';
import { toast } from 'sonner';
import authService from './authService';

const stripTrailingSlash = (value) => {
  const v = (value || '').toString();
  if (!v) return '';
  return v.endsWith('/') ? v.slice(0, -1) : v;
};

const isFallbackWorthyStatus = (status) => {
  return status === 400 || status === 404 || status === 405;
};

// The router runs under VITE_APP_BASE_NAME, so a bare '/login' would leave the app.
export const getLoginUrl = () => `${stripTrailingSlash(import.meta.env.VITE_APP_BASE_NAME || '')}/login`;

export const redirectToLogin = () => {
  if (typeof window !== 'undefined' && !window.location.pathname.toLowerCase().includes('/login')) {
    window.location.replace(getLoginUrl());
  }
};

// Global 401 session expiration handling, shared by axios and fetch-based clients
let isRedirecting401 = false;
export const handleSessionExpired = () => {
  if (isRedirecting401) return;
  isRedirecting401 = true;
  try {
    toast.error('Session expired. Please sign in again.');
  } catch {
    // ignore
  }
  authService.logout();
  setTimeout(() => {
    redirectToLogin();
    isRedirecting401 = false;
  }, 1000);
};

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) handleSessionExpired();
    return Promise.reject(error);
  }
);

export const getAuthHeaders = () => {
  const token = authService.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const QUERY_PARAM_DELETE_ENDPOINTS = [
  'blockip',
  'user',
  'role',
  'group',
  'groupemail',
  'location',
  'menu',
  'page',
  'product',
  'setting',
  'template'
];

export const deleteById = async (baseUrl, id, config = {}) => {
  if (id === undefined || id === null || id === '') {
    throw new Error('deleteById requires a valid id');
  }

  const url = stripTrailingSlash(baseUrl);
  const endpointName = url.split('/').pop().toLowerCase();
  const prefersQueryParam =
    config?.strategy === 'query' ||
    QUERY_PARAM_DELETE_ENDPOINTS.includes(endpointName);

  const headers = {
    ...getAuthHeaders(),
    ...(config?.headers || {})
  };

  const doQueryDelete = () =>
    axios.delete(url, {
      ...config,
      headers,
      params: {
        ...(config?.params || {}),
        id
      }
    });

  const doPathDelete = () =>
    axios.delete(`${url}/${encodeURIComponent(id)}`, {
      ...config,
      headers,
      params: config?.params
    });

  if (prefersQueryParam) {
    try {
      return await doQueryDelete();
    } catch (error) {
      const status = error?.response?.status;
      if (!status || !isFallbackWorthyStatus(status)) {
        throw error;
      }
      return await doPathDelete();
    }
  } else {
    try {
      return await doPathDelete();
    } catch (error) {
      const status = error?.response?.status;
      if (!status || !isFallbackWorthyStatus(status)) {
        throw error;
      }
      return await doQueryDelete();
    }
  }
};

export default {
  deleteById,
  getAuthHeaders
};

