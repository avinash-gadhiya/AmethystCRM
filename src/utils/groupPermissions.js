import { resolveConfiguredPagePermissions } from '@/utils/configuredPagePermissions';

export const resolveGroupPermissions = (pathOrKey = 'group') => {
  const key = String(pathOrKey).toLowerCase().replace(/[^a-z0-9]/g, '');
  return key.includes('email')
    ? resolveConfiguredPagePermissions('groupemail', ['/settings/group-email'])
    : resolveConfiguredPagePermissions('group', ['/settings/group']);
};

export default resolveGroupPermissions;
