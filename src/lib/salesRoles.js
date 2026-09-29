// Sales-side and service-side roles, identified by NAME only.
//
// Role ids differ between environments and can be renumbered, so nothing here
// hard-codes them. The user APIs match a role by its name through the `Text`
// query parameter, so a role's user list is fetched once per role name and
// merged.
//
// These roles drive a few rules across the app:
//   - user dropdowns that must offer sales persons only (lead transfer,
//     customer Sales Person, Share Sale)
//   - the ticket Assigned To dropdown, which offers service persons instead
//   - pages that collapse to an add-only screen for a role
//
// Admins and every other role are excluded.

import axios from 'axios';
import { serializeQueryParams } from '@/lib/queryParams';

// Sent verbatim as the `Text` search value, one request per name.
export const SALES_PERSON_ROLE_SEARCH_TEXTS = ['Sales Agent', 'Sales Manager'];

export const SALES_PERSON_ROLE_NAMES = ['sales agent', 'sales manager'];

export const SERVICE_PERSON_ROLE_SEARCH_TEXTS = ['Service Agent', 'Service Manager'];

export const SERVICE_PERSON_ROLE_NAMES = ['service agent', 'service manager'];

// `/User/UserDropDown` returns role names unseparated ("SuperAdmin",
// "SalesAgent") while `/Role` and the login payload use spaced names
// ("Sales Agent"). Splitting the camel-case boundary first makes both forms
// normalize to the same value - without it "SalesAgent" would not match
// "sales agent" and every sales-person dropdown in the app would come back
// empty, since `isRoleUser` below drops anything whose role does not match.
export const normalizeRoleName = (value) =>
  String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')
    .trim();

export const isSalesPersonRoleName = (value) =>
  SALES_PERSON_ROLE_NAMES.includes(normalizeRoleName(value));

export const isServicePersonRoleName = (value) =>
  SERVICE_PERSON_ROLE_NAMES.includes(normalizeRoleName(value));

// Drop anything that comes back carrying a non-sales role name.
//
// `/User/UserDropDown` now returns `roleName`, so this is a live filter on that
// payload rather than the no-op it used to be: the per-role `Text` search picks
// the candidates and this rejects anyone the search matched on something other
// than their role (a person named "Sales", say). A payload with no role name
// still falls through to the server-side filter.
const isRoleUser = (user, roleNames) => {
  const roleName = user?.roleName ?? user?.RoleName ?? user?.role ?? user?.Role;
  const normalized = normalizeRoleName(roleName);

  // No role name on the payload - trust the server-side filter.
  if (!normalized) return true;

  return roleNames.includes(normalized);
};

export const isSalesPersonUser = (user) => isRoleUser(user, SALES_PERSON_ROLE_NAMES);

// Sales Managers specifically. Unlike `isSalesPersonUser` this returns false for
// a payload with no role name: it is used to single a role out of a mixed list,
// so "role unknown" has to mean "not a manager" rather than "keep it".
export const isSalesManagerUser = (user) =>
  normalizeRoleName(user?.roleName ?? user?.RoleName ?? user?.role ?? user?.Role) === 'sales manager';

export const isServicePersonUser = (user) => isRoleUser(user, SERVICE_PERSON_ROLE_NAMES);

const getUserIdKey = (user) =>
  String(user?.userId ?? user?.UserId ?? user?.id ?? user?.Id ?? '').trim();

// Fetch users by role name and merge them into one list. `fetchByRoleName(name)`
// runs one request per role and must resolve to an array of users. A role whose
// request fails contributes nothing rather than failing the whole list.
const fetchUsersByRoleNames = async (searchTexts, roleNames, fetchByRoleName) => {
  const perRole = await Promise.all(
    searchTexts.map(async (roleName) => {
      try {
        const list = await fetchByRoleName(roleName);
        return Array.isArray(list) ? list : [];
      } catch (error) {
        console.error(`Failed to load "${roleName}" users:`, error);
        return [];
      }
    }),
  );

  const seen = new Set();
  const merged = [];

  for (const user of perRole.flat()) {
    if (!isRoleUser(user, roleNames)) continue;

    const key = getUserIdKey(user);
    if (!key || seen.has(key)) continue;

    seen.add(key);
    merged.push(user);
  }

  return merged;
};

