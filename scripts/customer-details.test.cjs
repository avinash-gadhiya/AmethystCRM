const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('esbuild');

function load(file, dependencies = {}, globals = {}) {
  const code = transformSync(fs.readFileSync(file, 'utf8').replaceAll('import.meta.env', '({})'), { format: 'cjs' }).code;
  const context = {
    module: { exports: {} },
    require: (name) => {
      if (!(name in dependencies)) throw Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    ...globals
  };
  vm.runInNewContext(code, context);
  return context.module.exports;
}
const normalization = load('src/lib/normalizeApiRecord.js');
const plain = (value) => JSON.parse(JSON.stringify(value));
const wrap = (value) => ({ __esModule: true, default: value });
const summary = {
  customerId: 13,
  name: 'Customer',
  email: 'customer@example.test',
  phone: '2025550123',
  salesPerson: 7,
  createdDate: '2026-11-01'
};
function setup(overrides = {}) {
  const calls = [];
  const page = (section) => async (params, signal) => {
    calls.push({ section, params, signal });
    return overrides[section] ? overrides[section](params, signal) : { data: [], totalCount: 0 };
  };
  const service = load('src/services/customerDetailsService.js', {
    './customerService': wrap({
      getCustomerById: overrides.customer || (async () => ({ customerId: 13, name: 'Fresh name', email: '', phone: null }))
    }),
    './orderService': wrap({ getOrders: page('orders') }),
    './ticketService': wrap({ getTickets: page('tickets') })
  });
  return { ...service, calls };
}

test('details preserve known contact fields while refreshing the customer and loading exact customer collections', async () => {
  const { getCustomerDetails, calls } = setup({
    orders: () => ({ data: [{ orderId: 43, orderStatus: 'Paid', customerId: 13 }], totalCount: 1 })
  });
  const signal = new AbortController().signal;
  const result = await getCustomerDetails(summary, signal);
  assert.equal(result.customer.name, 'Fresh name');
  assert.equal(result.customer.email, summary.email);
  assert.equal(result.customer.phone, summary.phone);
  assert.equal(result.customer.salesPerson, 7);
  assert.equal(result.customer.createdDate, summary.createdDate);
  assert.equal(result.orders[0].orderStatus, 'Paid');
  for (const call of calls) {
    assert.deepEqual(plain(call.params), { CustomerId: 13, PageNumber: 1, PageSize: 100 });
    assert.equal(call.signal, signal);
  }
});

test('CustomerDTO embedded collections are used without redundant Orders and Tickets requests', async () => {
  const { getCustomerDetails, calls } = setup({ customer: async () => ({
    customerId: 13, email: '', salesPerson: 0,
    getOrderListDTOs: [{ orderId: 43, orderStatus: 'Full Payment', totalAmount: 399.99 }],
    getTicketListDTOs: []
  }) });
  const result = await getCustomerDetails(summary);
  assert.equal(result.orders[0].orderId, 43);
  assert.equal(result.orders[0].orderStatus, 'Full Payment');
  assert.equal(result.tickets.length, 0);
  assert.equal(calls.length, 0);
});

test('all collection pages are loaded, duplicates removed, and unrelated customers excluded', async () => {
  const { getCustomerDetails, calls } = setup({
    orders: ({ PageNumber }) =>
      PageNumber === 1
        ? {
            data: [
              { orderId: 1, customerId: 13 },
              { orderId: 2, customerId: 99 }
            ],
            totalCount: 3
          }
        : {
            data: [
              { orderId: 1, customerId: 13 },
              { orderId: 3, customerId: 13 }
            ],
            totalCount: 3
          }
  });
  const result = await getCustomerDetails(summary);
  assert.deepEqual(plain(result.orders.map((row) => row.orderId)), [1, 3]);
  assert.equal(calls.filter((call) => call.section === 'orders').length, 2);
});

test('full pages without counts keep loading instead of truncating at 100 records', async () => {
  const { getCustomerDetails } = setup({
    tickets: ({ PageNumber }) => ({
      data: PageNumber === 1 ? Array.from({ length: 100 }, (_, index) => ({ ticketId: index + 1 })) : [{ ticketId: 101 }],
      raw: {},
      totalCount: 100
    })
  });
  assert.equal((await getCustomerDetails(summary)).tickets.length, 101);
});

test('partial API failures retain the customer and successful sections and report errors explicitly', async () => {
  const { getCustomerDetails } = setup({
    customer: async () => {
      throw Error('Customer access denied');
    },
    tickets: async () => {
      throw Error('Ticket access denied');
    },
    orders: () => ({ data: [{ orderId: 43 }], totalCount: 1 })
  });
  const result = await getCustomerDetails(summary);
  assert.equal(result.customer.email, summary.email);
  assert.equal(result.orders.length, 1);
  assert.equal(result.errors.customer, 'Customer access denied');
  assert.equal(result.errors.tickets, 'Ticket access denied');
  assert.equal(result.errors.orders, '');
});

test('incomplete pagination is an error and cancelled requests do not return customer data', async () => {
  const { getCustomerDetails } = setup({ orders: () => ({ data: [{ orderId: 43 }], totalCount: 5 }) });
  assert.match((await getCustomerDetails(summary)).errors.orders, /fully loaded/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(getCustomerDetails(summary, controller.signal), { name: 'AbortError' });
});

test('Ticket requests send the documented CustomerId, forward cancellation, and normalize PascalCase data and counts', async () => {
  let captured;
  let body = { Data: { Items: [{ TicketId: 5, CustomerId: 13, Subject: 'Support', TicketStatus: 2 }], TotalCount: 22 } };
  const tickets = load(
    'src/services/ticketService.js',
    {
      './authService': wrap({ getToken: () => 'test-token' }),
      './http': { handleSessionExpired() {} },
      '@/lib/normalizeApiRecord': normalization
    },
    {
      URLSearchParams,
      fetch: async (url, options) => {
        captured = { url, options };
        return { ok: true, status: 200, json: async () => body };
      }
    }
  ).default;
  const signal = new AbortController().signal;
  const result = await tickets.getTickets({ CustomerId: 13, PageNumber: 2, PageSize: 100 }, signal);
  const query = new URL(captured.url).searchParams;
  assert.equal(query.get('CustomerId'), '13');
  assert.equal(query.get('PageNumber'), '2');
  assert.equal(query.get('PageSize'), '100');
  assert.equal(captured.options.signal, signal);
  assert.equal(captured.options.headers.Authorization, 'Bearer test-token');
  assert.equal(result.data[0].subject, 'Support');
  assert.equal(result.totalCount, 22);
  body = { success: true, data: 'invalid response' };
  await assert.rejects(tickets.getTickets({ CustomerId: 13 }), /invalid ticket list/);
});
