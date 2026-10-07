import { resolveConfiguredPagePermissions } from '@/utils/configuredPagePermissions';

export const resolveGroupEmailPermissions = () =>
  resolveConfiguredPagePermissions('groupemail', ['/settings/group-email']);

export default resolveGroupEmailPermissions;
