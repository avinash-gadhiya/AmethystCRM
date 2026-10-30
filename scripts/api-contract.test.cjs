const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { transformSync } = require('esbuild');
const contract = require('../src/services/catalog/crmApiContract.json');
const plain = (value) => JSON.parse(JSON.stringify(value));

function load(file, overrides = {}, cache = new Map()) {
  if (cache.has(file)) return cache.get(file);
  if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const source = fs.readFileSync(file, 'utf8').replaceAll('import.meta.env', '({ VITE_APP_API_URL: "https://test.invalid/api" })');
  const code = transformSync(source, { loader: 'jsx', format: 'cjs' }).code;
  const context = { module: { exports: {} }, console, URLSearchParams, AbortController, FormData, Blob,
    localStorage: { getItem: (key) => key === 'userId' ? '1' : null },
    require(name) {
      if (name in overrides) return overrides[name];
      const target = name.startsWith('@/') ? path.join('src', name.slice(2)) : name.startsWith('.') ? path.join(path.dirname(file), name) : null;
      if (!target) throw new Error('Unexpected dependency: ' + name);
      return load(/\.(js|json)$/.test(target) ? target : target + '.js', overrides, cache);
    }
  };
  vm.runInNewContext(code, context, { filename: file });
  cache.set(file, context.module.exports);
  return context.module.exports;
}

function setup(handler = () => ({ data: [], totalCount: 0 })) {
  const calls = [];
  const execute = async (method, route, params, data) => {
    route = route.replace('https://test.invalid/api', '');
    const key = Object.keys(contract.operations).find((entry) => {
      const [verb, pattern] = entry.split(' ');
      return method === verb && new RegExp('^' + pattern.replace(/\{[^}]+\}/g, '[^/]+') + '$', 'i').test(route);
    });
    assert.ok(key, `${method} ${route} is documented`);
    const operation = contract.operations[key];
    for (const name of Object.keys(params || {})) {
      assert.ok(operation.query.some((allowed) => allowed.toLowerCase() === name.toLowerCase()), `${name} is supported by ${key}`);
    }
    if (data && operation.bodyFields) {
      assert.equal(Array.isArray(data), operation.bodyArray, key + ' body container matches Swagger');
      for (const row of Array.isArray(data) ? data : [data]) {
        for (const field of Object.keys(row)) assert.ok(operation.bodyFields.includes(field), `${field} belongs to ${key}'s DTO`);
      }
    }
    const call = { method, path: route, params, data };
    calls.push(call);
    return handler(call);
  };
  const api = {
    get: (route, params) => execute('GET', route, params),
    post: (route, data, params) => execute('POST', route, params, data),
    put: (route, data, params) => execute('PUT', route, params, data),
    delete: (route, params) => execute('DELETE', route, params),
    request: (route, config = {}) => execute(config.method || 'GET', route, config.params, config.data)
  };
  const axios = {
    get: async (route, config) => ({ data: await execute('GET', route, config?.params) }),
    delete: async (route, config) => ({ data: await execute('DELETE', route, config?.params) }),
    post: async (route, data, config) => ({ data: await execute('POST', route, config?.params, data) }),
    put: async (route, data, config) => ({ data: await execute('PUT', route, config?.params, data) })
  };
  const overrides = {
    './core/apiClient': { __esModule: true, default: api },
    axios: { __esModule: true, default: axios },
    './http': { getAuthHeaders: () => ({}), deleteById: async (route, id) => ({ data: await execute('DELETE', route, { id }) }) },
    './permissionService': { __esModule: true, default: { clearCache() {} } }
  };
  return { calls, service: (name) => load(`src/services/${name}Service.js`, overrides).default };
}

test('API workspace catalog covers every documented operation exactly and excludes sending mail from bulk reads', () => {
  const { CRM_API_OPERATIONS } = load('src/services/catalog/crmApiCatalog.js');
  const keys = CRM_API_OPERATIONS.map((operation) => `${operation.method} ${operation.path}`);
  assert.deepEqual([...keys].sort(), Object.keys(contract.operations).sort());
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(CRM_API_OPERATIONS.filter((operation) => /SendMail|SendPandaDocMail|GetFullUrl/.test(operation.path)).every((operation) => !operation.safeRead));
});

