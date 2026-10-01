const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('src/services/brandService.js', 'utf8').replace(/^import .*;\r?\n/gm, '').replace('export const brandService', 'const brandService').replace('export default brandService;', 'globalThis.service = brandService;');
function setup(handler = () => ({ success: true, data: [], totalCount: 0 })) {
  const calls = [];
  const apiClient = Object.fromEntries(['get', 'post', 'put', 'delete'].map(method => [method, async (path, data) => {
    calls.push({ method, path, data });
    return handler(method, path, data);
  }]));
  const context = { apiClient, resizeImageToDataUrl: async () => 'data:image/png;base64,test', console };
  vm.runInNewContext(source, context);
  return { service: context.service, calls };
}
const plain = value => JSON.parse(JSON.stringify(value));
test('normalizes casing and boolean strings while preserving server totals', async () => {
  const { service, calls } = setup(() => ({ Success: true, Data: [{ BrandId: 7, BrandName: 'Brand', IsActive: 'false' }], TotalCount: 31 }));
  const brands = await service.getBrands();
  assert.equal(brands.data[0].brandId, 7);
  assert.equal(brands.data[0].isActive, false);
  assert.equal(brands.totalCount, 31);
  assert.equal(brands.success, true);
  assert.deepEqual(plain(calls[0].data), { Text: '', PageNumber: 1, PageSize: 10, SortProperty: 'brandId', IsDescending: true });
});
test('brand-filtered gateway pagination does not replace the server count with page length', async () => {
  const { service } = setup(() => ({ success: true, data: [{ GatewayId: 4, BrandId: 2 }], totalCount: 51 }));
  assert.equal((await service.getGateways({ BrandId: 2 })).totalCount, 51);
});
test('normal gateway edits omit credentials and explicit edits omit blank credential fields', async () => {
  const { service, calls } = setup();
  await service.updateGateway({ gatewayId: 4, brandId: 2, apiLoginId: 'existing', apiSecretKey: 'existing', isActive: false });
  assert.equal('apiLoginId' in calls[0].data, false);
  assert.equal('apiSecretKey' in calls[0].data, false);
  await service.updateGateway({ gatewayId: 4, brandId: 2, changeCredentials: true, apiLoginId: 'new', apiSecretKey: 'new', merchantSiteId: '' });
  assert.equal(calls[1].data.apiSecretKey, 'new');
  assert.equal('merchantSiteId' in calls[1].data, false);
  assert.equal('changeCredentials' in calls[1].data, false);
});
test('blank email password is omitted during edits', async () => {
  const { service, calls } = setup();
  await service.updateBrandEmail({ brandEmailId: 8, brandId: 2, password: '' });
  assert.equal('password' in calls[0].data, false);
  await service.updateBrandEmail({ brandEmailId: 8, brandId: 2, password: ' replacement ' });
  assert.equal(calls[1].data.password, ' replacement ');
});
test('delete contracts use the exact documented routes', async () => {
  const { service, calls } = setup();
  await service.deleteBrand(2);
  await service.deleteBrandEmail(8);
  await service.deleteGateway(9);
  await service.deleteBrandEmailTemplate(10);
  await service.deleteGatewayPaymentType({ gatewayPaymentTypeId: 11, gatewayId: 9, paymentTypeId: 3 });
  assert.deepEqual(calls.map(c => c.path), ['/Brand', '/BrandEmail/8', '/Gateway', '/BrandEmailTemplates', '/GatewayPaymentType/11']);
  assert.deepEqual(plain(calls[0].data), { id: 2 });
  assert.deepEqual(plain(calls[4].data), { gatewayId: 9, paymentTypeId: 3 });
});
test('dropdown requests deduplicate and mutations invalidate related references', async () => {
  const { service, calls } = setup(() => ({ success: true, data: [{ SettingValueId: 1, SettingValueText: 'Actual type' }], totalCount: 1 }));
  const values = await Promise.all([service.getSaleTypes(), service.getSaleTypes()]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/SettingValue/SettingValueDropDown');
  assert.equal(calls[0].data.settingKey, 'SaleTypes');
  assert.equal(values[0][0].saleTypeName, 'Actual type');
  await service.createBrand({ brandName: 'Example' });
  await service.getSaleTypes();
  assert.equal(calls.length, 3);
});
test('a stale request cannot repopulate a cache after a mutation', async () => {
  let resolveOld;
  let count = 0;
  const { service } = setup((method) => {
    if (method !== 'get') return { success: true };
    if (++count === 1) return new Promise(resolve => { resolveOld = resolve; });
    return { success: true, data: [{ brandId: 2, brandName: 'Current' }], totalCount: 1 };
  });
  const old = service.getBrands();
  await service.createBrand({ brandName: 'Current' });
  await service.getBrands();
  resolveOld({ success: true, data: [{ brandId: 1, brandName: 'Old' }], totalCount: 1 });
  await old;
  assert.equal((await service.getBrands()).data[0].brandName, 'Current');
});
test('reference failures propagate instead of creating fake options', async () => {
  const { service } = setup(() => { throw new Error('Not authorized'); });
  await assert.rejects(service.getSaleTypes(), /Not authorized/);
  await assert.rejects(service.getPaymentTypes(), /Not authorized/);
});
test('templates resolve sender labels using brand-filtered email references and preserve totalCount', async () => {
  const { service, calls } = setup((_method, path) => path === '/BrandEmailTemplates'
    ? { success: true, data: [{ BrandEmailTemplateId: 3, BrandId: 2, FromEmailId: 9 }], totalCount: 40 }
    : { success: true, data: [{ BrandEmailId: 9, Email: 'sender@example.test' }], totalCount: 1 });
  const result = await service.getBrandEmailTemplates({ BrandId: 2 });
  assert.equal(result.totalCount, 40);
  assert.equal(result.data[0].fromEmail, 'sender@example.test');
  assert.equal(calls[1].data.BrandId, 2);
});
test('page permissions cannot leak across brands, child tabs, or another cached user', () => {
  const source = fs.readFileSync('src/utils/brandPermissions.js','utf8').replace(/^import .*;\r?\n/gm,'').replace('export const resolveBrandPermissions','const resolveBrandPermissions') + '\nglobalThis.resolve = resolveBrandPermissions;';
  const storage = {
    'crm_permission_menus:v2:2:12': JSON.stringify([{menuPermissionPageDTOs:[{pageUrl:'/settings/brandemail',menuPagePermissionDTOs:[{permissionName:'View',hasPermission:true},{permissionName:'Delete',hasPermission:false}]}]}]),
    'crm_permission_menus:v2:2:13': JSON.stringify([{menuPermissionPageDTOs:[{pageUrl:'/settings/brand',menuPagePermissionDTOs:[{permissionName:'Delete',hasPermission:true}]}]}])
  };
  const context = { authService: {getUser:()=>({roleId:2,userId:12,role:'Agent',permissionCodes:[]})}, localStorage:{getItem:key=>storage[key] || null} };
  vm.runInNewContext(source,context);
  assert.equal(context.resolve('brandemail').canView,true);
  assert.equal(context.resolve('brandemail').canDelete,false);
  assert.equal(context.resolve('brand').canView,false);
  assert.equal(context.resolve('brand').canDelete,false);
  assert.equal(context.resolve('gateway').canView,false);
});
