import { resolveConfiguredPagePermissions } from '@/utils/configuredPagePermissions';

export const resolveBrandTemplatePermissions = () =>
  resolveConfiguredPagePermissions('brandtemplate', ['/settings/brand-template']);

export default resolveBrandTemplatePermissions;
