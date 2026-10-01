import authService from '@/services/authService';

const EMPTY_PERMISSIONS = {
  canView: false,
  canAdd: false,
  canUpdate: false,
  canDelete: false,
  resolved: true
};

const normalize = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const permissionRows = (page) => page?.menuPagePermissionDTOs || page?.pagePermissionDTOs || page?.permissions || [];

const isTrue = (value) =>
  value === true ||
  value === 1 ||
  String(value ?? '')
    .trim()
    .toLowerCase() === 'true';

const isFalse = (value) =>
  value === false ||
  value === 0 ||
  String(value ?? '')
    .trim()
    .toLowerCase() === 'false';

const readCachedPages = (user) => {
  const roleId = Number(user?.roleId ?? localStorage.getItem('roleId')) || 0;
  const userId = Number(user?.userId ?? localStorage.getItem('userId')) || 0;
  const identityKey = `crm_permission_menus:v2:${roleId}:${userId}`;
  const cacheKeys = localStorage.getItem(identityKey)
    ? [identityKey]
    : localStorage.getItem('crm_permission_menus')
      ? ['crm_permission_menus']
      : [];
  const pages = [];

  cacheKeys.forEach((key) => {
    const menus = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(menus)) return;
    menus.forEach((menu) => {
      if (Array.isArray(menu?.menuPermissionPageDTOs)) pages.push(...menu.menuPermissionPageDTOs);
    });
  });
  return pages;
};

const getGrantedCodes = (user) => {
  const codes = new Set();
  const userCodes = Array.isArray(user?.permissionCodes)
    ? user.permissionCodes
    : typeof user?.permissionCodes === 'string'
      ? user.permissionCodes.split(',')
      : [];
  userCodes.forEach((permission) => {
    const code = typeof permission === 'string' ? permission : isFalse(permission?.hasPermission) ? '' : permission?.permissionCode;
    if (code) codes.add(String(code).trim().toLowerCase());
  });

  try {
    const localCodes = JSON.parse(localStorage.getItem('permissionCodes') || '[]');
    if (Array.isArray(localCodes)) {
      localCodes.forEach((permission) => {
        const code = typeof permission === 'string' ? permission : isFalse(permission?.hasPermission) ? '' : permission?.permissionCode;
        if (code) codes.add(String(code).trim().toLowerCase());
      });
    }
  } catch {
    // Invalid local permission data must not grant access.
  }
  return codes;
};

const permissionsFromPage = (page, grantedCodes) => {
  const result = { ...EMPTY_PERMISSIONS };
  permissionRows(page).forEach((permission) => {
    if (isFalse(permission?.isActive)) return;
    const name = String(permission?.permissionName ?? permission?.name ?? '').toLowerCase();
    const code = String(permission?.permissionCode ?? '')
      .trim()
      .toLowerCase();
    const granted = isTrue(permission?.hasPermission) || (code && grantedCodes.has(code));
    if (!granted) return;

    if (name.includes('view') || name.includes('read') || code.includes('view') || code.includes('read')) {
      result.canView = true;
    }
    if (name.includes('add') || name.includes('create') || code.includes('add') || code.includes('create')) {
      result.canAdd = true;
    }
    if (name.includes('edit') || name.includes('update') || code.includes('edit') || code.includes('update')) {
      result.canUpdate = true;
    }
    if (name.includes('delete') || name.includes('remove') || code.includes('delete') || code.includes('remove')) {
      result.canDelete = true;
    }
  });
  return result;
};

export const resolveBrandPermissions = (pathOrKey = 'brand') => {
  try {
    const user = authService.getUser();
    if (!user) return { ...EMPTY_PERMISSIONS };
    const role = String(user.role || user.roleName || '').toLowerCase();
    if (['admin', 'administrator', 'superadmin', 'super admin', 'developer'].includes(role) || Number(user.roleId) === 1) {
      return { canView: true, canAdd: true, canUpdate: true, canDelete: true, resolved: true };
    }
    const key = normalize(String(pathOrKey).toLowerCase().split('/').filter(Boolean).pop());
    const aliases = ['template', 'templates', 'brandtemplate', 'brandtemplates', 'brandemailtemplates'].includes(key)
      ? ['brandtemplate', 'brandtemplates', 'brandemailtemplates', 'template']
      : ['brandemail', 'brandemails', 'email'].includes(key)
        ? ['brandemail', 'brandemails']
        : key === 'gateway'
          ? ['gateway', 'gateways']
          : ['brand', 'brands'];
    const codes = getGrantedCodes(user);
    const page = readCachedPages(user).find((item) => {
      const url = String(item.pageUrl || '')
        .toLowerCase()
        .split('?')[0]
        .split('/')
        .filter(Boolean)
        .pop();
      return aliases.includes(normalize(url)) || aliases.includes(normalize(item.pageName || item.pageDisplayName));
    });
    if (page) return permissionsFromPage(page, codes);
    const result = { ...EMPTY_PERMISSIONS };
    codes.forEach((code) => {
      const match = normalize(code).match(/^(?:settings)?(.+?)(view|read|add|create|edit|update|delete|remove)$/);
      if (!match || !aliases.includes(match[1])) return;
      const action = match[2];
      if (['view', 'read'].includes(action)) result.canView = true;
      if (['add', 'create'].includes(action)) result.canAdd = true;
      if (['edit', 'update'].includes(action)) result.canUpdate = true;
      if (['delete', 'remove'].includes(action)) result.canDelete = true;
    });
    return result;
  } catch {
    return { ...EMPTY_PERMISSIONS };
  }
};
