import apiClient from './core/apiClient';

const SALES_ROLES = new Set(['sales agent', 'sales manager']);
const QUERY_PARAMS = {
  PageNumber: 1,
  PageSize: 1000,
  SortProperty: 'userId',
  IsDescending: true
};

let cachedSalesUsers = null;
let inFlightRequest = null;
let cacheGeneration = 0;

const unwrapList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
};

const normalizeRole = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const nullableNumber = (value) => {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeUser = (record) => {
  const userId = Number(record?.userId ?? record?.UserId ?? record?.id);
  const firstName = String(record?.firstName ?? record?.FirstName ?? '').trim();
  const lastName = String(record?.lastName ?? record?.LastName ?? '').trim();
  const providedFullName = String(record?.fullName ?? record?.FullName ?? '').trim();
  const fullName = providedFullName || `${firstName} ${lastName}`.trim();
  const username = String(record?.userName ?? record?.username ?? record?.UserName ?? record?.Username ?? '').trim();
  const roleName = String(record?.roleName ?? record?.RoleName ?? '').trim();

  return {
    userId,
    fullName: fullName || username,
    firstName,
    lastName,
    username,
    email: String(record?.email ?? record?.Email ?? '').trim(),
    roleName,
    locationName: String(record?.locationName ?? record?.LocationName ?? '').trim(),
    salesTarget: nullableNumber(record?.salesTarget ?? record?.SalesTarget),
    rplTarget: nullableNumber(record?.rplTarget ?? record?.RplTarget ?? record?.RPLTarget),
    rawRecord: record
  };
};

const normalizeSalesUsers = (payload) => {
  const seen = new Set();

  return unwrapList(payload)
    .map(normalizeUser)
    .filter((user) => Number.isFinite(user.userId) && user.userId > 0)
    .filter((user) => SALES_ROLES.has(normalizeRole(user.roleName)))
    .filter((user) => {
      if (seen.has(user.userId)) return false;
      seen.add(user.userId);
      return true;
    })
    .sort((left, right) => right.userId - left.userId);
};

const clearCache = () => {
  cacheGeneration += 1;
  cachedSalesUsers = null;
  inFlightRequest = null;
};

export const salesTargetService = {
  async getSalesUsers(forceFresh = false) {
    if (!forceFresh && cachedSalesUsers) return cachedSalesUsers;
    if (!forceFresh && inFlightRequest) return inFlightRequest;

    const requestGeneration = cacheGeneration;
    const request = apiClient.get('/User', QUERY_PARAMS).then((response) => {
      const users = normalizeSalesUsers(response);
      if (requestGeneration === cacheGeneration) cachedSalesUsers = users;
      return users;
    });

    inFlightRequest = request;
    try {
      return await request;
    } finally {
      if (inFlightRequest === request) inFlightRequest = null;
    }
  },

  async createSalesTarget({ userId, salesTarget, rplTarget }) {
    const id = Number(userId);
    if (!Number.isFinite(id) || id <= 0) throw new Error('Please select a user.');

    const response = await apiClient.post('/User', {
      userId: id,
      salesTarget: nullableNumber(salesTarget),
      rplTarget: nullableNumber(rplTarget)
    });
    clearCache();
    return response;
  },

  async updateSalesTarget({ userId, salesTarget, rplTarget }, users = []) {
    const id = Number(userId);
    if (!Number.isFinite(id) || id <= 0) throw new Error('Please select a user.');

    const source = users.length ? users : cachedSalesUsers || [];
    const existingUser = source.find((user) => Number(user.userId) === id);
    if (!existingUser) throw new Error('The selected user could not be resolved. Please refresh and try again.');

    const response = await apiClient.put('/User', {
      ...(existingUser.rawRecord || existingUser),
      userId: id,
      salesTarget: nullableNumber(salesTarget),
      rplTarget: nullableNumber(rplTarget)
    });
    clearCache();
    return response;
  },

  clearCache
};

export default salesTargetService;
