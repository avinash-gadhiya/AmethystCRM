import authService from '@/services/authService';

/**
 * Resolves permissions for Template management.
 * Adheres strictly to the fail-closed principle.
 *
 * @param {string} pathOrKey - Tab key or permission path ('template', 'templates')
 * @returns {{ canView: boolean, canAdd: boolean, canUpdate: boolean, canDelete: boolean, resolved: boolean }}
 */
export const resolveTemplatePermissions = (pathOrKey = 'template') => {
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
      .replace(/^\/+|\/+$/g, '');

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

            const isMatch =
              url.includes('template') ||
              name.includes('template') ||
              url.includes(key) ||
              name.includes(key);

            if (isMatch) {
              pagePermissions = page.menuPagePermissionDTOs || page.pagePermissionDTOs || [];
              break;
            }
          }
          if (pagePermissions) break;
        }
        if (pagePermissions) break;
      }
    } catch (e) {
      console.warn('Error reading permission menus:', e);
    }

    let canView = false;
    let canAdd = false;
    let canUpdate = false;
    let canDelete = false;

    if (pagePermissions && pagePermissions.length > 0) {
      pagePermissions.forEach((p) => {
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
        if (code.includes('template') || code.includes('settings')) {
          if (code.includes('view') || code.includes('read')) canView = true;
          if (code.includes('add') || code.includes('create')) canAdd = true;
          if (code.includes('edit') || code.includes('update')) canUpdate = true;
          if (code.includes('delete') || code.includes('remove')) canDelete = true;
        }
      }
      if (
        grantedCodes.has('settings') ||
        grantedCodes.has('template') ||
        grantedCodes.has('templates')
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
  } catch (error) {
    return { canView: false, canAdd: false, canUpdate: false, canDelete: false, resolved: true };
  }
};

export default resolveTemplatePermissions;
