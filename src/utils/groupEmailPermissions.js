import authService from '@/services/authService';

/**
 * Resolves permissions for Group Email management.
 * Primary path: /settings/group-email
 * Fallback path: /settings/group
 * Strictly adheres to the fail-closed principle.
 *
 * @param {string} pathOrKey - Tab key or permission path ('group-email', 'groupemail')
 * @returns {{ canView: boolean, canAdd: boolean, canUpdate: boolean, canDelete: boolean, resolved: boolean }}
 */
export const resolveGroupEmailPermissions = (pathOrKey = 'group-email') => {
  try {
    const user = authService.getUser();
    if (!user) {
      return { canView: false, canAdd: false, canUpdate: false, canDelete: false, resolved: true };
    }

    const roleName = String(user.role || user.roleName || '').toLowerCase();
    const isSuperAdmin =
      roleName.includes('admin') ||
      roleName.includes('developer') ||
      Number(user.roleId) === 1;

    // Super admin and developer roles have full administrative privileges
    if (isSuperAdmin) {
      return { canView: true, canAdd: true, canUpdate: true, canDelete: true, resolved: true };
    }

    const key = String(pathOrKey || '')
      .toLowerCase()
      .replace('/settings/', '')
      .replace(/^\/+|\/+$/g, '')
      .replace(/[^a-z0-9]/g, '');

    // Collect granted permission codes
    const grantedCodes = new Set();
    const userCodes = Array.isArray(user.permissionCodes)
      ? user.permissionCodes
      : typeof user.permissionCodes === 'string'
      ? user.permissionCodes.split(',')
      : [];
    userCodes.forEach((c) => grantedCodes.add(String(c).trim().toLowerCase()));

    try {
      const localCodes = JSON.parse(localStorage.getItem('permissionCodes') || '[]');
      if (Array.isArray(localCodes)) {
        localCodes.forEach((c) => grantedCodes.add(String(c).trim().toLowerCase()));
      }
    } catch {}

    // Check cached permission menus
    let pagePermissions = null;
    let fallbackPermissions = null;

    try {
      const cacheKeys = Object.keys(localStorage).filter(
        (k) => k.startsWith('crm_permission_menus:') || k === 'crm_permission_menus'
      );
      for (const k of cacheKeys) {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const menus = JSON.parse(raw);
        if (!Array.isArray(menus)) continue;
        for (const menu of menus) {
          const pages = menu.menuPermissionPageDTOs || [];
          for (const page of pages) {
            const url = String(page.pageUrl || '').toLowerCase();
            const name = String(page.pageName || page.pageDisplayName || '').toLowerCase();
            const cleanUrl = url.replace(/[^a-z0-9]/g, '');
            const cleanName = name.replace(/[^a-z0-9]/g, '');

            const isExactGroupEmail =
              cleanUrl.includes('groupemail') ||
              cleanName.includes('groupemail') ||
              (key && (cleanUrl.includes(key) || cleanName.includes(key)));

            if (isExactGroupEmail) {
              pagePermissions = page.menuPagePermissionDTOs || page.pagePermissionDTOs || [];
              break;
            }

            // Fallback match: /settings/group
            if (!fallbackPermissions && (cleanUrl.includes('group') || cleanName.includes('group'))) {
              fallbackPermissions = page.menuPagePermissionDTOs || page.pagePermissionDTOs || [];
            }
          }
          if (pagePermissions) break;
        }
        if (pagePermissions) break;
      }
    } catch (e) {
      console.warn('Error reading permission menus:', e);
    }

    const effectivePermissions = pagePermissions || fallbackPermissions;

    let canView = false;
    let canAdd = false;
    let canUpdate = false;
    let canDelete = false;

    if (effectivePermissions && effectivePermissions.length > 0) {
      effectivePermissions.forEach((p) => {
        const pName = String(p.permissionName || p.name || '').toLowerCase();
        const pCode = String(p.permissionCode || '').toLowerCase();
        const isGranted = Boolean(p.hasPermission) || (pCode && grantedCodes.has(pCode));

        if (
          pName.includes('view') ||
          pName.includes('read') ||
          pCode.includes('view') ||
          pCode.includes('read')
        ) {
          if (isGranted) canView = true;
        }
        if (
          pName.includes('add') ||
          pName.includes('create') ||
          pCode.includes('add') ||
          pCode.includes('create')
        ) {
          if (isGranted) canAdd = true;
        }
        if (
          pName.includes('edit') ||
          pName.includes('update') ||
          pCode.includes('edit') ||
          pCode.includes('update')
        ) {
          if (isGranted) canUpdate = true;
        }
        if (
          pName.includes('delete') ||
          pName.includes('remove') ||
          pCode.includes('delete') ||
          pCode.includes('remove')
        ) {
          if (isGranted) canDelete = true;
        }
      });
    } else if (grantedCodes.size > 0) {
      for (const code of grantedCodes) {
        if (code.includes('groupemail') || code.includes('group') || code.includes('settings')) {
          if (code.includes('view') || code.includes('read')) canView = true;
          if (code.includes('add') || code.includes('create')) canAdd = true;
          if (code.includes('edit') || code.includes('update')) canUpdate = true;
          if (code.includes('delete') || code.includes('remove')) canDelete = true;
        }
      }
      if (
        grantedCodes.has('settings') ||
        grantedCodes.has('groupemail') ||
        grantedCodes.has('group')
      ) {
        canView = true;
        canAdd = true;
        canUpdate = true;
        canDelete = true;
      }
    } else {
      canView = false;
      canAdd = false;
      canUpdate = false;
      canDelete = false;
    }

    return { canView, canAdd, canUpdate, canDelete, resolved: true };
  } catch {
    return { canView: false, canAdd: false, canUpdate: false, canDelete: false, resolved: true };
  }
};

export default resolveGroupEmailPermissions;