export const fetchSalesPersonUsers = (fetchByRoleName) =>
  fetchUsersByRoleNames(SALES_PERSON_ROLE_SEARCH_TEXTS, SALES_PERSON_ROLE_NAMES, fetchByRoleName);

export const fetchServicePersonUsers = (fetchByRoleName) =>
  fetchUsersByRoleNames(SERVICE_PERSON_ROLE_SEARCH_TEXTS, SERVICE_PERSON_ROLE_NAMES, fetchByRoleName);

const extractList = (response) => {
  const payload = response?.data;
  const list = payload?.data ?? payload?.Data ?? payload;
  return Array.isArray(list) ? list : [];
};

// Same shape every caller already expects from `userService.getUsers`: the id
// lands on `userId` and the display name on `fullName`, whatever the endpoint
// called them. Without this a dropdown item gets `value={String(undefined)}`
// and selecting it blanks the trigger.
const normalizeUser = (user) => {
  const userId = Number(user?.userId ?? user?.UserId ?? user?.id ?? user?.Id) || 0;
  const fullName =
    String(user?.fullName ?? user?.FullName ?? user?.name ?? user?.Name ?? '').trim()
    || `${user?.firstName || ''} ${user?.lastName || ''}`.trim();

  return { ...user, userId, fullName };
};

const extractUserList = (response) => extractList(response).map(normalizeUser);

// Role ids, resolved from /Role by NAME. Ids are renumbered between
// environments so they are never hard-coded - the names above are the source of
// truth and the ids are looked up once per session, per role group.
//
// These are NOT sent to /User/UserDropDown - that endpoint is called without a
// role filter. Kept for callers that need role ids for other endpoints; nothing
// here requests them, so no /Role call is made unless one is asked for.
const roleIdsPromiseByKey = new Map();

const getRoleIdsByNames = (roleNames) => {
  const key = roleNames.join('|');
  if (roleIdsPromiseByKey.has(key)) return roleIdsPromiseByKey.get(key);

  const API_URL = import.meta.env.VITE_APP_API_URL;

  const promise = axios
    .get(
      `${API_URL}/Role?${serializeQueryParams({
        PageNumber: 1,
        PageSize: 500,
        SortProperty: 'roleId',
        IsDescending: false,
      })}`,
    )
    .then((response) =>
      extractList(response)
        .filter((role) => roleNames.includes(normalizeRoleName(role?.roleName ?? role?.name ?? role?.Name)))
        .map((role) => Number(role?.roleId ?? role?.id ?? role?.Id) || 0)
        .filter((id) => id > 0),
    )
    .catch((error) => {
      console.error(`Failed to resolve role ids for ${key}:`, error);
      // Let the next caller retry rather than caching the failure.
      roleIdsPromiseByKey.delete(key);
      return [];
    });

  roleIdsPromiseByKey.set(key, promise);
  return promise;
};

export const getSalesRoleIds = () => getRoleIdsByNames(SALES_PERSON_ROLE_NAMES);

export const getServiceRoleIds = () => getRoleIdsByNames(SERVICE_PERSON_ROLE_NAMES);

// One entry per (roles, pageSize, sortProperty). The list costs one request per
// role name, and every dropdown in the app asks for the same people, so it is
// fetched once per session and shared. Callers that open a modal no longer race
// their own fetch - the second and later opens resolve instantly.
const roleUserListCache = new Map();

export const clearRoleUserListCache = () => roleUserListCache.clear();

// THE way to load a role's user list. Every such dropdown in the app goes
// through this, so they all show the same people.
//
// `/User/UserDropDown` is called without `RoleIds`: the per-role `Text` search
// is the filter, one request per role name, merged.
const fetchRoleUserList = (searchTexts, roleNames, { pageSize, sortProperty, isActive = true }) => {
  // `isActive` belongs in the key: without it a list cached under one setting
  // would be handed back to a caller that asked for the other.
  const key = `${roleNames.join('|')}::${pageSize}::${sortProperty}::${isActive ?? 'any'}`;
  const cached = roleUserListCache.get(key);
  if (cached) return cached;

  const API_URL = import.meta.env.VITE_APP_API_URL;

  const promise = fetchUsersByRoleNames(searchTexts, roleNames, async (roleName) => {
    const response = await axios.get(
      `${API_URL}/User/UserDropDown?${serializeQueryParams({
        Text: roleName,
        IsActive: isActive,
        PageNumber: 1,
        PageSize: pageSize,
        SortProperty: sortProperty,
        IsDescending: false,
      })}`,
    );
    return extractUserList(response);
  })
    .then((users) => {
      // Never cache an empty list. `fetchUsersByRoleNames` swallows per-role
      // failures, so a transient outage returns [] - caching that would leave
      // every dropdown in the app blank for the rest of the session.
      if (!users.length) roleUserListCache.delete(key);
      return users;
    })
    .catch((error) => {
      roleUserListCache.delete(key);
      throw error;
    });

  roleUserListCache.set(key, promise);
  return promise;
};

