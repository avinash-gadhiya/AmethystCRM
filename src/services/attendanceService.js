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

const requestReport = async (reportName, params, signal) => {
  const token = authService.getToken();
  if (!token) throw new Error('Your session has expired. Please sign in again.');

  const query = buildQuery(params);
  const response = await fetch(`${API_BASE_URL}/AttendanceReport/${reportName}${query ? `?${query}` : ''}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    },
    signal
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Attendance API returned an invalid response (${response.status}).`);
  }

  if (!response.ok || payload?.success === false) {
    const validationMessage = payload?.errors ? Object.values(payload.errors).flat().join(', ') : '';
    throw new Error(payload?.message || validationMessage || `Attendance request failed (${response.status}).`);
  }

  return payload;
};

export const attendanceService = {
  getRegister(params, signal) {
    return requestReport('Register', params, signal);
  },

  getDayWise(params, signal) {
    return requestReport('DayWise', params, signal);
  }
};

export default attendanceService;
