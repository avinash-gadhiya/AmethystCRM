import authService from './authService';

const API_BASE_URL = (import.meta.env.VITE_APP_API_URL || 'https://demoapi.enstasol.com/api').replace(/\/$/, '');
const CACHE_PREFIX = 'crm_permission_menus:v2:';

const MENU_ICON_MAP = {
  attendance: 'clock',
  'bk leads': 'phone-call',
  'bk-leads': 'phone-call',
  customers: 'users',
  dashboard: 'layout-dashboard',
  'lead access': 'key',
  'lead-access': 'key',
  'lead scheduler': 'calendar',
  'lead-scheduler': 'calendar',
  leads: 'target',
  'my profile': 'user',
  'my-profile': 'user',
  orders: 'shopping-cart',
  payments: 'credit-card',
  products: 'package',
  reports: 'bar-chart-2',
  settings: 'settings',
  'system logs': 'activity',
  tickets: 'ticket',
  users: 'users',
  user: 'user',
  'blocked ip': 'shield-alert',
  'blocked ip addresses': 'shield-alert',
  blockip: 'shield-alert',
  ip: 'shield-alert',
  brand: 'award',
  brands: 'award',
  branddetails: 'award',
  brandemail: 'mail',
  brandtemplate: 'file-text',
  'brand template': 'file-text',
  'brand templates': 'file-text',
  group: 'layers',
  groups: 'layers',
  groupemail: 'mail',
  'group email': 'mail',
  'group emails': 'mail',
  'group-email': 'mail',
  gateway: 'credit-card',
  gateways: 'credit-card',
  template: 'file-text',
  templates: 'file-text',
  location: 'map-pin',
  locations: 'map-pin',
  country: 'globe',
  countries: 'globe',
  'countries & states': 'globe',
  state: 'map-pin',
  states: 'map-pin',
  page: 'file-text',
  pages: 'file-text',
  menu: 'menu',
  menus: 'menu'
};

const listeners = new Set();
const requests = new Map();

const normalizeBoolean = (value) => {
  if (value === true || value === false) return value;
  if (value === 1 || value === 0) return value === 1;

  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return undefined;
};

const normalizeRoute = (value) => {
  const route = String(value ?? '').trim();
  if (!route || route === '#') return '';
  return route.startsWith('/') ? route : `/${route}`;
};

const normalizeId = (value, fallback) => {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  return normalized.replace(/^-|-$/g, '') || fallback;
};

const parsePermissionCodes = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((permission) => {
        if (typeof permission === 'string') return permission;
        if (permission && normalizeBoolean(permission.hasPermission) !== false) {
          return permission.permissionCode;
        }
        return '';
      })
      .map((code) =>
        String(code ?? '')
          .trim()
          .toLowerCase()
      )
      .filter(Boolean);
  }

  if (typeof value !== 'string') return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsePermissionCodes(parsed);
  } catch {
    // The login API normally returns a comma-separated string.
  }

  return trimmed
    .split(',')
    .map((code) => code.trim().toLowerCase())
    .filter(Boolean);
};

const getStoredPermissionCodes = () => {
  const userCodes = parsePermissionCodes(authService.getUser()?.permissionCodes);
  if (userCodes.length > 0) return new Set(userCodes);

  try {
    return new Set(parsePermissionCodes(localStorage.getItem('permissionCodes')));
  } catch {
    return new Set();
  }
};

const getPermissionRows = (page) => {
  const candidates = [page?.menuPagePermissionDTOs, page?.pagePermissionDTOs, page?.permissions];
  return candidates.find(Array.isArray) || [];
};

