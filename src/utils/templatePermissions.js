import { resolveConfiguredPagePermissions } from '@/utils/configuredPagePermissions';

export const resolveTemplatePermissions = (pathOrKey = 'template') =>
  resolveConfiguredPagePermissions(pathOrKey, ['/settings/templates', 'template']);

export default resolveTemplatePermissions;
