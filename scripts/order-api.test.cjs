const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('esbuild');

function load(file, requireDependency) {
  const code = transformSync(fs.readFileSync(file, 'utf8'), { loader: 'jsx', format: 'cjs' }).code;
  const context = { module: { exports: {} }, console, require: requireDependency };
  vm.runInNewContext(code, context);
  return context.module.exports;
}
const paymentMethods = load('src/lib/paymentMethod.js');
const refundMethods = load('src/lib/paymentRefund.js');
const editor = load('src/lib/orderEditor.js');
const normalization = load('src/lib/normalizeApiRecord.js');
const plain = (value) => JSON.parse(JSON.stringify(value));
function setup(handler) {
  const calls = [];
  const apiClient = Object.fromEntries(
    ['get', 'post', 'put', 'delete', 'request'].map((method) => [
      method,
      async (path, data) => {
        calls.push({ method, path, data });
        return handler(method, path, data);
      }
    ])
  );
  const dependencies = (name) => {
    if (name === '@/lib/normalizeApiRecord') return normalization;
    if (name === '@/lib/paymentMethod') return paymentMethods;
    if (name === '@/lib/paymentRefund') return refundMethods;
    return { __esModule: true, default: apiClient };
  };
  return {
    calls,
    payments: load('src/services/paymentService.js', dependencies).default,
    orders: load('src/services/orderService.js', dependencies).default,
    gateways: load('src/services/gatewayService.js', dependencies).default
  };
}

const sale = {
  paymentId: 37,
  orderId: 12,
  amount: 500,
  paymentType: 'Card',
  saleType: 'Sale',
  brandId: 2,
  gatewayId: 4,
  cardNumber: '1111',
  createdBy: 1
};
const oldRefund = { paymentId: 38, orderId: 12, refundPaymentId: 37, amount: 100, saleType: 'Refund', paymentType: 'Card', createdBy: 1 };
const draft = { amount: 50, paymentDate: '2026-10-26', transactionId: 'refund-test', authCode: '', isAlert: false };

test('order payment reads use the Payments page route without a singular permission-code assumption', async () => {
  const { payments, calls } = setup((_method, path) => {
    if (path === '/Payment/37') return { data: sale };
    if (path === '/Payment/40') return { data: { ...sale, paymentId: 40, orderId: 99 } };
    assert.equal(path, '/Payment');
    return { Data: [
      { PaymentId: 37, OrderId: 12, Amount: 500, SaleType: 'Sale' },
      oldRefund, { ...sale, paymentId: 40, orderId: 99 }, { ...sale, paymentId: 41, isDeleted: true }
    ], TotalCount: 4 };
  });
  const rows = await payments.getOrderPayments(12);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].orderId, 12);
  assert.equal(rows[1].saleType, 'Refund');
  assert.equal((await payments.getOrderPaymentById(37, 12)).paymentId, 37);
  await assert.rejects(payments.getOrderPaymentById(40, 12), /not found in this order/);
  assert.ok(calls.every((call) => !call.path.includes('GetAllPayment') && !call.path.startsWith('/Order/')));
});

test('refunds reload Payment history before saving and count existing refunds', async () => {
  let reads = 0;
  const { payments, calls } = setup((method, path, payload) => {
    if (method === 'get') {
      assert.equal(path, '/Payment', 'use the same route as the granted Payments page');
      reads += 1;
      return { data: [sale, oldRefund, ...(reads > 1 ? [{ ...oldRefund, paymentId: 39, amount: 300 }] : [])] };
    }
    return { data: { ...payload, paymentId: 42 } };
  });
  assert.equal((await payments.getRefundContext(37, undefined, { orderId: 12 })).availableAmount, 400);
  await assert.rejects(payments.saveRefund({ paymentId: 37, orderId: 12, draft: { ...draft, amount: 200 }, userId: 7 }), /cannot exceed/);
  assert.equal(calls.filter((call) => call.method === 'post').length, 0, 'a newer refund reduces the available amount before save');
  const saved = await payments.saveRefund({ paymentId: 37, orderId: 12, draft, userId: 7 });
  assert.equal(saved.refundPaymentId, 37);
  assert.equal(saved.orderId, 12);
  assert.equal(saved.amount, 50);
});

test('refund edits retain their original payment link using the order payment history', async () => {
  const { payments, calls } = setup((method, path, payload) => {
    if (method === 'get') {
      assert.equal(path, '/Payment');
      return { data: [sale, oldRefund] };
    }
    return { data: payload };
  });
  await payments.saveRefund({ paymentId: 38, orderId: 12, draft: { ...draft, amount: 450 }, userId: 7 });
  const put = calls.find((call) => call.method === 'put');
  assert.equal(put.path, '/Payment');
  assert.equal(put.data.paymentId, 38);
  assert.equal(put.data.refundPaymentId, 37);
  assert.equal(calls.some((call) => call.method === 'post'), false);
});