const canDisplayPage = (page, grantedCodes) => {
  if (!page || normalizeBoolean(page.isActive) === false || !normalizeRoute(page.pageUrl)) return false;

  const permissionRows = getPermissionRows(page).filter(Boolean);
  if (permissionRows.length === 0) return true;

  const isViewPermission = (permission) => {
    const name = String(permission.permissionName ?? '')
      .trim()
      .toLowerCase();
    const code = String(permission.permissionCode ?? '')
      .trim()
      .toLowerCase();
    return name === 'view' || name === 'read' || name === 'access' || /(?:^|[_:.-])(view|read|list|access)$/.test(code);
  };

  const activePermissions = permissionRows.filter((permission) => normalizeBoolean(permission.isActive) !== false);
  const definedViewPermissions = permissionRows.filter(isViewPermission);
  const visibilityPermissions =
    definedViewPermissions.length > 0
      ? definedViewPermissions.filter((permission) => normalizeBoolean(permission.isActive) !== false)
      : activePermissions;

  // If a page defines a View/Read/Access permission and it is disabled, the
  // page itself must disappear even if another action (such as Edit) is granted.
  if (visibilityPermissions.length === 0) return false;

  return visibilityPermissions.some((permission) => {
    const explicitGrant = normalizeBoolean(permission.hasPermission ?? permission.isGranted);
    if (explicitGrant !== undefined) return explicitGrant;

    const code = String(permission.permissionCode ?? '')
      .trim()
      .toLowerCase();
    return Boolean(code && grantedCodes.has(code));
  });
};

const sortByOrder = (items, property) =>
  items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const leftOrder = Number(left.item?.[property]);
      const rightOrder = Number(right.item?.[property]);
      const safeLeft = Number.isFinite(leftOrder) ? leftOrder : left.index;
      const safeRight = Number.isFinite(rightOrder) ? rightOrder : right.index;
      return safeLeft - safeRight || left.index - right.index;
    })
    .map(({ item }) => item);

const createNavigation = (children = []) => ({
  items: [
    {
      id: 'crm-nav-group',
      title: 'CRM NAVIGATION',
      type: 'group',
      children
    }
  ]
});

const getIconName = (menu) => {
  const menuName = String(menu?.menuName || menu?.menuDisplayName || '')
    .trim()
    .toLowerCase();
  return MENU_ICON_MAP[menuName] || 'folder';
};

