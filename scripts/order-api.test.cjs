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
const plain = (value) => JSON.parse(JSON.stringify(value));
function setup(handler) {
  const calls = [];
  const apiClient = Object.fromEntries(
    ['get', 'post', 'put', 'request'].map((method) => [
      method,
      async (path, data) => {
        calls.push({ method, path, data });
        return handler(method, path, data);
      }
    ])
  );
  const dependencies = (name) => {
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

test('new refunds read Payment detail and refund history, then POST a linked Refund DTO', async () => {
  const { payments, calls } = setup((method, path, payload) => {
    if (path === '/Payment/37') return { data: sale };
    if (path === '/Payment/GetAllPayment') return { data: [sale, oldRefund], totalCount: 2 };
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
    if (path === '/Payment/GetAllPayment') return { data: [sale, oldRefund], totalCount: 2 };
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
  assert.equal(calls.filter((call) => call.path === '/Payment/GetAllPayment').length, 2);
});

test('non-card refunds use a nullable gateway and canonical PascalCase payment details', async () => {
  const { payments, calls } = setup((method, path, payload) => {
    if (path === '/Payment/37')
      return { Data: { PaymentId: 37, OrderId: 12, Amount: 100, PaymentType: 'Bank', SaleType: 'Sale', BrandId: 2 } };
    if (path === '/Payment/GetAllPayment') return { Data: [], TotalCount: 0 };
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