test('missing history or denied Payment access blocks refunds without trying another endpoint', async () => {
  for (const response of [{ orderId: 12 }, { orderId: 12, payments: [] }, { orderId: 99, payments: [sale] }, null]) {
    const { payments, calls } = setup((_method, path) => {
      assert.equal(path, '/Payment');
      if (response === null) throw Object.assign(new Error('Order access denied'), { status: 403 });
      return response;
    });
    await assert.rejects(payments.saveRefund({ paymentId: 37, orderId: 12, draft, userId: 7 }));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, 'get');
  }
});

test('order payments page through the Payment API and retain sales, refunds, and voids for the selected order only', async () => {
  const first = Array.from({ length: 100 }, (_, index) => ({ PaymentId: index + 100, OrderId: 12, Amount: 1, SaleType: 'Sale' }));
  const { payments, calls } = setup((_method, path, query) => {
    assert.equal(path, '/Payment');
    assert.equal(query.SearchField, 'OrderId');
    assert.equal(query.Text, '12');
    assert.equal(query.FromDate, '', 'history is not limited to the order sale period');
    return query.PageNumber === 1
      ? { Data: { Items: first, TotalCount: 104 } }
      : { Data: { Items: [oldRefund, { ...sale, isVoid: true }, { ...sale, paymentId: 40, isDeleted: true }, { ...sale, paymentId: 41, orderId: 99 }], TotalCount: 104 } };
  });
  const rows = await payments.getOrderPayments(12);
  assert.equal(rows.length, 102);
  assert.ok(rows.some((row) => row.saleType === 'Refund'));
  assert.ok(rows.some((row) => row.isVoid));
  assert.ok(rows.every((row) => row.orderId === 12 && !row.isDeleted));
  assert.equal(calls.length, 2);
});

test('order payments handle empty history without calling GetAllPayment', async () => {
  const { payments, calls } = setup((_method, path) => {
    assert.equal(path, '/Payment');
    return { Data: [], TotalCount: 0 };
  });
  assert.deepEqual(plain(await payments.getOrderPayments(12)), []);
  assert.equal(calls[0].path, '/Payment');
  assert.equal(calls.length, 1);
  await assert.rejects(payments.getOrderPayments(0), /Order ID/);
});

test('incomplete order payment history fails instead of displaying a partial list as complete', async () => {
  const { payments } = setup(() => ({ data: [sale], totalCount: 2 }));
  await assert.rejects(payments.getOrderPayments(12), /could not be fully loaded/);
});

test('new refunds read Payment detail and refund history, then POST a linked Refund DTO', async () => {
  const { payments, calls } = setup((method, path, payload) => {
    if (path === '/Payment/37') return { data: sale };
    if (method === 'get' && path === '/Payment') return { data: [sale, oldRefund], totalCount: 2 };
    if (method === 'post') return { success: true, data: { ...payload, paymentId: 39 } };
    throw new Error('Unexpected API call');
  });
  const context = await payments.getRefundContext(37);
  assert.equal(context.availableAmount, 400);
  const result = await payments.saveRefund({ paymentId: 37, draft, userId: 7 });
  assert.equal(result.paymentId, 39);
  const post = calls.find((call) => call.method === 'post');
  assert.equal(post.path, '/Payment');
  assert.equal(post.data.paymentId, 0);
  assert.equal(post.data.refundPaymentId, 37);
  assert.equal(post.data.orderId, 12);
  assert.equal(post.data.saleType, 'Refund');
  assert.equal(post.data.amount, 50);
  assert.equal(post.data.createdBy, 7);
  assert.equal(post.data.cvv, '');
  assert.equal(calls.filter((call) => call.path === '/Payment/37').length, 2, 'save checks fresh API data again');
});

test('editing a refund PUTs its ID and keeps its original-payment relationship', async () => {
  const { payments, calls } = setup((method, path, payload) => {
    if (path === '/Payment/38') return { data: oldRefund };
    if (path === '/Payment/37') return { data: sale };
    if (method === 'get' && path === '/Payment') return { data: [sale, oldRefund], totalCount: 2 };
    if (method === 'put') return { data: payload };
    throw new Error('Unexpected API call');
  });
  await payments.saveRefund({ paymentId: 38, draft: { ...draft, amount: 450 }, userId: 7 });
  const put = calls.find((call) => call.method === 'put');
  assert.equal(put.path, '/Payment');
  assert.equal(put.data.paymentId, 38);
  assert.equal(put.data.refundPaymentId, 37);
  assert.equal(put.data.createdBy, 1);
  assert.equal(put.data.updatedBy, 7);
  assert.equal(
    calls.some((call) => call.method === 'post'),
    false
  );
});