// Active users only, which is what a picker should offer - you cannot hand work
// to someone who has been deactivated. Pass `isActive: null` to drop the filter
// and get everyone, which is only ever right for resolving historical ids to
// names, never for a dropdown.
export const fetchSalesPersonList = ({ pageSize = 1000, sortProperty = 'userId', isActive = true } = {}) =>
  fetchRoleUserList(SALES_PERSON_ROLE_SEARCH_TEXTS, SALES_PERSON_ROLE_NAMES, { pageSize, sortProperty, isActive });

// Service Manager + Service Agent - the ticket Assigned To list.
export const fetchServicePersonList = ({ pageSize = 1000, sortProperty = 'userId', isActive = true } = {}) =>
  fetchRoleUserList(SERVICE_PERSON_ROLE_SEARCH_TEXTS, SERVICE_PERSON_ROLE_NAMES, { pageSize, sortProperty, isActive });

// Server-side search over sales persons by typed text (name / email), for the
// dropdowns that look users up as you type instead of listing them all.
//
// `Text` carries the query here rather than a role name, and `RoleIds` is not
// sent, so `isSalesPersonUser` below is the only role filter left - and since
// the payload now carries `roleName`, it is what keeps non-sales users whose
// name matched the query out of the results.
export const searchSalesPersonUsers = async (searchText, { pageSize = 200, isActive = true } = {}) => {
  const query = String(searchText || '').trim();
  if (!query) return [];

  const API_URL = import.meta.env.VITE_APP_API_URL;

  const response = await axios.get(
    `${API_URL}/User/UserDropDown?${serializeQueryParams({
      Text: query,
      IsActive: isActive,
      PageNumber: 1,
      PageSize: pageSize,
      SortProperty: 'userId',
      IsDescending: false,
    })}`,
  );

  return extractUserList(response).filter(isSalesPersonUser);
};

// Whether the signed-in user is a Sales Manager / Sales Agent. Reads the role
// name stored at login by authService. An unknown role is treated as "not
// sales" so a missing value never hides a page from someone who should see it.
export const isCurrentUserSalesRole = () => {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  return isSalesPersonRoleName(window.localStorage.getItem('roleName'));
};

// Whether the signed-in user is a Sales Agent specifically - Sales Managers are
// excluded, since they still file work under their agents' names. Agents own
// only their own work, so pickers that would let them choose someone else are
// hidden and they are assigned automatically.
export const isCurrentUserSalesAgent = () => {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  return normalizeRoleName(window.localStorage.getItem('roleName')) === 'sales agent';
};

// Whether the signed-in user is a Service Agent specifically - Service Managers
// are excluded, since they still assign tickets to their agents.
export const isCurrentUserServiceAgent = () => {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  return normalizeRoleName(window.localStorage.getItem('roleName')) === 'service agent';
};

export default {
  SALES_PERSON_ROLE_SEARCH_TEXTS,
  SALES_PERSON_ROLE_NAMES,
  SERVICE_PERSON_ROLE_SEARCH_TEXTS,
  SERVICE_PERSON_ROLE_NAMES,
  normalizeRoleName,
  isSalesPersonRoleName,
  isServicePersonRoleName,
  isSalesPersonUser,
  isSalesManagerUser,
  isServicePersonUser,
  fetchSalesPersonUsers,
  fetchServicePersonUsers,
  getSalesRoleIds,
  getServiceRoleIds,
  fetchSalesPersonList,
  fetchServicePersonList,
  searchSalesPersonUsers,
  isCurrentUserSalesRole,
  isCurrentUserSalesAgent,
  isCurrentUserServiceAgent,
};
