import apiClient from './core/apiClient';
import { getCurrentLoginIpv4 } from './clientIpService';
import authService from './authService';
import { buildCustomerPayload, customerSaveMismatches, isCustomerActive } from '@/lib/customerPayload';

const normalizeFields = (value) => {
  if (Array.isArray(value)) return value.map(normalizeFields);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      const name = key.charAt(0).toLowerCase() + key.slice(1);
      return [name, name === 'isActive' && item != null ? isCustomerActive(item) : normalizeFields(item)];
    })
  );
};

const unwrapCustomer = (payload, fallback, requestedId = Number(fallback?.customerId) || 0, allowIdOnly = true) => {
  let value = normalizeFields(payload);
  while (value && typeof value === 'object' && !Array.isArray(value) && value.data !== undefined) value = value.data;
  if (Array.isArray(value)) value = requestedId ? value.find((item) => Number(item.customerId) === requestedId) : value[0];
  if (value && typeof value === 'object' && Number(value.customerId) > 0) return { ...fallback, ...value };
  if (allowIdOnly && (typeof value === 'number' || typeof value === 'string') && Number(value) > 0)
    return { ...fallback, customerId: Number(value) };
  return fallback || null;
};

const normalizeList = (payload) => {
  payload = normalizeFields(payload);
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  return [];
};

const profileFields = [
  'email',
  'phone',
  'phone2',
  'address',
  'city',
  'stateId',
  'stateName',
  'zipCode',
  'countryId',
  'countryName',
  'salesPerson',
  'salesPersonName'
];
const missingValue = (value) => value == null || String(value).trim() === '' || value === 0 || value === '0';
const needsProfile = (row) =>
  (!row.address && !row.city && !row.stateName && !Number(row.stateId) && !row.countryName && !Number(row.countryId)) ||
  (!String(row.salesPersonName || '').trim() && !Number(row.salesPerson));

// Keep profile fields learned from successful reads/saves/status operations.
// Sparse GET projections must not erase them. Status and creation metadata
// always come from the current response, never from this display cache.
const PROFILE_CACHE_KEY = 'crm_customer_profiles_v1';
const profileRelations = { stateName: 'stateId', countryName: 'countryId', salesPersonName: 'salesPerson' };
let profileScope;
let knownProfiles = new Map();
const getProfileScope = () => {
  const user = authService.getUser();
  return user?.userId
    ? JSON.stringify([import.meta.env.VITE_APP_API_URL || 'https://demoapi.enstasol.com/api', user.userId, user.lastLoginDate || ''])
    : null;
};
const getKnownProfiles = (scope) => {
  if (!scope || getProfileScope() !== scope) return null;
  if (profileScope !== scope) {
    profileScope = scope;
    knownProfiles = new Map();
    try {
      const stored = JSON.parse(globalThis.sessionStorage?.getItem(PROFILE_CACHE_KEY) || 'null');
      if (stored?.scope === scope && Array.isArray(stored.profiles)) {
        for (const profile of stored.profiles) {
          if (Number(profile?.customerId) > 0) knownProfiles.set(Number(profile.customerId), profile);
        }
      }
    } catch {
      // Storage restrictions must not prevent customer reads.
    }
  }
  return knownProfiles;
};
const persistProfiles = () => {
  try {
    globalThis.sessionStorage?.setItem(PROFILE_CACHE_KEY, JSON.stringify({ scope: profileScope, profiles: [...knownProfiles.values()] }));
  } catch {
    // The in-memory copy still preserves fields when browser storage is full.
  }
};
const restoreCustomerProfile = (row, scope) => {
  const known = getKnownProfiles(scope)?.get(Number(row.customerId));
  const customer = { ...row };
  if (!known) return customer;
  for (const field of profileFields) {
    const relation = profileRelations[field];
    if (relation && !missingValue(row[relation]) && Number(row[relation]) !== Number(known[relation])) continue;
    if (missingValue(customer[field]) && !missingValue(known[field])) customer[field] = known[field];
  }
  return customer;
};
const rememberCustomerProfile = (row, scope, replace = false) => {
  const profiles = getKnownProfiles(scope);
  const id = Number(row?.customerId);
  if (!profiles || !id) return;
  const known = profiles.get(id);
  const next = replace ? { customerId: id } : { ...known, customerId: id };
  for (const [label, key] of Object.entries(profileRelations)) {
    if (!missingValue(row[key]) && Number(row[key]) !== Number(known?.[key])) delete next[label];
  }
  for (const field of profileFields) {
    if (!missingValue(row[field])) next[field] = row[field];
  }
  profiles.delete(id);
  profiles.set(id, next);
  if (profiles.size > 500) profiles.delete(profiles.keys().next().value);
  persistProfiles();
};
const retainCustomerProfile = (row, scope) => {
  const customer = restoreCustomerProfile(row, scope);
  rememberCustomerProfile(customer, scope);
  return customer;
};

