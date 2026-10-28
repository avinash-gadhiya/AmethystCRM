const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs
  .readFileSync('src/services/dailySalesReportService.js', 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace('export const dailySalesReportService', 'const dailySalesReportService')
  .replace('export default dailySalesReportService;', 'globalThis.service = dailySalesReportService;');
function setup(handler) {
  const calls = [];
  const context = {
    apiClient: {
      get: async (path, params, signal) => {
        calls.push({ path, params, signal });
        return handler(path, params, signal);
      }
    }
  };
  vm.runInNewContext(source, context);
  return { service: context.service, calls };
}

test('performance request covers both full days and forwards cancellation', async () => {
  const { service, calls } = setup(() => ({ data: { userSalePayments: [], userLeads: [] } }));
  const signal = new AbortController().signal;
  await service.getPerformanceReport({ fromDate: '2026-10-01', toDate: '2026-10-27' }, signal);
  assert.equal(calls[0].path, '/Report/GetUserPerformanceReport');
  assert.equal(calls[0].params.fromDate, '2026-10-01T00:00:00');
  assert.equal(calls[0].params.toDate, '2026-10-27T23:59:59');
  assert.equal(calls[0].signal, signal);
});

test('supports direct and wrapped report data without discarding records', async () => {
  const report = { userSalePayments: [{ userId: 8, splitSaleAmount: 25 }], userLeads: [{ userId: 8, leadCount: 2 }] };
  for (const payload of [report, { data: report }]) {
    const { service } = setup(() => payload);
    const result = await service.getPerformanceReport({ fromDate: '2026-10-27', toDate: '2026-10-27' });
    assert.equal(result.userSalePayments[0].splitSaleAmount, 25);
    assert.equal(result.userLeads[0].leadCount, 2);
  }
});

test('invalid ranges and malformed responses cannot appear as successful empty reports', async () => {
  const { service, calls } = setup(() => ({ data: '<html>error</html>' }));
  await assert.rejects(service.getPerformanceReport({ fromDate: '2026-10-28', toDate: '2026-10-27' }), /valid report date range/);
  assert.equal(calls.length, 0);
  await assert.rejects(service.getPerformanceReport({ fromDate: '2026-10-27', toDate: '2026-10-27' }), /unexpected response/);
});

test('dashboard loads its report, location and user endpoints with the same signal', async () => {
  const { service, calls } = setup((path) => {
    if (path.startsWith('/Report/')) return { data: { userSalePayments: [], userLeads: [] } };
    if (path.startsWith('/Location/')) return { data: [{ locationId: 2, locationName: 'Branch' }] };
    return { data: [{ userId: 8, locationId: 2 }] };
  });
  const signal = new AbortController().signal;
  const result = await service.getDashboardData({ fromDate: '2026-10-27', toDate: '2026-10-27' }, signal);
  assert.deepEqual(
    calls.map((call) => call.path),
    ['/Report/GetUserPerformanceReport', '/Location/LocationDropdown', '/User']
  );
  assert.ok(calls.every((call) => call.signal === signal));
  assert.equal(result.locations[0].name, 'Branch');
  assert.equal(result.users[0].userId, 8);
});

test('API errors reach the caller instead of becoming zero sales', async () => {
  const { service } = setup(() => {
    throw new Error('Session expired');
  });
  await assert.rejects(service.getDashboardData({ fromDate: '2026-10-27', toDate: '2026-10-27' }), /Session expired/);
});
