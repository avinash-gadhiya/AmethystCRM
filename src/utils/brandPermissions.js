import { resolveConfiguredPagePermissions } from '@/utils/configuredPagePermissions';

export const resolveBrandPermissions = (pathOrKey = 'brand') => {
  const key = String(pathOrKey).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (key.includes('brandtemplate') || key === 'template' || key === 'templates') {
    return resolveConfiguredPagePermissions('brandtemplate', ['/settings/brand-template']);
  }
  if (key.includes('brandemail') || key === 'email') {
    return resolveConfiguredPagePermissions('brandemail', ['/settings/brandemail']);
  }
  if (key.includes('gateway')) {
    return resolveConfiguredPagePermissions('gateway', ['/settings/gateway']);
  }
  return resolveConfiguredPagePermissions('brand', ['/settings/brand']);
};

export default resolveBrandPermissions;