if (typeof window !== 'undefined') {
  window.addEventListener('auth-session-changed', () => {
    profileScope = undefined;
    knownProfiles.clear();
    try {
      globalThis.sessionStorage?.removeItem(PROFILE_CACHE_KEY);
    } catch {
      // Logout must also work when browser storage is unavailable.
    }
  });
}

// The regular Customer projections omit profile fields. Search is a separate,
// read-only index; merge only an exact customer ID, never a same-name customer.
const hydrateCustomerProfiles = async (customers, signal) => {
  const groups = new Map();
  for (const customer of customers.filter(needsProfile)) {
    const query = String(customer.name || customer.customerId).trim();
    if (!groups.has(query)) groups.set(query, []);
    groups.get(query).push(customer);
  }
  const profiles = new Map();
  const errors = new Map();
  const queue = [...groups.entries()];
  await Promise.all(
    Array.from({ length: Math.min(4, queue.length) }, async () => {
      while (queue.length) {
        const [searchText, targets] = queue.shift();
        const wanted = new Set(targets.map((row) => Number(row.customerId)));
        const seen = new Set();
        try {
          for (let pageNumber = 1; wanted.size && pageNumber <= 100; pageNumber += 1) {
            signal?.throwIfAborted();
            const payload = normalizeFields(
              await apiClient.request('/Customer/search', {
                params: { searchText, pageNumber, pageSize: 100 },
                signal
              })
            );
            const rows = normalizeList(payload);
            let added = 0;
            for (const row of rows) {
              const id = Number(row.customerId);
              if (id && !seen.has(id)) {
                seen.add(id);
                added += 1;
              }
              if (wanted.has(id)) {
                profiles.set(id, row);
                wanted.delete(id);
              }
            }
            const total = payload?.totalCount ?? payload?.data?.totalCount ?? payload?.totalRecords;
            if (!added || (total != null ? seen.size >= Number(total) : rows.length < 100)) break;
          }
        } catch (error) {
          if (signal?.aborted) throw error;
          for (const target of targets) errors.set(Number(target.customerId), error.message || 'Unable to load customer profile.');
        }
      }
    })
  );
  signal?.throwIfAborted();
  const warnings = [];
  const data = customers.map((row) => {
    const customer = { ...row };
    const profile = profiles.get(Number(row.customerId));
    if (profile)
      for (const field of profileFields) {
        if (missingValue(customer[field]) && !missingValue(profile[field])) customer[field] = profile[field];
      }
    // Empty optional fields in a successful response are not request failures.
    // Only offer a retry when a supporting API call actually failed.
    if (errors.has(Number(row.customerId)))
      warnings.push({
        customerId: row.customerId,
        message: errors.get(Number(row.customerId))
      });
    return customer;
  });
  return { data, warnings };
};

const customerLookups = [
  {
    id: 'salesPerson',
    field: 'salesPersonName',
    key: 'userId',
    route: '/User/UserDropDown',
    label: (row) =>
      row.fullName ||
      [row.firstName, row.lastName].filter(Boolean).join(' ').trim() ||
      row.displayName ||
      row.username ||
      row.userName ||
      row.name || row.label || row.text
  },
  { id: 'stateId', field: 'stateName', key: 'stateId', route: '/State/StateDropdown', label: (row) => row.stateName || row.name || row.label || row.text },
  {
    id: 'countryId',
    field: 'countryName',
    key: 'countryId',
    route: '/Country/CountryDropdown',
    label: (row) => row.countryName || row.name || row.label || row.text
  }
];

// Customer projections can include foreign keys without their display names.
// Resolve only those referenced keys; never substitute the creator as the seller.
const hydrateCustomerLabels = async (customers, signal) => {
  const lookups = await Promise.allSettled(
    customerLookups.map(async (lookup) => {
      const needed = new Set(
        customers
          .filter((row) => Number(row[lookup.id]) > 0 && !String(row[lookup.field] || '').trim())
          .map((row) => Number(row[lookup.id]))
      );
      const labels = new Map();
      const seen = new Set();
      for (let page = 1; needed.size && page <= 100; page += 1) {
        signal?.throwIfAborted();
        const payload = normalizeFields(await apiClient.request(lookup.route, { params: { PageNumber: page, PageSize: 100 }, signal }));
        const rows = normalizeList(payload);
        let added = 0;
        for (const row of rows) {
          const id = Number(row[lookup.key] ?? row.id ?? row.value);
          if (id && !seen.has(id)) {
            seen.add(id);
            added += 1;
          }
          const label = lookup.label(row);
          if (needed.has(id) && label) {
            labels.set(id, label);
            needed.delete(id);
          }
        }
        const total = payload?.totalCount ?? payload?.data?.totalCount;
        if (!added || (total != null ? seen.size >= Number(total) : rows.length < 100)) break;
      }
      return labels;
    })
  );
  signal?.throwIfAborted();
  return customers.map((row) => {
    const customer = { ...row };
    customerLookups.forEach((lookup, index) => {
      if (!String(customer[lookup.field] || '').trim() && lookups[index].status === 'fulfilled') {
        const label = lookups[index].value.get(Number(customer[lookup.id]));
        if (label) customer[lookup.field] = label;
      }
    });
    return customer;
  });
};