test('over-refunds, invalid amounts, and invalid dates never write to Payment', async () => {
  const { payments, calls } = setup((_method, path) =>
    path === '/Payment/37' ? { data: sale } : { data: [sale, oldRefund], totalCount: 2 }
  );
  for (const invalid of [
    { amount: 401 },
    { amount: 0 },
    { amount: -1 },
    { amount: 'bad' },
    { paymentDate: '' },
    { paymentDate: '2026-02-31' }
  ]) {
    await assert.rejects(payments.saveRefund({ paymentId: 37, draft: { ...draft, ...invalid }, userId: 7 }));
  }
  assert.equal(
    calls.some((call) => ['post', 'put'].includes(call.method)),
    false
  );
});

test('failed history reads stop refunds and propagate the backend error', async () => {
  const { payments, calls } = setup((_method, path) => {
    if (path === '/Payment/37') return { data: sale };
    throw Object.assign(new Error('Refund history denied'), { status: 403 });
  });
  await assert.rejects(payments.saveRefund({ paymentId: 37, draft, userId: 7 }), /Refund history denied/);
  assert.equal(
    calls.some((call) => ['post', 'put'].includes(call.method)),
    false
  );
});

test('refunds count every history page and ignore voided refunds and other orders', async () => {
  const firstPage = Array.from({ length: 100 }, (_, index) => ({ paymentId: index + 100, orderId: 12, amount: 1, saleType: 'Sale' }));
  const { payments, calls } = setup((_method, path, query) => {
    if (path === '/Payment/37') return { data: sale };
    return query.PageNumber === 1
      ? { data: firstPage, totalCount: 103 }
      : {
          data: [oldRefund, { ...oldRefund, paymentId: 39, isVoid: true }, { ...oldRefund, paymentId: 40, orderId: 99 }],
          totalCount: 103
        };
  });
  assert.equal((await payments.getRefundContext(37)).availableAmount, 400);
  assert.equal(calls.filter((call) => call.path === '/Payment').length, 2);
});

test('non-card refunds use a nullable gateway and canonical PascalCase payment details', async () => {
  const { payments, calls } = setup((method, path, payload) => {
    if (path === '/Payment/37')
      return { Data: { PaymentId: 37, OrderId: 12, Amount: 100, PaymentType: 'Bank', SaleType: 'Sale', BrandId: 2 } };
    if (path === '/Payment') return { Data: [], TotalCount: 0 };
    if (method === 'post') return { Success: true, Data: { PaymentId: 39 } };
    throw new Error('Unexpected API call');
  });
  await payments.saveRefund({ paymentId: 37, draft, userId: 7 });
  assert.equal(calls.find((call) => call.method === 'post').data.gatewayId, null);
});

test('order hydration fills saved items, customer, and percentage discounts from API data', () => {
  const result = editor.normalizeOrderForEditor({
    Data: {
      OrderId: 12,
      CustomerId: 4,
      CustomerName: 'Test Customer',
      Subtotal: 200,
      DiscountType: 'Percentage',
      DiscountAmount: 20,
      OrderItems: [{ OrderItemId: 25, ProductId: 9, ProductName: 'Saved product', Quantity: 2, UnitPrice: 100, SubscriptionMonths: 12 }]
    }
  });
  assert.equal(result.customer.customerId, 4);
  assert.equal(result.items[0].orderItemId, 25);
  assert.equal(result.items[0].price, 100);
  assert.equal(result.items[0].quantity, 2);
  assert.equal(result.subscriptionMonths, 12);
  assert.equal(result.discountPercent, 10);
});

test('editing an order preserves IDs and metadata, deletes removed items, and calls PUT Order only', async () => {
  const original = {
    orderId: 12,
    saleDate: '2026-10-20T12:00:00Z',
    isFulfilled: true,
    shareTypeId: 3,
    orderItems: [{ orderItemId: 25 }, { orderItemId: 26 }]
  };
  const payload = editor.buildOrderUpdatePayload(original, {
    customerId: 4,
    salesPersonId: 7,
    summary: { subtotal: 200, discount: 20, total: 180 },
    discountType: 'Fixed',
    discountCode: 'TEST',
    notes: 'Updated',
    lines: [{ orderItemId: 25, productId: 9, name: 'Saved product', quantity: 2, price: 100, totalPrice: 200, subscriptionMonths: 12 }]
  });
  const { orders, calls } = setup(() => ({ success: true }));
  await orders.updateOrder(payload);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'put');
  assert.equal(calls[0].path, '/Order');
  assert.equal(payload.orderId, 12);
  assert.equal(payload.orderItems[0].orderItemId, 25);
  assert.equal(payload.orderItems[1].orderItemId, 26);
  assert.equal(payload.orderItems[1].isDeleted, true);
  assert.equal(payload.isFulfilled, true);
  assert.equal(payload.saleDate, original.saleDate);
  assert.equal('payment' in payload, false);
});