const moveGatewayPageToSettings = (menus = []) => {
  const clonedMenus = menus.map((menu) => ({
    ...menu,
    menuPermissionPageDTOs: Array.isArray(menu?.menuPermissionPageDTOs) ? [...menu.menuPermissionPageDTOs] : []
  }));
  // Remove any Settings Gateway pages from navigation menus
  clonedMenus.forEach((menu) => {
    menu.menuPermissionPageDTOs = menu.menuPermissionPageDTOs.filter((page) => {
      const url = normalizeRoute(page?.pageUrl).toLowerCase();
      const name = String(page?.pageName || page?.pageDisplayName || '')
        .trim()
        .toLowerCase();
      const isSettingsGateway = url === '/settings/gateway' || (name === 'gateway' && !url.includes('dashboard'));
      return !isSettingsGateway;
    });
  });

  let settingsMenu = clonedMenus.find((menu) => {
    const name = String(menu?.menuName || menu?.menuDisplayName || '')
      .trim()
      .toLowerCase();
    return name === 'settings' || name === 'setting';
  });

  if (!settingsMenu) {
    settingsMenu = {
      menuId: 'settings-generated',
      menuName: 'Settings',
      menuDisplayName: 'Settings',
      menuOrder: 999,
      isActive: true,
      menuPermissionPageDTOs: []
    };
    clonedMenus.push(settingsMenu);
  }

  // Ensure Gateway option is completely removed from Settings
  settingsMenu.menuPermissionPageDTOs = settingsMenu.menuPermissionPageDTOs.filter((page) => {
    const url = normalizeRoute(page?.pageUrl).toLowerCase();
    const name = String(page?.pageName || page?.pageDisplayName || '')
      .trim()
      .toLowerCase();
    return !url.includes('gateway') && name !== 'gateway' && name !== 'gateways';
  });

  // Ensure Email (Brand Email) option is completely removed from Settings sidebar navigation
  const isEmailNavPage = (page) => {
    const url = normalizeRoute(page?.pageUrl).toLowerCase();
    const name = String(page?.pageName || page?.pageDisplayName || '')
      .trim()
      .toLowerCase();
    if (name.includes('group') || url.includes('group')) return false;
    return (
      url === '/settings/email' ||
      url === '/settings/brandemail' ||
      url === '/settings/brand-emails' ||
      url.includes('brandemail') ||
      url.includes('brand-email') ||
      name === 'email' ||
      name === 'emails' ||
      name === 'brand email' ||
      name === 'brand emails'
    );
  };

  clonedMenus.forEach((menu) => {
    menu.menuPermissionPageDTOs = menu.menuPermissionPageDTOs.filter((page) => !isEmailNavPage(page));
  });
  settingsMenu.menuPermissionPageDTOs = settingsMenu.menuPermissionPageDTOs.filter((page) => !isEmailNavPage(page));

  // Preserve a backend-provided Settings Location URL; add the conventional URL only as a fallback.
  let locationPage = null;
  clonedMenus.forEach((menu) => {
    menu.menuPermissionPageDTOs = menu.menuPermissionPageDTOs.filter((page) => {
      const url = normalizeRoute(page?.pageUrl).toLowerCase();
      const name = String(page?.pageName || page?.pageDisplayName || '')
        .trim()
        .toLowerCase();
      const isLocationPage = name === 'location' || name === 'locations' || (url.includes('/settings/') && url.includes('location'));
      if (isLocationPage && !locationPage) locationPage = page;
      return !isLocationPage;
    });
  });

  settingsMenu.menuPermissionPageDTOs.push(
    locationPage || {
      pageId: 'settings-location',
      pageName: 'Locations',
      pageDisplayName: 'Locations',
      pageUrl: '/settings/location',
      pageOrder: 93,
      isActive: true,
      menuPagePermissionDTOs: [
        { permissionName: 'View', permissionCode: 'location_view', isActive: true, hasPermission: true },
        { permissionName: 'Add', permissionCode: 'location_add', isActive: true, hasPermission: true },
        { permissionName: 'Edit', permissionCode: 'location_edit', isActive: true, hasPermission: true },
        { permissionName: 'Delete', permissionCode: 'location_delete', isActive: true, hasPermission: true }
      ]
    }
  );

  // Filter out Brand Template from sidebar navigation (accessible via Brands tab)
  clonedMenus.forEach((menu) => {
    menu.menuPermissionPageDTOs = menu.menuPermissionPageDTOs.filter((page) => {
      const url = normalizeRoute(page?.pageUrl)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      const name = String(page?.pageName || page?.pageDisplayName || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      return !(name === 'brandtemplate' || name === 'brandtemplates' || url.includes('brandtemplate'));
    });
  });
  settingsMenu.menuPermissionPageDTOs = settingsMenu.menuPermissionPageDTOs.filter((page) => {
    const url = normalizeRoute(page?.pageUrl)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const name = String(page?.pageName || page?.pageDisplayName || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    return !(name === 'brandtemplate' || name === 'brandtemplates' || url.includes('brandtemplate'));
  });

  // Ensure Blocked IP page is registered under Settings navigation
  const hasBlockedIpPage = settingsMenu.menuPermissionPageDTOs.some((page) => {
    const u = normalizeRoute(page?.pageUrl).toLowerCase();
    return u === '/settings/ip' || u === '/settings/blockip' || u.includes('blockip');
  });

  if (!hasBlockedIpPage) {
    settingsMenu.menuPermissionPageDTOs.push({
      pageId: 'settings-blocked-ip',
      pageName: 'Blocked IP Addresses',
      pageDisplayName: 'Blocked IP Addresses',
      pageUrl: '/settings/ip',
      pageOrder: 80,
      isActive: true,
      menuPagePermissionDTOs: [
        { permissionName: 'View', permissionCode: 'blockip_view', isActive: true, hasPermission: true },
        { permissionName: 'Add', permissionCode: 'blockip_add', isActive: true, hasPermission: true },
        { permissionName: 'Edit', permissionCode: 'blockip_edit', isActive: true, hasPermission: true },
        { permissionName: 'Delete', permissionCode: 'blockip_delete', isActive: true, hasPermission: true }
      ]
    });
  }

  // Ensure Countries & States page is registered under Settings navigation
  const hasCountryPage = settingsMenu.menuPermissionPageDTOs.some((page) => {
    const u = normalizeRoute(page?.pageUrl).toLowerCase();
    return u === '/settings/country' || u === '/settings/countries' || u.includes('country');
  });

  if (!hasCountryPage) {
    settingsMenu.menuPermissionPageDTOs.push({
      pageId: 'settings-country',
      pageName: 'Countries & States',
      pageDisplayName: 'Countries & States',
      pageUrl: '/settings/country',
      pageOrder: 85,
      isActive: true,
      menuPagePermissionDTOs: [
        { permissionName: 'View', permissionCode: 'country_view', isActive: true, hasPermission: true },
        { permissionName: 'Add', permissionCode: 'country_add', isActive: true, hasPermission: true },
        { permissionName: 'Edit', permissionCode: 'country_edit', isActive: true, hasPermission: true },
        { permissionName: 'Delete', permissionCode: 'country_delete', isActive: true, hasPermission: true }
      ]
    });
  }

  // Ensure Settings configuration manager is registered under Settings navigation
  const hasSettingsConfigPage = settingsMenu.menuPermissionPageDTOs.some((page) => {
    const u = normalizeRoute(page?.pageUrl).toLowerCase();
    return u === '/settings/settings' || u === '/settings/setting' || u === '/setting';
  });

  if (!hasSettingsConfigPage) {
    settingsMenu.menuPermissionPageDTOs.push({
      pageId: 'settings-configuration',
      pageName: 'Settings',
      pageDisplayName: 'Settings',
      pageUrl: '/settings/settings',
      pageOrder: 10,
      isActive: true,
      menuPagePermissionDTOs: [
        { permissionName: 'View', permissionCode: 'setting_view', isActive: true, hasPermission: true },
        { permissionName: 'Add', permissionCode: 'setting_add', isActive: true, hasPermission: true },
        { permissionName: 'Edit', permissionCode: 'setting_edit', isActive: true, hasPermission: true },
        { permissionName: 'Delete', permissionCode: 'setting_delete', isActive: true, hasPermission: true }
      ]
    });
  }

  // Ensure Brands management page is registered under Settings navigation
  const hasBrandPage = settingsMenu.menuPermissionPageDTOs.some((page) => {
    const u = normalizeRoute(page?.pageUrl).toLowerCase();
    const name = String(page?.pageName || page?.pageDisplayName || '')
      .trim()
      .toLowerCase();
    return u === '/settings/brand' || u === '/settings/brands' || name === 'brand' || name === 'brands';
  });

  if (!hasBrandPage) {
    settingsMenu.menuPermissionPageDTOs.push({
      pageId: 'settings-brand',
      pageName: 'Brands',
      pageDisplayName: 'Brands',
      pageUrl: '/settings/brand',
      pageOrder: 88,
      isActive: true,
      menuPagePermissionDTOs: [
        { permissionName: 'View', permissionCode: 'brand_view', isActive: true, hasPermission: true },
        { permissionName: 'Add', permissionCode: 'brand_add', isActive: true, hasPermission: true },
        { permissionName: 'Edit', permissionCode: 'brand_edit', isActive: true, hasPermission: true },
        { permissionName: 'Delete', permissionCode: 'brand_delete', isActive: true, hasPermission: true }
      ]
    });
  }

  // Ensure Sales Target is available in Settings even when the permission API omits a navigation record.
  const hasSalesTargetPage = settingsMenu.menuPermissionPageDTOs.some((page) => {
    const url = normalizeRoute(page?.pageUrl)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const name = String(page?.pageName || page?.pageDisplayName || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    return url.includes('salestarget') || name === 'salestarget' || name === 'salestargets';
  });

  if (!hasSalesTargetPage) {
    settingsMenu.menuPermissionPageDTOs.push({
      pageId: 'settings-sales-target',
      pageName: 'Sales Target',
      pageDisplayName: 'Sales Target',
      pageUrl: '/settings/sales-target',
      pageOrder: 94,
      isActive: true,
      menuPagePermissionDTOs: [
        { permissionName: 'View', permissionCode: 'salestarget_view', isActive: true, hasPermission: true },
        { permissionName: 'Add', permissionCode: 'salestarget_add', isActive: true, hasPermission: true },
        { permissionName: 'Edit', permissionCode: 'salestarget_edit', isActive: true, hasPermission: true }
      ]
    });
  }

  // Ensure Groups management page is registered under Settings navigation
  const hasGroupPage = settingsMenu.menuPermissionPageDTOs.some((page) => {
    const u = normalizeRoute(page?.pageUrl).toLowerCase();
    return u === '/settings/group' || u === '/settings/groups' || u.includes('group');
  });

  if (!hasGroupPage) {
    settingsMenu.menuPermissionPageDTOs.push({
      pageId: 'settings-group',
      pageName: 'Groups',
      pageDisplayName: 'Groups',
      pageUrl: '/settings/group',
      pageOrder: 89,
      isActive: true,
      menuPagePermissionDTOs: [
        { permissionName: 'View', permissionCode: 'group_view', isActive: true, hasPermission: true },
        { permissionName: 'Add', permissionCode: 'group_add', isActive: true, hasPermission: true },
        { permissionName: 'Edit', permissionCode: 'group_edit', isActive: true, hasPermission: true },
        { permissionName: 'Delete', permissionCode: 'group_delete', isActive: true, hasPermission: true }
      ]
    });
  }

  // Ensure Pages management page is registered under Settings navigation
  const hasPagesPage = settingsMenu.menuPermissionPageDTOs.some((page) => {
    const u = normalizeRoute(page?.pageUrl).toLowerCase();
    return u === '/settings/pages' || u === '/settings/page' || u.includes('pages');
  });

  if (!hasPagesPage) {
    settingsMenu.menuPermissionPageDTOs.push({
      pageId: 'settings-pages',
      pageName: 'Pages',
      pageDisplayName: 'Pages',
      pageUrl: '/settings/pages',
      pageOrder: 90,
      isActive: true,
      menuPagePermissionDTOs: [
        { permissionName: 'View', permissionCode: 'page_view', isActive: true, hasPermission: true },
        { permissionName: 'Add', permissionCode: 'page_add', isActive: true, hasPermission: true },
        { permissionName: 'Edit', permissionCode: 'page_edit', isActive: true, hasPermission: true },
        { permissionName: 'Delete', permissionCode: 'page_delete', isActive: true, hasPermission: true }
      ]
    });
  }

  // Ensure Menus management page is registered under Settings navigation
  const hasMenusPage = settingsMenu.menuPermissionPageDTOs.some((page) => {
    const u = normalizeRoute(page?.pageUrl).toLowerCase();
    return u === '/settings/menus' || u === '/settings/menu' || u.includes('menus');
  });

  if (!hasMenusPage) {
    settingsMenu.menuPermissionPageDTOs.push({
      pageId: 'settings-menus',
      pageName: 'Menus',
      pageDisplayName: 'Menus',
      pageUrl: '/settings/menus',
      pageOrder: 91,
      isActive: true,
      menuPagePermissionDTOs: [
        { permissionName: 'View', permissionCode: 'menu_view', isActive: true, hasPermission: true },
        { permissionName: 'Add', permissionCode: 'menu_add', isActive: true, hasPermission: true },
        { permissionName: 'Edit', permissionCode: 'menu_edit', isActive: true, hasPermission: true },
        { permissionName: 'Delete', permissionCode: 'menu_delete', isActive: true, hasPermission: true }
      ]
    });
  }

  // Ensure Templates management page is registered under Settings navigation
  const hasTemplatesPage = settingsMenu.menuPermissionPageDTOs.some((page) => {
    const u = normalizeRoute(page?.pageUrl).toLowerCase();
    return (u === '/settings/templates' || u === '/settings/template' || u.includes('template')) && !u.includes('brand');
  });

  if (!hasTemplatesPage) {
    settingsMenu.menuPermissionPageDTOs.push({
      pageId: 'settings-templates',
      pageName: 'Template',
      pageDisplayName: 'Template',
      pageUrl: '/settings/templates',
      pageOrder: 92,
      isActive: true,
      menuPagePermissionDTOs: [
        { permissionName: 'View', permissionCode: 'template_view', isActive: true, hasPermission: true },
        { permissionName: 'Add', permissionCode: 'template_add', isActive: true, hasPermission: true },
        { permissionName: 'Edit', permissionCode: 'template_edit', isActive: true, hasPermission: true },
        { permissionName: 'Delete', permissionCode: 'template_delete', isActive: true, hasPermission: true }
      ]
    });
  }

  // Filter out Group Email from sidebar navigation (accessible via Groups tab)
  clonedMenus.forEach((menu) => {
    menu.menuPermissionPageDTOs = menu.menuPermissionPageDTOs.filter((page) => {
      const url = normalizeRoute(page?.pageUrl)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      const name = String(page?.pageName || page?.pageDisplayName || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      return !(name === 'groupemail' || name === 'groupemails' || url.includes('groupemail') || url.includes('group-email'));
    });
  });
  settingsMenu.menuPermissionPageDTOs = settingsMenu.menuPermissionPageDTOs.filter((page) => {
    const url = normalizeRoute(page?.pageUrl)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const name = String(page?.pageName || page?.pageDisplayName || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    return !(name === 'groupemail' || name === 'groupemails' || url.includes('groupemail') || url.includes('group-email'));
  });

  // Ensure Locations management page is registered under Settings navigation
  const hasLocationsPage = settingsMenu.menuPermissionPageDTOs.some((page) => {
    const u = normalizeRoute(page?.pageUrl).toLowerCase();
    const name = String(page?.pageName || page?.pageDisplayName || '')
      .trim()
      .toLowerCase();
    return u === '/settings/location' || u === '/settings/locations' || name === 'location' || name === 'locations';
  });

  if (!hasLocationsPage) {
    settingsMenu.menuPermissionPageDTOs.push({
      pageId: 'settings-locations',
      pageName: 'Locations',
      pageDisplayName: 'Locations',
      pageUrl: '/settings/location',
      pageOrder: 93,
      isActive: true,
      menuPagePermissionDTOs: [
        { permissionName: 'View', permissionCode: 'location_view', isActive: true, hasPermission: true },
        { permissionName: 'Add', permissionCode: 'location_add', isActive: true, hasPermission: true },
        { permissionName: 'Edit', permissionCode: 'location_edit', isActive: true, hasPermission: true },
        { permissionName: 'Delete', permissionCode: 'location_delete', isActive: true, hasPermission: true }
      ]
    });
  }

  return clonedMenus;
};

const extractMenuDTOs = (payload, roleId) => {
  let data = payload;
  for (let depth = 0; depth < 3 && data && !Array.isArray(data) && !data.permissionMenuDTOs; depth += 1) {
    data = data.data;
  }

  const roleNodes = Array.isArray(data) ? data : data ? [data] : [];
  const matchingNodes = roleNodes.filter((node) => {
    if (!node || !Array.isArray(node.permissionMenuDTOs)) return false;
    const nodeRoleId = Number(node.roleId);
    return !nodeRoleId || !roleId || nodeRoleId === Number(roleId);
  });

  return matchingNodes.flatMap((node) => node.permissionMenuDTOs);
};

const getIdentity = (targetRoleId) => {
  const user = authService.getUser();
  const roleId = Number(targetRoleId ?? user?.roleId ?? localStorage.getItem('roleId')) || 0;
  const userId = Number(user?.userId ?? localStorage.getItem('userId')) || 0;
  return { roleId, userId };
};

const getCacheKey = ({ roleId, userId }) => `${CACHE_PREFIX}${roleId}:${userId}`;

const findFirstUrl = (items = []) => {
  for (const item of items) {
    if (item?.url) return item.url;
    const childUrl = findFirstUrl(item?.children || []);
    if (childUrl) return childUrl;
  }
  return '';
};

const containsUrl = (items = [], requestedPath = '') => {
  const normalizedPath = normalizeRoute(requestedPath).toLowerCase();
  if (!normalizedPath) return false;

  return items.some((item) => {
    if (normalizeRoute(item?.url).toLowerCase() === normalizedPath) return true;
    return containsUrl(item?.children || [], normalizedPath);
  });
};

export const permissionService = {
  transformMenuDTOsToNavItems(permissionMenuDTOs = []) {
    if (!Array.isArray(permissionMenuDTOs)) return createNavigation();

    const isProfileMenu = (menu) => {
      const name = String(menu?.menuName || menu?.menuDisplayName || '')
        .trim()
        .toLowerCase()
        .replace(/[\s-_]/g, '');
      if (name === 'myprofile' || name === 'profile') return true;
      if (Array.isArray(menu?.menuPermissionPageDTOs)) {
        return menu.menuPermissionPageDTOs.some((p) => {
          const url = normalizeRoute(p?.pageUrl)
            .toLowerCase()
            .replace(/[\s-_]/g, '');
          const pName = String(p?.pageName || p?.pageDisplayName || '')
            .trim()
            .toLowerCase()
            .replace(/[\s-_]/g, '');
          return url === '/myprofile' || url === '/profile' || pName === 'myprofile';
        });
      }
      return false;
    };

    const isProfilePage = (page) => {
      const url = normalizeRoute(page?.pageUrl)
        .toLowerCase()
        .replace(/[\s-_]/g, '');
      const name = String(page?.pageName || page?.pageDisplayName || '')
        .trim()
        .toLowerCase()
        .replace(/[\s-_]/g, '');
      return url === '/myprofile' || url === '/profile' || name === 'myprofile' || name === 'profile';
    };

    const isSidebarExcludedPage = (page) => {
      const url = normalizeRoute(page?.pageUrl)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      const name = String(page?.pageName || page?.pageDisplayName || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      return (
        name === 'brandtemplate' ||
        name === 'brandtemplates' ||
        url.includes('brandtemplate') ||
        name === 'groupemail' ||
        name === 'groupemails' ||
        url.includes('groupemail') ||
        url.includes('group-email')
      );
    };

    const grantedCodes = getStoredPermissionCodes();
    const menuItems = sortByOrder(
      moveGatewayPageToSettings(permissionMenuDTOs).filter(
        (menu) => menu && normalizeBoolean(menu.isActive) !== false && !isProfileMenu(menu)
      ),
      'menuOrder'
    )
      .map((menu, menuIndex) => {
        const pages = sortByOrder(
          (Array.isArray(menu.menuPermissionPageDTOs) ? menu.menuPermissionPageDTOs : []).filter((page) => {
            // Never expose client-generated fallback pages. Real pages must come
            // from the permission API so role revocations remain authoritative.
            if (String(page?.pageId ?? '').startsWith('settings-')) return false;
            return canDisplayPage(page, grantedCodes) && !isProfilePage(page) && !isSidebarExcludedPage(page);
          }),
          'pageOrder'
        );

        if (pages.length === 0) return null;

        const title = menu.menuDisplayName || menu.menuName || 'Menu';
        const id = normalizeId(menu.menuId || menu.menuName || title, `menu-${menuIndex}`);
        const common = {
          id,
          title,
          icon: 'material-icons-two-tone',
          iconname: getIconName(menu)
        };

        if (pages.length === 1) {
          return { ...common, type: 'item', url: normalizeRoute(pages[0].pageUrl) };
        }

        return {
          ...common,
          type: 'collapse',
          children: pages.map((page, pageIndex) => ({
            id: `${id}-${normalizeId(page.pageId || page.pageName || page.pageDisplayName, `page-${pageIndex}`)}`,
            title: page.pageDisplayName || page.pageName || 'Page',
            type: 'item',
            url: normalizeRoute(page.pageUrl)
          }))
        };
      })
      .filter(Boolean);

    return createNavigation(menuItems);
  },

  async fetchPermissions(targetRoleId, { force = false } = {}) {
    const identity = getIdentity(targetRoleId);
    if (!identity.roleId || !authService.getToken()) return this.getNavigation(targetRoleId);

    const requestKey = getCacheKey(identity);
    if (!force && requests.has(requestKey)) return requests.get(requestKey);

    const request = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/Permission?roleId=${encodeURIComponent(identity.roleId)}`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${authService.getToken()}`
          }
        });

        if (!response.ok) throw new Error(`Permission request failed with status ${response.status}`);

        const payload = await response.json();
        if (payload?.success === false) throw new Error(payload.message || 'Permission request was rejected');

        const permissionMenuDTOs = extractMenuDTOs(payload, identity.roleId);
        localStorage.setItem(requestKey, JSON.stringify(permissionMenuDTOs));

        const navigation = this.transformMenuDTOsToNavItems(permissionMenuDTOs);
        this.notify(navigation);
        return navigation;
      } catch (error) {
        console.error('Unable to load sidebar permissions:', error);
        const navigation = this.getNavigation(targetRoleId);
        this.notify(navigation);
        return navigation;
      } finally {
        requests.delete(requestKey);
      }
    })();

    requests.set(requestKey, request);
    return request;
  },

  getNavigation(targetRoleId) {
    const identity = getIdentity(targetRoleId);
    if (!identity.roleId) return createNavigation();

    try {
      const cached = localStorage.getItem(getCacheKey(identity));
      const permissionMenuDTOs = cached ? JSON.parse(cached) : [];
      return this.transformMenuDTOsToNavItems(permissionMenuDTOs);
    } catch {
      return createNavigation();
    }
  },

  getFirstAvailablePath(navigation = this.getNavigation()) {
    return findFirstUrl(navigation?.items || []);
  },

  hasPath(path, navigation = this.getNavigation()) {
    const normalized = normalizeRoute(path).toLowerCase();
    if (
      normalized === '/myprofile' ||
      normalized === '/profile' ||
      normalized === '/settings/brand-template' ||
      normalized === '/settings/group-email' ||
      normalized === '/settings/groupemail' ||
      normalized.includes('brandtemplate') ||
      normalized.includes('groupemail')
    ) {
      return true;
    }
    return containsUrl(navigation?.items || [], path);
  },

  clearCache() {
    requests.clear();
    try {
      Object.keys(localStorage)
        .filter((key) => key.startsWith(CACHE_PREFIX) || key === 'crm_permission_menus')
        .forEach((key) => localStorage.removeItem(key));
    } catch {
      // Storage may be unavailable in restricted browser contexts.
    }
  },

  subscribe(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
  },

  notify(navigation) {
    listeners.forEach((callback) => {
      try {
        callback(navigation);
      } catch (error) {
        console.error('Sidebar permission subscriber failed:', error);
      }
    });
  }
};

export default permissionService;