export const customerService = {
  async getCustomers(params = {}, signal, { useProfileCache = true } = {}) {
    const scope = useProfileCache ? getProfileScope() : null;
    const payload = await apiClient.request('/Customer', {
      params: {
        Text: params.Text || '',
        SearchField: params.SearchField || '',
        FromDate: params.FromDate || '',
        ToDate: params.ToDate || '',
        PageNumber: params.PageNumber || 1,
        PageSize: params.PageSize || 10,
        SortProperty: params.SortProperty || 'customerId',
        IsDescending: params.IsDescending !== false
      },
      signal
    });

    const profiles = await hydrateCustomerProfiles(normalizeList(payload).map((row) => restoreCustomerProfile(row, scope)), signal);
    const data = await hydrateCustomerLabels(profiles.data, signal);
    return {
      data: data.map((row) => retainCustomerProfile(row, scope)),
      profileWarnings: profiles.warnings,
      totalCount:
        Number(
          payload?.totalCount ?? payload?.data?.totalCount ?? payload?.totalRecords ?? payload?.TotalCount ?? normalizeList(payload).length
        ) || 0
    };
  },

  async searchCustomers(searchText, pageNumber = 1, pageSize = 10, signal) {
    const scope = getProfileScope();
    const payload = await apiClient.request('/Customer/search', {
      params: { searchText, pageNumber, pageSize },
      signal
    });
    const data = await hydrateCustomerLabels(normalizeList(payload).map((row) => restoreCustomerProfile(row, scope)), signal);
    return {
      data: data.map((row) => retainCustomerProfile(row, scope)),
      totalCount: Number(payload?.totalCount ?? payload?.data?.totalCount ?? payload?.totalRecords) || data.length
    };
  },

  async rebuildSearchIndex() {
    try {
      return await apiClient.request('/Customer/index/rebuild', { method: 'POST', data: {} });
    } catch (error) {
      if (![400, 415].includes(error?.status)) throw error;
      return apiClient.request('/Customer/index/rebuild', { method: 'POST' });
    }
  },

  async getCustomerById(customerId, signal, { useProfileCache = true } = {}) {
    const scope = useProfileCache ? getProfileScope() : null;
    if (!Number.isInteger(Number(customerId)) || Number(customerId) <= 0) throw new Error('Customer ID is required.');
    signal?.throwIfAborted();
    const ip = await getCurrentLoginIpv4();
    signal?.throwIfAborted();
    const payload = await apiClient.request(`/Customer/${customerId}`, {
      params: { ip },
      signal
    });
    const customer = unwrapCustomer(payload, null, Number(customerId), false);
    if (Number(customer?.customerId) !== Number(customerId)) throw new Error('The customer details could not be loaded. Please retry.');
    const profiles = await hydrateCustomerProfiles([restoreCustomerProfile(customer, scope)], signal);
    return retainCustomerProfile((await hydrateCustomerLabels(profiles.data, signal))[0], scope);
  },

  async getCustomerViews(params = {}, signal) {
    const payload = await apiClient.request('/Customer/GetCustomerView', {
      params: {
        Text: params.Text || '',
        PageNumber: params.PageNumber || 1,
        PageSize: params.PageSize || 20,
        SortProperty: params.SortProperty || 'customerId',
        IsDescending: params.IsDescending !== false
      },
      signal
    });
    return {
      data: normalizeList(payload),
      totalCount: Number(payload?.totalCount ?? payload?.data?.totalCount ?? payload?.totalRecords) || 0
    };
  },

  async createCustomer(customer) {
    const scope = getProfileScope();
    const data = buildCustomerPayload(customer, { isCreate: true, user: authService.getUser() || {} });
    const payload = await apiClient.post('/Customer', data);
    const saved = unwrapCustomer(payload, data);
    rememberCustomerProfile({ ...data, customerId: saved.customerId }, scope, true);
    return retainCustomerProfile(saved, scope);
  },

  async updateCustomer(customer) {
    const scope = getProfileScope();
    const data = buildCustomerPayload(customer, { user: authService.getUser() || {} });
    const payload = await apiClient.put('/Customer', data);
    const saved = unwrapCustomer(payload, data);
    rememberCustomerProfile(data, scope, true);
    return retainCustomerProfile(saved, scope);
  },

  async verifyCustomerSave(customerId, submitted) {
    const id = Number(customerId);
    if (!Number.isInteger(id) || id <= 0)
      throw new Error('The API reported a save without returning a customer ID. Check the customer list before submitting again.');
    const signal = AbortSignal.timeout(15000);
    // Some backend detail projections omit fields that are present in the list.
    // Require a matching persisted record from either read, never the POST echo.
    const reads = await Promise.allSettled([
      this.getCustomerById(id, signal, { useProfileCache: false }),
      this.getCustomers({ Text: String(id), SearchField: 'customerId', PageNumber: 1, PageSize: 100 }, signal, { useProfileCache: false }).then((result) =>
        result.data.find((row) => Number(row.customerId) === id)
      )
    ]);
    let missing = null;
    for (const read of reads) {
      if (read.status !== 'fulfilled' || !read.value) continue;
      const mismatches = customerSaveMismatches(submitted, read.value);
      if (!mismatches.length) return { verified: true, customer: read.value, missingFields: [] };
      if (!missing || mismatches.length < missing.length) missing = mismatches;
    }
    return {
      verified: false,
      customer: null,
      missingFields: missing || [],
      message: `Customer #${id} was saved. Some details could not be confirmed by the API. Your entries are kept below; you do not need to save again.`
    };
  },

  async toggleCustomerStatus(customerId, expectedStatus) {
    const scope = getProfileScope();
    const id = Number(customerId);
    if (!Number.isInteger(id) || id <= 0) throw new Error('Customer ID is required.');
    if (typeof expectedStatus !== 'boolean') throw new Error('The requested customer status is required.');
    const signal = AbortSignal.timeout(15000);
    // This endpoint disables the customer and returns its complete stored DTO.
    // The list/detail projections omit profile fields, so never build the
    // activation update from a table row or a partial detail response.
    const result = await apiClient.request('/Customer/CanDisableCustomer', { method: 'PUT', params: { id }, signal });
    const profile = unwrapCustomer(result, null, id, false);
    if (Number(profile?.customerId) === id) rememberCustomerProfile(profile, scope);
    if (expectedStatus && (profile?.isActive == null || !isCustomerActive(profile.isActive))) {
      const profileFields = ['email', 'phone', 'phone2', 'address', 'city', 'stateId', 'countryId', 'salesPerson'];
      if (Number(profile?.customerId) !== id || !profileFields.every((field) => Object.prototype.hasOwnProperty.call(profile, field))) {
        throw new Error(
          'Activation requires the complete saved customer profile, but the API did not return it. The customer was not updated with partial data.'
        );
      }
      const update = buildCustomerPayload({ ...profile, isActive: true }, { user: authService.getUser() || {} });
      // Keep unrelated stored values, including nullable metadata/collections,
      // exactly as returned. Only isActive is being edited here.
      for (const key of Object.keys(update)) {
        if (key !== 'isActive' && Object.prototype.hasOwnProperty.call(profile, key)) update[key] = profile[key];
      }
      await apiClient.put('/Customer', update);
    }
    const payload = await apiClient.request('/Customer', {
      params: { Text: String(id), SearchField: 'customerId', PageNumber: 1, PageSize: 100 },
      signal
    });
    const customer = normalizeList(payload).find((row) => Number(row.customerId) === id);
    if (!customer || customer.isActive == null) {
      throw new Error('The status request was accepted, but the saved status could not be confirmed. Refresh the customer list.');
    }
    const active = isCustomerActive(customer.isActive);
    if (active !== expectedStatus) {
      const error = new Error(
        `Customer #${id} is still ${active ? 'active' : 'inactive'}. The API did not apply ${expectedStatus ? 'activation' : 'deactivation'}.`
      );
      error.actualStatus = active;
      throw error;
    }
    const saved = Object.fromEntries(
      Object.entries(Number(profile?.customerId) === id ? profile : {}).filter(([, value]) => value != null)
    );
    const rows = await hydrateCustomerLabels([restoreCustomerProfile({ ...saved, customerId: id, isActive: active }, scope)], signal);
    return retainCustomerProfile(rows[0], scope);
  },

  async deleteCustomer(customerId) {
    if (!customerId) throw new Error('Customer ID is required.');
    const scope = getProfileScope();
    const result = await apiClient.request(`/Customer/${customerId}`, { method: 'DELETE' });
    if (getKnownProfiles(scope)?.delete(Number(customerId))) persistProfiles();
    return result;
  }
};

export default customerService;
