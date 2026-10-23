import axios from 'axios';
import { getAuthHeaders } from './http';

const getApiBaseUrl = () => {
  return (import.meta.env.VITE_APP_API_URL || 'https://demoapi.enstasol.com/api').replace(/\/$/, '');
};

const stateService = {
  // Fetch states with standard paging/sorting/search parameters
  getStates: async (params = {}) => {
    const API_URL = getApiBaseUrl();
    const {
      Text = '',
      PageNumber = 1,
      PageSize = 200,
      SortProperty = 'stateId',
      IsDescending = false,
    } = params;

    const response = await axios.get(`${API_URL}/State`, {
      headers: getAuthHeaders(),
      params: {
        Text,
        PageNumber,
        PageSize,
        SortProperty,
        IsDescending,
      },
    });

    if (response.data && response.data.success) {
      return {
        data: response.data.data || [],
        totalCount: response.data.totalCount || 0,
      };
    }

    return { data: [], totalCount: 0 };
  },
};

export default stateService;