test('brand gateway lookup excludes other brands and does not leak unassigned fallback rows', async () => {
  const { gateways, calls } = setup((_method, path) => {
    if (path === '/Gateway') throw Object.assign(new Error('Not found'), { status: 404 });
    return {
      data: [
        { gatewayId: 1, gatewayName: 'Unassigned' },
        { gatewayId: 2, gatewayName: 'Other brand', brandId: 8 },
        { gatewayId: 3, gatewayName: 'Selected brand', brandId: 2 }
      ]
    };
  });
  assert.deepEqual(
    plain((await gateways.getBrandGateways(2)).data).map((row) => row.gatewayId),
    [3]
  );
  assert.equal(calls[0].data.params.BrandId, 2);
  assert.deepEqual(plain(await gateways.getBrandGateways(0)), { data: [], totalCount: 0 });
});

test('order date filters use full-day API bounds and summary accepts date parameters only', async () => {
  const { orders, calls } = setup(() => ({ Data: [], TotalCount: 0 }));
  await orders.getOrders({ Date: '2026-10-30', SearchField: 'CustomerName', Text: 'Jack' });
  assert.equal(calls[0].data.fromDate, '2026-10-30T00:00:00');
  assert.equal(calls[0].data.toDate, '2026-10-30T23:59:59.999');
  assert.equal('Date' in calls[0].data, false);
  await orders.getOrderSummary({ FromDate: '2026-10-01', ToDate: '2026-10-30', Text: 'Jack' });
  assert.deepEqual(plain(calls[1].data), { fromDate: '2026-10-01T00:00:00', toDate: '2026-10-30T23:59:59.999' });
});

test('PascalCase status strings are normalized without treating false as true', async () => {
  const { payments } = setup(() => ({ Data: [{ PaymentId: 37, OrderId: 12, IsVoid: 'false', IsDeleted: '0', IsAlert: 'true' }], TotalCount: 1 }));
  const rows = await payments.getOrderPayments(12);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].isVoid, false);
  assert.equal(rows[0].isDeleted, false);
  assert.equal(rows[0].isAlert, true);
});

test('order detail unwraps PascalCase envelopes and rejects a different order ID', async () => {
  const { orders } = setup((_method, path) => ({ Data: { OrderId: path === '/Order/12' ? 12 : 99, IsFulfilled: 'false' } }));
  assert.equal((await orders.getOrderById(12)).isFulfilled, false);
  await assert.rejects(orders.getOrderById(13), /Order not found/);
});

test('refunds reject incomplete original-payment links before writing', async () => {
  const { payments, calls } = setup(() => ({ data: [sale, { ...oldRefund, refundPaymentId: 0 }] }));
  await assert.rejects(payments.saveRefund({ paymentId: 37, orderId: 12, draft, userId: 7 }), /missing original payment links/);
  assert.equal(calls.some((call) => call.method === 'post' || call.method === 'put'), false);
});

test('payment deletion and mail actions use their exact documented API arguments', async () => {
  const { payments, orders, calls } = setup(() => ({ success: true }));
  await payments.deletePayment(37);
  await orders.deleteOrder(12);
  await payments.sendPaymentMail({ paymentId: 37, brandEmailTempleteId: 8 });
  await payments.sendPandaDocMail(37);
  assert.deepEqual(plain(calls), [
    { method: 'delete', path: '/Payment/37' },
    { method: 'delete', path: '/Order', data: { id: 12 } },
    { method: 'get', path: '/Payment/SendMail', data: { paymentId: 37, brandEmailTempleteId: 8 } },
    { method: 'get', path: '/Payment/SendPandaDocMail', data: { paymentId: 37 } }
  ]);
});

test('Payment list envelopes preserve API rows and reject malformed responses instead of showing empty success', async () => {
  const valid = setup(() => ({ Result: { Items: [{ PaymentId: 43, OrderId: 42, Amount: 90.99, AuthCode: '86868', PaymentType: 'Card', IsVoid: 'false' }], TotalCount: 1 } }));
  const rows = await valid.payments.getOrderPayments(42);
  assert.equal(rows[0].paymentId, 43);
  assert.equal(rows[0].authCode, '86868');
  assert.equal(rows[0].amount, 90.99);
  const invalid = setup(() => ({ unexpected: 'not a payment collection' }));
  await assert.rejects(invalid.payments.getOrderPayments(42), /invalid payment list/);
});
