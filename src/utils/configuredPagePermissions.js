import authService from '@/services/authService';
import permissionService from '@/services/permissionService';

const DENIED = {
  canView: false,
  canAdd: false,
  canUpdate: false,
  canEdit: false,
  canDelete: false,
  resolved: true
};

const FULL_ACCESS = {
  canView: true,
  canAdd: true,
  canUpdate: true,
  canEdit: true,
  canDelete: true,
  resolved: true
};

const PAGE_ALIASES = {
  page: ['/settings/pages', '/settings/page', 'pages', 'page'],
  menu: ['/settings/menus', '/settings/menu', 'menus', 'menu'],
  template: ['/settings/templates', '/settings/template', 'templates', 'template'],
  location: ['/settings/location', '/settings/locations', 'location', 'locations'],
  group: ['/settings/group', '/settings/groups', 'group', 'groups'],
  groupemail: ['/settings/group-email', '/settings/groupemail', 'group-email', 'groupemail'],
  brand: ['/settings/brand', '/settings/brands', 'brand', 'brands'],
  brandemail: ['/settings/brandemail', '/settings/brand-emails', 'brandemail', 'brand-email'],
  brandtemplate: ['/settings/brand-template', '/settings/brandtemplate', 'brandtemplate', 'brand-template'],
  gateway: ['/settings/gateway', '/gateways', 'gateway', 'gateways'],
  role: ['/settings/roles', '/settings/role', 'roles', 'role'],
  user: ['/settings/users', '/settings/user', '/users', 'users', 'user'],
  ip: ['/settings/ip', '/settings/blockip', '/settings/blocked-ip', 'blockip', 'ip'],
  country: ['/settings/country', '/settings/countries', 'country', 'countries'],
  setting: ['/settings/settings', '/settings/setting', 'settings', 'setting'],
  salestarget: ['/settings/sales-target', '/settings/salestarget', 'sales-target', 'salestarget'],
  customer: ['/customers', '/customer', 'customers', 'customer'],
  ticket: ['/tickets', '/ticket', 'tickets', 'ticket'],
  product: ['/orders/products', '/products', '/product', 'products', 'product'],
  order: ['/orders', '/order', 'orders', 'order']
};

const normalizeKey = (value) =>
  String(value ?? '')
    .split('?')[0]
    .split('/')
    .filter(Boolean)
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, '') || '';

export const resolveConfiguredPagePermissions = (pathOrKey, extraAliases = []) => {
  try {
    const user = authService.getUser();
    if (!user) return { ...DENIED };

    const roleName = String(user.role || user.roleName || '').toLowerCase();
    if (roleName.includes('admin') || roleName.includes('developer') || Number(user.roleId) === 1) {
      return { ...FULL_ACCESS };
    }

    const key = normalizeKey(pathOrKey);
    const aliases = [pathOrKey, ...(PAGE_ALIASES[key] || []), ...extraAliases].filter(Boolean);
    const permissions = permissionService.getPageActionPermissions(aliases, user.roleId);
    return {
      ...permissions,
      canEdit: permissions.canUpdate,
      resolved: true
    };
  } catch {
    return { ...DENIED };
  }
};

export default resolveConfiguredPagePermissions;
