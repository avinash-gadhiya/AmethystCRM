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
  'system-logs': 'activity',
  tickets: 'ticket',
  users: 'users',
  user: 'user'
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

  const permissionRows = getPermissionRows(page).filter((permission) => permission && normalizeBoolean(permission.isActive) !== false);
  if (permissionRows.length === 0) return true;

  return permissionRows.some((permission) => {
    if (normalizeBoolean(permission.hasPermission) === true) return true;
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
  let gatewayPage = null;

  clonedMenus.forEach((menu) => {
    menu.menuPermissionPageDTOs = menu.menuPermissionPageDTOs.filter((page) => {
      const url = normalizeRoute(page?.pageUrl).toLowerCase();
      const name = String(page?.pageName || page?.pageDisplayName || '')
        .trim()
        .toLowerCase();
      const isSettingsGateway = url === '/settings/gateway' || (name === 'gateway' && !url.includes('dashboard'));
      if (isSettingsGateway && !gatewayPage) gatewayPage = page;
      return !isSettingsGateway;
    });
  });

  if (!gatewayPage) return clonedMenus;

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

  settingsMenu.menuPermissionPageDTOs.push(gatewayPage);
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

    const grantedCodes = getStoredPermissionCodes();
    const menuItems = sortByOrder(
      moveGatewayPageToSettings(permissionMenuDTOs).filter((menu) => menu && normalizeBoolean(menu.isActive) !== false),
      'menuOrder'
    )
      .map((menu, menuIndex) => {
        const pages = sortByOrder(
          (Array.isArray(menu.menuPermissionPageDTOs) ? menu.menuPermissionPageDTOs : []).filter((page) =>
            canDisplayPage(page, grantedCodes)
          ),
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
