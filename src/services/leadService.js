import apiClient from './core/apiClient';
import { fetchSalesPersonList } from '@/lib/salesRoles';

const LIST_KEYS = ['data', 'Data', 'items', 'results', 'rows', 'list'];

const pick = (source, ...keys) => {
  for (const key of keys) if (source?.[key] !== undefined && source?.[key] !== null) return source[key];
  return undefined;
};

const booleanValue = (value, fallback = true) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'string') return !['false', '0', 'inactive'].includes(value.toLowerCase());
  return Boolean(value);
};

export const unwrapLeadList = (payload) => {
  let container = payload;
  for (let depth = 0; depth < 3; depth += 1) {
    if (Array.isArray(container)) return { rows: container, totalCount: container.length };
    const key = LIST_KEYS.find((candidate) => Array.isArray(container?.[candidate]));
    if (key) {
      const rows = container[key];
      const total = pick(container, 'totalCount', 'TotalCount', 'totalRecords', 'count') ?? pick(payload, 'totalCount', 'TotalCount');
      return { rows, totalCount: Number(total) || rows.length };
    }
    container = container?.data ?? container?.Data;
    if (!container) break;
  }
  return { rows: [], totalCount: 0 };
};

export const normalizeLead = (row = {}) => ({
  ...row,
  leadId: Number(pick(row, 'leadId', 'LeadId', 'leadID', 'id', 'Id')) || 0,
  customerName: String(pick(row, 'customerName', 'CustomerName', 'name', 'Name') || '').trim(),
  email: String(pick(row, 'email', 'Email') || '').trim(),
  phone: String(pick(row, 'phone', 'Phone', 'phoneNumber', 'PhoneNumber') || '').trim(),
  description: String(pick(row, 'description', 'Description', 'leadDescription') || '').trim(),
  dispositionId: Number(pick(row, 'dispositionId', 'DispositionId', 'despositionId', 'DespositionId')) || 0,
  dispositionName: String(pick(row, 'dispositionName', 'DispositionName', 'despositionName', 'DespositionName') || '').trim(),
  comments: String(pick(row, 'comments', 'Comments', 'comment', 'Comment') || '').trim(),
  assignedTo: Number(pick(row, 'assignedTo', 'AssignedTo', 'assignTo', 'salesPersonId', 'SalesPersonId')) || 0,
  assignedToName: String(
    pick(row, 'assignedToName', 'AssignedToName', 'salesPersonName', 'SalesPersonName', 'claimBy', 'ClaimBy') || ''
  ).trim(),
  createdBy: Number(pick(row, 'createdBy', 'CreatedBy')) || 0,
  createdByName: String(pick(row, 'createdByName', 'CreatedByName') || '').trim(),
  assignDate: pick(row, 'assignDate', 'AssignDate', 'assignedDate', 'AssignedDate') || '',
  leadDate:
    pick(row, 'dateAddedIST', 'DateAddedIST', 'originDateTime', 'OriginDateTime', 'dateAdded', 'DateAdded', 'leadDate', 'LeadDate') || '',
  groupId: Number(pick(row, 'groupId', 'GroupId')) || 0,
  groupName: String(pick(row, 'groupName', 'GroupName', 'group', 'Group') || '').trim(),
  locationId: Number(pick(row, 'locationId', 'LocationId')) || 0,
  locationName: String(pick(row, 'locationName', 'LocationName', 'location', 'Location') || '').trim(),
  vendorId: Number(pick(row, 'vendorId', 'VendorId')) || 0,
  vendorName: String(pick(row, 'vendorName', 'VendorName', 'vendor', 'Vendor') || '').trim(),
  timeZone: String(pick(row, 'timeZone', 'TimeZone', 'timezone', 'Timezone') || '').trim(),
  country: String(pick(row, 'country', 'Country', 'countryCode', 'CountryCode') || '').trim(),
  transferByName: String(pick(row, 'transferByName', 'TransferByName', 'transferredByName') || '').trim(),
  activityScore: pick(row, 'activityScore', 'ActivityScore'),
  isProxy: booleanValue(pick(row, 'isProxy', 'IsProxy'), false),
  isValid: booleanValue(pick(row, 'isValid', 'IsValid'), true)
});

export const normalizeCallback = (row = {}) => ({
  ...normalizeLead(row),
  callbackId: Number(pick(row, 'callbackId', 'CallbackId', 'id', 'Id')) || 0,
  name: String(pick(row, 'name', 'Name', 'customerName', 'CustomerName') || '').trim(),
  completionNotes: String(pick(row, 'completionNotes', 'CompletionNotes', 'comments', 'Comments') || '').trim(),
  completedDateTime: pick(row, 'completedDateTime', 'CompletedDateTime') || '',
  completedBy: Number(pick(row, 'completedBy', 'CompletedBy')) || 0,
  completedByName: String(pick(row, 'completedByName', 'CompletedByName') || '').trim()
});

