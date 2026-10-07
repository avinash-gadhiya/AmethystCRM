import { resolveConfiguredPagePermissions } from '@/utils/configuredPagePermissions';

export const resolveLocationPermissions = (pathOrKey = 'location') =>
  resolveConfiguredPagePermissions(pathOrKey, ['/settings/location', 'location']);

export default resolveLocationPermissions;