test('workspace query defaults use endpoint-specific dates, pagination, and no unrelated fields', () => {
  const { getOperationQuery } = load('src/lib/apiOperationQuery.js');
  const candidates = { FromDate: '2026-10-01', ToDate: '2026-10-30', PageNumber: 2, PageSize: 10, Text: 'x', BrandId: 9 };
  assert.deepEqual(plain(getOperationQuery('GET', '/Dashboard/MonthlyFinancialData', candidates)), { fromdate: '2026-10-01', todate: '2026-10-30' });
  assert.deepEqual(plain(getOperationQuery('GET', '/Dashboard/ServiceManagerDashBoard', candidates)), { fromdate: '2026-10-01', todate: '2026-10-30', pageNo: 2, PageSize: 10 });
  for (const [key, operation] of Object.entries(contract.operations)) {
    const [method, route] = key.split(' ');
    const query = getOperationQuery(method, route, candidates);
    assert.ok(Object.keys(query).every((name) => operation.query.includes(name)), key);
  }
});

test('API request bodies follow JSON array and multipart contracts for shares, refund uploads, and tickets', () => {
  const { buildOperationBody } = load('src/lib/apiOperationBody.js');
  assert.throws(() => buildOperationBody('POST', '/SharePayment', {}), /array of objects/);
  assert.deepEqual(plain(buildOperationBody('POST', '/SharePayment', [{ paymentId: 1, shareWithId: 2, amount: 10 }])), [{ paymentId: 1, shareWithId: 2, amount: 10 }]);
  assert.throws(() => buildOperationBody('POST', '/Payment', { fakeField: true }), /Unsupported body fields/);
  assert.equal(buildOperationBody('DELETE', '/Payment/{id}', {}), undefined, 'bodyless operations do not send synthetic JSON');
  const file = new Blob(['example'], { type: 'application/octet-stream' });
  const upload = buildOperationBody('POST', '/Payment/UploadExcel', {}, [file]);
  assert.ok(upload.get('file'));
  assert.throws(() => buildOperationBody('POST', '/Payment/UploadExcel', {}, []), /Choose a file/);
  const ticket = buildOperationBody('POST', '/Ticket', { TicketId: 7, IsDeleted: false }, [file, file]);
  assert.equal(ticket.get('TicketId'), '7');
  assert.equal(ticket.get('IsDeleted'), 'false');
  assert.equal(ticket.getAll('files').length, 2);
});

test('Orders convert quick-date filters to documented date bounds and summaries send date parameters only', async () => {
  const { service, calls } = setup();
  const orders = service('order');
  await orders.getOrders({ Date: '2026-10-30', CustomerId: 12 });
  assert.equal(calls[0].params.fromDate, '2026-10-30T00:00:00');
  assert.equal(calls[0].params.toDate, '2026-10-30T23:59:59.999');
  assert.equal(calls[0].params.CustomerId, 12);
  await orders.getOrderSummary({ FromDate: '2026-10-01', ToDate: '2026-10-30', SearchField: 'Brand', Text: 'ignored' });
  assert.deepEqual(Object.keys(calls[1].params).sort(), ['fromDate', 'toDate']);
});

test('Orders and payment actions use the documented Payment collection and DTOs without synthetic permission gates', async () => {
  const sale = { paymentId: 37, orderId: 12, amount: 100, saleType: 'Sale', paymentType: 'Card', brandId: 2, gatewayId: 4 };
  const { service, calls } = setup(({ method, data }) => method === 'GET' ? { Data: [sale], TotalCount: 1 } : { data: { ...data, paymentId: 38 } });
  const payments = service('payment');
  assert.equal((await payments.getOrderPayments(12))[0].paymentId, 37);
  const saved = await payments.saveRefund({ paymentId: 37, orderId: 12, draft: { amount: 20, paymentDate: '2026-10-30' }, userId: 1 });
  assert.equal(saved.refundPaymentId, 37);
  assert.ok(calls.every((call) => call.path === '/Payment'));
  assert.ok(calls.filter((call) => call.method === 'GET').every((call) => call.params.SearchField === 'OrderId' && call.params.Text === '12'));
});

