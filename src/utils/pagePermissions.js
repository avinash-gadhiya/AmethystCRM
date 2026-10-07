import { resolveConfiguredPagePermissions } from '@/utils/configuredPagePermissions';

export const resolvePagePermissions = (pathOrKey = 'page') =>
  resolveConfiguredPagePermissions(pathOrKey, ['/settings/pages', 'page']);

export default resolvePagePermissions;
