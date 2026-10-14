import menuService from '@/services/menuService';

const normalizePath = (value) => {
  const path = (value || '').toString().trim();
  if (!path) return '';
  return path.startsWith('/') ? path : `/${path}`;
};

const normalizeToken = (value) =>
  (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const getSafePages = async () => {
  try {
    const pages = await menuService.fetchPageItems();
    return Array.isArray(pages) ? pages : [];
  } catch {
    return [];
  }
};

const findPagePath = (pages, predicate, fallback) => {
  const page = (pages || []).find((item) => {
    if (!item?.isActive) return false;
    return predicate(item);
  });
  return normalizePath(page?.pageUrl) || fallback;
};

const PATH_MATCHERS = {
  dashboard: (page) => {
    const url = normalizePath(page?.pageUrl).toLowerCase();
    const name = normalizeToken(page?.pageName || page?.pageDisplayName);
    return (
      url === '/dashboard' ||
      url === '/dashboards' ||
      name === 'dashboard' ||
      name === 'dashboards'
    );
  },
  profile: (page) => {
    const url = normalizePath(page?.pageUrl).toLowerCase();
    const name = normalizeToken(page?.pageName || page?.pageDisplayName);
    return (
      url === '/profile' ||
      url === '/myprofile' ||
      name === 'profile' ||
      name === 'myprofile'
    );
  },
  orders: (page) => {
    const url = normalizePath(page?.pageUrl).toLowerCase();
    const name = normalizeToken(page?.pageName || page?.pageDisplayName);
    return (
      name === 'orders' ||
      (url === '/orders')
    );
  },
  createOrder: (page) => {
    const url = normalizePath(page?.pageUrl).toLowerCase();
    const name = normalizeToken(page?.pageName || page?.pageDisplayName);
    return (
      name.includes('createorder') ||
      (url.includes('/orders') && url.includes('createorder'))
    );
  },
  tickets: (page) => {
    const url = normalizePath(page?.pageUrl).toLowerCase();
    const name = normalizeToken(page?.pageName || page?.pageDisplayName);
    return name === 'tickets' || name === 'ticket' || url === '/tickets';
  },
  callbacks: (page) => {
    const url = normalizePath(page?.pageUrl).toLowerCase();
    const name = normalizeToken(page?.pageName || page?.pageDisplayName);
    return name.includes('callback') || (url.includes('/leads') && url.includes('callback'));
  },
  customer: (page) => {
    const url = normalizePath(page?.pageUrl).toLowerCase();
    const name = normalizeToken(page?.pageName || page?.pageDisplayName);
    return name === 'customer' || name === 'customers' || url === '/customer';
  },
  products: (page) => {
    const url = normalizePath(page?.pageUrl).toLowerCase();
    const name = normalizeToken(page?.pageName || page?.pageDisplayName);
    return name.includes('product') || (url.includes('/orders') && url.includes('product'));
  },
};

export const resolveDynamicPath = async (key, fallback = '') => {
  const matcher = PATH_MATCHERS[key];
  if (!matcher) return fallback;

  const pages = await getSafePages();
  return findPagePath(pages, matcher, fallback);
};

export const resolveDynamicPaths = async (pathConfig = {}) => {
  const pages = await getSafePages();
  const resolved = {};

  for (const [key, fallback] of Object.entries(pathConfig)) {
    const matcher = PATH_MATCHERS[key];
    resolved[key] = matcher ? findPagePath(pages, matcher, fallback) : fallback;
  }

  return resolved;
};

export const resolveDefaultAppPath = async (fallback = '/Dashboards') => {
  try {
    const menu = await menuService.getCompleteMenu();
    if (Array.isArray(menu) && menu.length > 0) {
      const firstPath = normalizePath(menu[0]?.path);
      if (firstPath) return firstPath;
    }
  } catch {
    // fallback to dashboard lookup below
  }

  return resolveDynamicPath('dashboard', fallback);
};