test('menu, page, template, and group-email details use their documented list APIs', async () => {
  for (const [resource, idKey, name] of [['menu', 'menuId', 'getMenuById'], ['page', 'pageId', 'getPageById'], ['template', 'templateId', 'getTemplateById'], ['groupEmail', 'groupEmailId', 'getGroupEmailById']]) {
    const { service, calls } = setup(() => ({ data: [{ [idKey]: 7, body: 'Saved body' }], totalCount: 1 }));
    const record = await service(resource)[name](7);
    assert.equal(record[idKey], 7);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path.split('/').length, 2);
    if (resource === 'template') assert.equal(record.body, 'Saved body');
  }
});

test('paged detail lookup finds records beyond the first page and propagates API denials', async () => {
  const { findPagedRecord } = load('src/lib/findPagedRecord.js');
  const pages = [];
  const record = await findPagedRecord(async (query) => {
    pages.push(query.PageNumber);
    return query.PageNumber === 1 ? { data: Array.from({ length: 100 }, (_, index) => ({ id: index + 1 })), totalCount: 101 }
      : { data: [{ id: 101 }], totalCount: 101 };
  }, 'id', 101);
  assert.equal(record.id, 101);
  assert.deepEqual(pages, [1, 2]);
  await assert.rejects(findPagedRecord(async () => { throw new Error('Access denied'); }, 'id', 1), /Access denied/);
});

test('Settings page and setting-value lists page locally using only documented query fields', async () => {
  const { service } = setup(({ path }) => ({ data: path === '/Setting' ? [
    { settingId: 1, settingName: 'First' }, { settingId: 2, settingName: 'Second' }
  ] : [{ settingValueId: 1, settingValueText: 'One' }, { settingValueId: 2, settingValueText: 'Two' }] }));
  const settings = service('setting');
  const page = await settings.getSettings({ PageNumber: 2, PageSize: 1, SortProperty: 'settingId', IsDescending: false });
  assert.equal(page.totalCount, 2);
  assert.equal(page.data[0].settingId, 2);
  assert.equal((await settings.getSettingValues({ PageNumber: 2, PageSize: 1 })).data[0].settingValueId, 2);
});

test('gateway payment type writes use the Swagger DTO and query ID', async () => {
  const { service, calls } = setup();
  const brand = service('brand');
  await brand.saveGatewayPaymentTypes({ gatewayId: 2, brandId: 4, paymentTypeIds: [3] });
  await brand.deleteGatewayPaymentType({ gatewayPaymentTypeId: 7 });
  await brand.deleteBrandEmail(8);
  assert.equal(calls[1].path, '/GatewayPaymentType');
  assert.deepEqual(plain(calls[1].params), { id: 7 });
  assert.deepEqual(plain(calls[2].params), { id: 8 });
  await service('gateway').createGatewayPaymentType({ gatewayId: 2, brandId: 4, paymentTypeIds: [3], paymentTypeId: 3 });
  assert.equal('brandId' in calls[3].data, false);
  assert.equal('paymentTypeId' in calls[3].data, false);
});

test('gateway filters use the documented getwayId spelling and permission errors propagate', async () => {
  const { service, calls } = setup();
  await service('gateway').getGatewayPaymentTypes({ BrandId: 4, GatewayId: 2, PaymentTypeId: 3 });
  await service('brand').getGatewayPaymentTypes({ BrandId: 4, GatewayId: 2, PaymentTypeId: 3 });
  assert.ok(calls.every((call) => call.params.getwayId === 2 && !('GatewayId' in call.params) && !('gatewayId' in call.params)));
  const denied = setup(() => { throw Object.assign(new Error('Access denied'), { status: 403 }); });
  await assert.rejects(denied.service('brand').getGatewayPaymentTypes(), /Access denied/);
});