const normalizeResult = (payload, normalizer) => {
  const { rows, totalCount } = unwrapLeadList(payload);
  return { data: rows.map(normalizer), totalCount };
};

const unwrapReportRows = (payload) => {
  const visited = new Set();
  const preferredKeys = ['data', 'Data', 'items', 'results', 'rows', 'list', 'users', 'leads', 'report'];

  const findRows = (value, depth = 0) => {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== 'object' || depth > 4 || visited.has(value)) return null;
    visited.add(value);

    for (const key of preferredKeys) {
      const rows = findRows(value[key], depth + 1);
      if (rows) return rows;
    }
    for (const nested of Object.values(value)) {
      const rows = findRows(nested, depth + 1);
      if (rows) return rows;
    }
    return null;
  };

  return findRows(payload) || [];
};

const normalizeOption = (row = {}) => ({
  id: Number(pick(row, 'settingValueId', 'SettingValueId', 'id', 'Id', 'value')) || 0,
  label: String(pick(row, 'settingValueText', 'SettingValueText', 'label', 'Label', 'name', 'Name', 'text') || '').trim(),
  isActive: booleanValue(pick(row, 'isActive', 'IsActive', 'status'), true)
});

export const leadService = {
  async getNewLeads(params, signal) {
    return normalizeResult(await apiClient.get('/Lead', params, signal), normalizeLead);
  },
  async claimLead(leadId) {
    return apiClient.put(`/Lead/AssignLead/${encodeURIComponent(leadId)}`);
  },
  async getMyLeads(params, signal) {
    return normalizeResult(await apiClient.get('/Lead/MyLead', params, signal), normalizeLead);
  },
  async updateLead(leadId, dispositionId, comments) {
    const payload = { leadId: Number(leadId), dispositionId: Number(dispositionId), comments: String(comments).trim() };
    await apiClient.put('/Lead/UpdateDisposition', payload);
    return apiClient.put('/Lead/UpdateComment', payload);
  },
  async transferLead(leadId, transferUserId) {
    return apiClient.put('/Lead/transferLead', null, { leadId, transferUserId });
  },
  async getCallbacks(params, signal) {
    return normalizeResult(await apiClient.get('/Callback', params, signal), normalizeCallback);
  },
  async getCallbackHistory(leadId, signal) {
    return normalizeResult(await apiClient.get(`/Callback/CallBackHistory/${encodeURIComponent(leadId)}`, {}, signal), normalizeCallback)
      .data;
  },
  createCallback(payload) {
    return apiClient.post('/Callback', payload);
  },
  updateCallback(payload) {
    return apiClient.put('/Callback', payload);
  },
  async getLeadReport(params, signal) {
    return normalizeResult(await apiClient.get('/LeadReport/Leads', params, signal), normalizeLead);
  },
  async getReport(name, params, signal) {
    const payload = await apiClient.get(`/LeadReport/${name}`, params, signal);
    const rows = unwrapReportRows(payload);
    const total = pick(payload, 'totalCount', 'TotalCount', 'totalRecords', 'count');
    return { data: rows, totalCount: Number(total) || rows.length };
  },
  async deleteLead(leadId) {
    try {
      return await apiClient.request(`/Lead/${encodeURIComponent(leadId)}`, { method: 'DELETE' });
    } catch (error) {
      if (![400, 404, 405].includes(error?.status)) throw error;
      return apiClient.delete('/Lead', { id: leadId });
    }
  },
  async getOptions(settingKey, signal) {
    const result = normalizeResult(await apiClient.get('/SettingValue/SettingValueDropDown', { settingKey }, signal), normalizeOption);
    return result.data.filter((option) => option.isActive && option.id > 0);
  },
  async getLookup(path, idKeys, nameKeys, signal) {
    const payload = await apiClient.get(
      path,
      { Text: '', PageNumber: 1, PageSize: 1000, SortProperty: idKeys[0], IsDescending: false },
      signal
    );
    const { rows } = unwrapLeadList(payload);
    return rows
      .map((row) => ({
        id: Number(pick(row, ...idKeys)) || 0,
        label: String(pick(row, ...nameKeys) || '').trim()
      }))
      .filter((option) => option.id > 0 && option.label);
  },
  async getSalesUsers() {
    const users = await fetchSalesPersonList();
    return users
      .map((user) => ({
        id: Number(pick(user, 'userId', 'UserId', 'id', 'Id')) || 0,
        label: String(
          pick(user, 'fullName', 'FullName', 'name', 'Name', 'userName', 'UserName') || `${user.firstName || ''} ${user.lastName || ''}`
        ).trim(),
        role: String(pick(user, 'roleName', 'RoleName', 'role') || '').trim(),
        location: String(pick(user, 'locationName', 'LocationName', 'location') || '').trim()
      }))
      .filter((user) => user.id > 0);
  }
};

export default leadService;
