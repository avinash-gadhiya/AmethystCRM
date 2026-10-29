const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('src/services/reportService.js', 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace('import.meta.env.VITE_APP_API_URL', '"https://reports.test/api"')
  .replace(/export const /g, 'const ')
  .replace('export default reportService;', 'globalThis.service = reportService; globalThis.rows = reportRows;');

function setup(payload, status = 200, options = {}) {
  const calls = [];
  const expired = [];
  const context = {
    URLSearchParams,
    authService: { getToken: () => options.token === undefined ? 'session-token' : options.token },
    handleSessionExpired: (token) => expired.push(token),
    fetch: async (url, init) => {
      calls.push({ url: new URL(url), init });
      if (options.fetchError) throw options.fetchError;
      return {
        status, ok: status >= 200 && status < 300,
        json: async () => {
          if (options.invalidJson) throw new SyntaxError('Invalid JSON');
          return payload;
        }
      };
    }
  };
  vm.runInNewContext(source, context);
  return { ...context, calls, expired };
}

test('all five report endpoints retain authentication, dates, and cancellation', async () => {
  const { service, calls } = setup([]);
  const signal = new AbortController().signal;
  for (const loader of ['getLeadPickByUsers', 'getSalesReport', 'getServiceReport', 'getRenewalReport', 'getTicketStatusReport']) {
    await service[loader]({ fromDate: '2026-10-01', toDate: '2026-10-29', groupId: 7 }, signal);
  }
  assert.deepEqual(calls.map(({ url }) => url.pathname), [
    '/api/LeadReport/LeadPickByUsers', '/api/Report/SalesReport', '/api/Report/ServiceReport',
    '/api/Report/RenewalReport', '/api/Report/TicketStatusReport'
  ]);
  for (const { url, init } of calls) {
    assert.equal(init.signal, signal);
    assert.equal(init.headers.Authorization, 'Bearer session-token');
    assert.equal(url.searchParams.get('fromDate') ?? url.searchParams.get('fromdate'), '2026-10-01T00:00:00');
    assert.equal(url.searchParams.get('toDate') ?? url.searchParams.get('todate'), '2026-10-29T23:59:59');
  }
  assert.equal(calls[0].url.searchParams.get('groupId'), '7');
});

test('server pagination and search are sent without adding empty filters', async () => {
  const { service, calls } = setup([]);
  await service.getSalesReport({ page: 3, pageSize: 25, search: 'Jane & Co' });
  const params = calls[0].url.searchParams;
  assert.equal(params.get('PageNumber'), '3');
  assert.equal(params.get('PageSize'), '25');
  assert.equal(params.get('Text'), 'Jane & Co');
  assert.equal(params.has('fromDate'), false);
});

test('wrapped lists and nested totals retain records', async () => {
  const record = { userName: 'Jane', leadPicked: 4 };
  for (const payload of [[record], { data: [record] }, { Data: { Users: [record] } }, { data: { items: [record], totalCount: 72 } }]) {
    const { service, rows } = setup(payload);
    const result = await service.getLeadPickByUsers({});
    assert.equal(rows(result.data)[0].userName, 'Jane');
    if (payload?.data?.totalCount) assert.equal(result.totalCount, 72);
  }
});

test('no-content and null data render as empty lists', async () => {
  for (const [payload, status] of [[undefined, 204], [null, 200], [{ data: null }, 200]]) {
    const { service, rows } = setup(payload, status);
    const result = await service.getSalesReport({});
    assert.equal(rows(result.data).length, 0);
  }
});

test('non-JSON permission errors preserve status and session expiry uses the request token', async () => {
  const denied = setup(undefined, 403, { invalidJson: true });
  await assert.rejects(denied.service.getSalesReport({}), (error) => error.statusCode === 403);
  const expired = setup({ message: 'Expired' }, 401);
  await assert.rejects(expired.service.getSalesReport({}), /Expired/);
  assert.deepEqual(expired.expired, ['session-token']);
});

test('malformed data, network errors, and cancellation are not reported as empty success', async () => {
  const malformed = setup('<html>error</html>');
  await assert.rejects(malformed.service.getSalesReport({}), /unexpected response/);
  assert.throws(() => malformed.rows({ unknown: true }), /unexpected response/);
  for (const error of [new TypeError('Network unavailable'), new DOMException('Canceled', 'AbortError')]) {
    const { service } = setup(null, 200, { fetchError: error });
    await assert.rejects(service.getSalesReport({}), (actual) => actual === error);
  }
});

test('missing authentication prevents requests and API errors retain messages', async () => {
  const missing = setup([], 200, { token: '' });
  await assert.rejects(missing.service.getSalesReport({}), /sign in/);
  assert.equal(missing.calls.length, 0);
  const failed = setup({ success: false, message: 'Invalid date range', statusCode: 400 });
  await assert.rejects(failed.service.getSalesReport({}), (error) => error.statusCode === 400 && /Invalid date/.test(error.message));
});

test('user leads accepts direct and wrapped collections and leadPicked alias', () => {
  const component = fs.readFileSync('src/pages/reports/ReportCenter.jsx', 'utf8');
  const normalizers = component.slice(component.indexOf('const normalizeUserLeads'), component.indexOf('const normalizePerformance'));
  const { rows } = setup([]);
  const context = { readReportRows: rows };
  vm.runInNewContext(`${normalizers}\nglobalThis.normalize = normalizeUserLeads;`, context);
  for (const payload of [[{ fullName: 'Jane', leadPicked: 4 }], { Users: [{ fullName: 'Jane', leadPicked: 4 }] }]) {
    const result = context.normalize(payload);
    assert.equal(result[0].userName, 'Jane');
    assert.equal(result[0].leadsPicked, 4);
  }
});
