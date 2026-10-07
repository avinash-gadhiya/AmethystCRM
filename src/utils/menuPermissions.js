import { resolveConfiguredPagePermissions } from '@/utils/configuredPagePermissions';

export const resolveMenuPermissions = (pathOrKey = 'menu') =>
  resolveConfiguredPagePermissions(pathOrKey, ['/settings/menus', 'menu']);

export default resolveMenuPermissions;
