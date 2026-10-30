const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('esbuild');
const React = require('react');

function load(file, requireDependency, globals = {}) {
  const code = transformSync(fs.readFileSync(file, 'utf8'), { loader: 'jsx', format: 'cjs' }).code;
  const context = { module: { exports: {} }, console, require: requireDependency, ...globals };
  vm.runInNewContext(code, context, { filename: file });
  return context.module.exports;
}
const methods = load('src/lib/paymentMethod.js');
const orderEditor = load('src/lib/orderEditor.js');
const normalization = load('src/lib/normalizeApiRecord.js');
const plain = (value) => JSON.parse(JSON.stringify(value));

test('switching away from Card clears gateway and card details while keeping the brand and amount', () => {
  for (const tab of ['bank', 'cheque', 'zelle', 'paypal']) {
    const original = {
      paymentType: 'Card',
      brandId: 3,
      amount: 100,
      gatewayId: 7,
      gatewayName: 'Test gateway',
      cardNumber: '4111111111111111',
      cvv: '123',
      cardType: 'Visa'
    };
    const next = methods.changePaymentMethod(original, tab);
    assert.equal(next.gatewayId, 0);
    assert.equal(next.gatewayName, '');
    assert.equal(next.cardNumber, '');
    assert.equal(next.cvv, '');
    assert.equal(next.cardType, '');
    assert.equal(next.brandId, 3);
    assert.equal(next.amount, 100);
    assert.equal(original.gatewayId, 7, 'the previous draft is not mutated');
    const card = methods.changePaymentMethod(next, 'card');
    assert.equal(card.paymentType, 'Card');
    assert.equal(card.gatewayId, 0, 'returning to Card requires a fresh gateway selection');
  }
});

test('saving non-card payments strips historical gateway details in both payment routes and new orders', async () => {
  const calls = [];
  const api = Object.fromEntries(
    ['post', 'put'].map((method) => [
      method,
      async (path, data) => {
        calls.push({ method, path, data });
        return { success: true };
      }
    ])
  );
  const dependency = (name) => name === '@/lib/normalizeApiRecord' ? normalization : (name === './core/apiClient' ? { __esModule: true, default: api } : methods);
  const paymentService = load('src/services/paymentService.js', dependency).default;
  const orderService = load('src/services/orderService.js', dependency).default;
  for (const paymentType of ['Bank', 'Cheque', 'Zelle', 'PayPal']) {
    const payload = { paymentId: 8, brandId: 3, paymentType, gatewayId: 7, gatewayName: 'Old gateway', amount: 100 };
    await paymentService.createPayment(payload);
    await paymentService.updatePayment(payload);
    await orderService.createOrder({ payment: payload, orderItems: [] });
    for (const call of calls.splice(0)) {
      const saved = call.path === '/Order' ? call.data.payment : call.data;
      assert.equal(saved.gatewayId, null);
      assert.equal(saved.gatewayName, '');
      assert.equal(saved.brandId, 3);
      assert.equal(saved.paymentType, paymentType);
    }
  }
});

test('Card saves keep their selected gateway and card data', () => {
  const payment = { paymentType: 'Card', gatewayId: 7, gatewayName: 'Card gateway', cardNumber: '4111111111111111', cvv: '123' };
  assert.equal(methods.normalizePaymentGateway(payment), payment);
  assert.equal(methods.changePaymentMethod(payment, 'card'), payment);
});

test('order summaries hide legacy non-card gateways and select the card gateway for mixed payments', () => {
  const bank = { paymentType: 'Bank', gatewayId: 7, gatewayName: 'Old bank gateway' };
  assert.equal(methods.getOrderGatewayName({ gatewayName: bank.gatewayName, payments: [bank] }), '');
  const card = { paymentType: 'Card', gatewayId: 8, gatewayName: 'Card gateway' };
  assert.equal(methods.getOrderGatewayName({ gatewayName: bank.gatewayName, payments: [bank, card, card] }), 'Card gateway');
});

// Exercise the real components' event handlers and conditional JSX. Network
// effects stay disabled; these cases deliberately have no gateway/type lookup
// data, the situation that used to hide Card after selecting a gateway.
function component(file, options = {}) {
  let cursor = 0;
  let refCursor = 0;
  const refs = [];
  const state = [];
  const navigations = [];
  const effects = [];
  const Stub = () => null;
  const hookReact = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
      return [
        state[index],
        (next) => {
          state[index] = typeof next === 'function' ? next(state[index]) : next;
        }
      ];
    },
    useEffect(effect) {
      if (options.effects) effects.push(effect);
    },
    useMemo: (fn) => fn(),
    useCallback: (fn) => fn,
    useRef: (current) => refs[refCursor++] ||= { current }
  };
  const permissionHook = (settings = {}) => ({ loading: options.permissionsLoading === true, canView: options.canView !== false, canAdd: true, canUpdate: true, canDelete: true,
    has: (code) => {
      const codes = settings.path === '/Orders/Payments' ? options.paymentPermissionCodes ?? options.permissionCodes : options.permissionCodes;
      return codes === undefined || codes.includes(code);
    } });
  const uiModules = new Map();
  function ui(name) {
    if (!uiModules.has(name))
      uiModules.set(name, new Proxy({ __esModule: true, default: Stub }, { get: (target, key) => target[key] ?? Stub }));
    return uiModules.get(name);
  }
  const exports = load(
    file,
    (name) => {
      if (name === 'react') return hookReact;
      if (name === '@/services/authService') return { __esModule: true, default: { getUser: () => options.user || { roleName: 'Agent' } } };
      if (name === 'react-router-dom')
        return {
          useLocation: () => ({ state: options.state || null }),
          useNavigate:
            () =>
            (...args) =>
              navigations.push(args),
          useSearchParams: () => [new URLSearchParams(options.query || ''), () => {}]
        };
      if (name === 'date-fns') return require(name);
      if (name === '@/lib/paymentMethod') return methods;
      if (name === '@/lib/apiError') return { getApiErrorMessage: (error, fallback) => error?.message || fallback };
      if (name === '@/lib/orderEditor') return orderEditor;
      if (name === '@/lib/dynamicPaths')
        return { resolveDynamicPaths: async (paths) => paths, resolveDynamicPath: async (_key, fallback) => fallback };
      if (name === '@/lib/salesRoles') return { fetchSalesPersonList: async () => [], searchSalesPersonUsers: async () => [] };
      if (name === '@/services')
        return new Proxy(
          {},
          { get: (_target, service) => new Proxy(options.services?.[service] || {}, {
            get: (target, method) => target[method] || (method === 'getOrderPayments' ? async () => [] : async () => ({ data: [] }))
          }) }
        );
      if (name.includes('usePageCrudPermissions')) return { usePageCrudPermissions: permissionHook };
      if (name.includes('usePagePermissionCodes'))
        return { __esModule: true, default: permissionHook, usePagePermissionCodes: permissionHook };
      if (name.includes('useSearchFieldFetchGuard')) return { useSearchFieldFetchGuard: () => () => false };
      if (name.includes('permissionService')) return { __esModule: true, default: { getUserPermissionCodes: () => [] } };
      if (name === '@/lib/utils') return { cn: (...classes) => classes.filter(Boolean).join(' ') };
      if (name === 'sonner') return { toast: { success() {}, error() {} } };
      return ui(name);
    },
    {
      React: hookReact,
      URLSearchParams,
      AbortController,
      setTimeout,
      clearTimeout,
      window: { setTimeout, clearTimeout },
      localStorage: { getItem: (key) => (key === 'userId' ? '1' : '') }
    }
  );
  return {
    navigations,
    flushEffects: async () => {
      effects.splice(0).forEach((effect) => effect());
      await new Promise(setImmediate);
    },
    render: () => {
      cursor = 0;
      refCursor = 0;
      return (exports.default || exports.CreateOrderPage || exports.OrdersTable)();
    }
  };
}
const nodes = (element) => {
  if (!element || typeof element !== 'object') return [];
  return [element, ...React.Children.toArray(element.props?.children).flatMap(nodes)];
};
const text = (element) => {
  if (typeof element === 'string' || typeof element === 'number') return String(element);
  return React.Children.toArray(element?.props?.children).map(text).join('').trim();
};
const choose = (tree, placeholder, value) => {
  const select = nodes(tree).find(
    (node) => node.props?.onValueChange && nodes(node).some((child) => child.props?.placeholder === placeholder)
  );
  assert.ok(select, placeholder + ' is available');
  select.props.onValueChange(value);
};
const clickMethod = (tree, name) => {
  const button = nodes(tree).find((node) => node.type === 'button' && text(node) === name);
  assert.ok(button, name + ' payment method is visible');
  button.props.onClick();
};
const hasLabel = (tree, label) => nodes(tree).some((node) => node.type === 'label' && text(node).replace(/\s*\*$/, '') === label);

test('Create Order keeps Card entry visible after brand/gateway selection and hides Gateway for other methods', () => {
  const page = component('src/pages/order/CreateOrderPage.jsx');
  let tree = page.render();
  choose(tree, 'Select Brand', '3');
  tree = page.render();
  choose(tree, 'Select Gateway', '7');
  tree = page.render();
  assert.ok(hasLabel(tree, 'Card Number'));
  assert.ok(hasLabel(tree, 'CVV'));
  for (const method of ['Bank', 'Cheque', 'Zelle', 'PayPal']) {
    clickMethod(tree, method);
    tree = page.render();
    assert.equal(hasLabel(tree, 'Gateway'), false, method + ' hides Gateway');
    assert.equal(hasLabel(tree, 'Card Number'), false, method + ' hides Card entry');
  }
  clickMethod(tree, 'Card');
  tree = page.render();
  assert.ok(hasLabel(tree, 'Card Number'));
  assert.ok(hasLabel(tree, 'Gateway'));
});

test('the order action opens Edit Order on the Create Order route with a persistent order ID', () => {
  const page = component('src/pages/order/table/OrdersTable.jsx');
  const tree = page.render();
  const table = nodes(tree).find((node) => Array.isArray(node.props?.columns));
  const actions = table.props.columns.find((column) => column.id === 'actions');
  const order = { orderId: 36, customerId: 2, totalAmount: 100 };
  const actionTree = actions.cell({ row: { original: order } });
  assert.equal(
    nodes(actionTree).some((node) => node.props?.label === 'Add payment'),
    false
  );
  nodes(actionTree)
    .find((node) => node.props?.label === 'Edit order')
    .props.onClick();
  assert.equal(page.navigations[0][0], '/Orders/CreateOrder?orderId=36&mode=edit');
  assert.equal(page.navigations[0][1].state.editOrderMode, true);
  assert.deepEqual(plain(page.navigations[0][1].state.orderData), order);
});

test('order side actions contain only Edit and Delete while the arrow opens payment actions below', async () => {
  const page = component('src/pages/order/table/OrdersTable.jsx', { services: { paymentService: { getOrderPayments: async () => order.payments } } });
  let table = nodes(page.render()).find((node) => Array.isArray(node.props?.columns));
  const order = { orderId: 42, payments: [{ paymentId: 17, saleType: 'Sale', amount: 90 }] };
  const column = table.props.columns.find((column) => column.id === 'actions');
  const actions = column.cell({ row: { original: order } });
  assert.deepEqual(nodes(actions).filter((node) => node.props?.label).map((node) => node.props.label), ['Edit order', 'Delete order']);
  assert.equal(nodes(actions).some((node) => node.props?.onSelect), false, 'the parent row has no extra action menu');
  assert.equal(column.sticky, 'right', 'Edit and Delete stay visible when the table scrolls');
  const idCell = table.props.columns.find((column) => column.id === 'orderId').cell({ row: { original: order } });
  await nodes(idCell).find((node) => node.props?.['aria-label'] === 'Expand payments').props.onClick();
  table = nodes(page.render()).find((node) => Array.isArray(node.props?.columns));
  const expanded = table.props.renderSubRows(order);
  assert.ok(expanded);
  assert.ok(nodes(expanded).some((node) => node.props?.label === 'Refund'));
});

test('expanded orders expose the full payment actions and open Refund, Void, and Delete for the selected payment', async () => {
  const requested = [];
  const payment = { paymentId: 17, orderId: 42, saleType: 'Sale', amount: 90 };
  const order = { orderId: 42, payments: [payment] };
  const page = component('src/pages/order/table/OrdersTable.jsx', {
    services: { paymentService: { getOrderPayments: async () => [payment], getRefundContext: async (id) => {
      requested.push(id);
      return { payment, availableAmount: 90 };
    } } }
  });
  const getTable = () => nodes(page.render()).find((node) => Array.isArray(node.props?.columns));
  let table = getTable();
  const idCell = table.props.columns.find((column) => column.id === 'orderId').cell({ row: { original: order } });
  await nodes(idCell).find((node) => node.props?.['aria-label'] === 'Expand payments').props.onClick();
  table = getTable();
  const expanded = table.props.renderSubRows(order);
  assert.equal(text(nodes(expanded).find((node) => node.type === 'th')), 'Action');
  const group = nodes(expanded).find((node) => node.props?.['aria-label'] === 'Actions for payment 17');
  for (const label of ['Panda Doc Mail', 'Void payment', 'Refund', 'Edit', 'Delete payment']) {
    assert.ok(nodes(group).some((node) => node.props?.label === label), label + ' is available directly');
  }
  assert.ok(nodes(group).some((node) => node.props?.['aria-label'] === 'Payment templates'));
  assert.ok(nodes(group).some((node) => node.props?.onSelect && text(node).includes('Share Payment')), 'Share Payment remains available in the dropdown');
  nodes(group).find((node) => node.props?.label === 'Void payment').props.onClick();
  let modal = nodes(page.render()).find((node) => node.props?.title === 'Void Payment');
  assert.equal(modal.props.open, true);
  assert.equal(modal.props.itemName, 'Payment #17');
  modal.props.onCancel();
  nodes(group).find((node) => node.props?.label === 'Delete payment').props.onClick();
  modal = nodes(page.render()).find((node) => node.props?.title === 'Delete Payment');
  assert.equal(modal.props.open, true);
  assert.equal(modal.props.itemName, 'Payment #17');
  modal.props.onCancel();
  nodes(group).find((node) => node.props?.label === 'Refund').props.onClick();
  await new Promise(setImmediate);
  assert.deepEqual(requested, [17]);
  assert.match(text(page.render()), /Save Refund/);
});

test('orders without embedded payments load from Payment API and can collapse', async () => {
  const requested = [];
  const page = component('src/pages/order/table/OrdersTable.jsx', {
    services: { paymentService: { getOrderPayments: async (id) => {
      requested.push(id);
      return [];
    } } }
  });
  const order = { orderId: 42, paidAmount: 90 };
  const getTable = () => nodes(page.render()).find((node) => Array.isArray(node.props?.columns));
  const getToggle = (table) => nodes(table.props.columns.find((column) => column.id === 'orderId')
    .cell({ row: { original: order } })).find((node) => node.type === 'button');
  let table = getTable();
  assert.ok(getToggle(table), 'the arrow is visible without embedded payment rows');
  const pending = getToggle(table).props.onClick();
  table = getTable();
  assert.equal(getToggle(table).props['aria-expanded'], true);
  assert.match(text(table.props.renderSubRows(order)), /Loading payments/);
  await pending;
  table = getTable();
  assert.deepEqual(requested, [42]);
  assert.match(text(table.props.renderSubRows(order)), /No payments found/);
  await getToggle(table).props.onClick();
  table = getTable();
  assert.equal(table.props.renderSubRows(order), null);
  assert.deepEqual(requested, [42], 'collapsing does not fetch again');
});

test('orders hydrate payment types and expanded sale/refund rows from the Payment API', async () => {
  const requested = [];
  const sale = { paymentId: 17, orderId: 42, amount: 90, saleType: 'Sale', paymentType: 'Card', cardType: 'Visa',
    cardNumber: '4111111111112628', transactionId: 'TX123', authCode: '938845', brandName: 'Example', gatewayName: 'Card gateway' };
  const refund = { ...sale, paymentId: 18, refundPaymentId: 17, amount: 20, saleType: 'Refund' };
  const order = { orderId: 42, customerName: 'Jack Smith', customerEmail: 'jack@example.test', customerPhone: '1234567890', payments: [] };
  const page = component('src/pages/order/table/OrdersTable.jsx', {
    effects: true,
    services: {
      orderService: { getOrders: async () => ({ data: [order], totalCount: 1 }), getOrderSummary: async () => ({}) },
      paymentService: { getOrderPayments: async (id) => { requested.push(id); return [sale, refund]; } }
    }
  });
  const getTable = () => nodes(page.render()).find((node) => Array.isArray(node.props?.columns));
  getTable();
  await page.flushEffects();
  let table = getTable();
  assert.deepEqual(requested, [], 'browsing orders does not fetch payment history before expansion');
  const initial = table.props.data[0];
  await table.props.onRowClick(initial, 0, { target: { closest: () => null } });
  table = getTable();
  assert.deepEqual(requested, [42]);
  const loaded = table.props.data[0];
  assert.equal(loaded.payments.length, 2, 'empty Order payments do not hide Payment API data');
  const methodCell = table.props.columns.find((column) => column.id === 'paymentType').cell({ row: { original: loaded } });
  assert.match(text(methodCell), /Visa2628Trans id: TX123Auth: 938845/);
  assert.equal(text(methodCell).includes('4111111111112628'), false, 'only the last four card digits are displayed');
  assert.equal(text(methodCell).match(/938845/g).length, 1, 'refund rows do not duplicate the payment method');
  const customer = table.props.columns.find((column) => column.id === 'customerName').cell({ row: { original: loaded } });
  assert.match(text(customer), /Jack Smithjack@example.test1234567890/);
  const expanded = table.props.renderSubRows(loaded);
  assert.ok(nodes(expanded).some((node) => node.props?.['aria-label'] === 'Actions for payment 17'));
  assert.ok(nodes(expanded).some((node) => node.props?.['aria-label'] === 'Actions for payment 18'));
  assert.match(text(expanded), /Refund/);
  await table.props.onRowClick(loaded, 0, { target: { closest: () => ({ tagName: 'BUTTON' }) } });
  assert.ok(getTable().props.renderSubRows(loaded), 'action clicks do not also toggle the order');
  assert.deepEqual(requested, [42], 'action clicks do not reload payment history');
});

test('failed order payment loads show an error and retry on re-expansion', async () => {
  let attempts = 0;
  const order = { orderId: 42, payments: [] };
  const page = component('src/pages/order/table/OrdersTable.jsx', {
    services: { paymentService: { getOrderPayments: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('Payment request failed');
      return [];
    } } }
  });
  const table = () => nodes(page.render()).find((node) => Array.isArray(node.props?.columns));
  const toggle = () => nodes(table().props.columns.find((column) => column.id === 'orderId').cell({ row: { original: order } }))
    .find((node) => node.props?.['aria-label']?.includes('payments'));
  await toggle().props.onClick();
  assert.match(text(table().props.renderSubRows(order)), /Unable to load payments/);
  await toggle().props.onClick();
  await toggle().props.onClick();
  assert.match(text(table().props.renderSubRows(order)), /No payments found/);
  assert.equal(attempts, 2);
});

test('expanded refund actions target the selected original payment and exclude voided and refund rows', async () => {
  const requested = [];
  const page = component('src/pages/order/table/OrdersTable.jsx', {
    services: { paymentService: { getOrderPayments: async () => order.payments, getRefundContext: async (id) => {
      requested.push(id);
      return { payment: { paymentId: id, orderId: 42, saleType: 'Sale' }, availableAmount: 90 };
    } } }
  });
  const getTable = () => nodes(page.render()).find((node) => Array.isArray(node.props?.columns));
  const order = { orderId: 42, payments: [
    { paymentId: 17, saleType: 'Sale' }, { paymentId: 18, saleType: 'Sale' },
    { paymentId: 19, saleType: 'Refund' }, { paymentId: 20, saleType: 'Sale', isVoid: true }
  ] };
  const idCell = getTable().props.columns.find((column) => column.id === 'orderId').cell({ row: { original: order } });
  await nodes(idCell).find((node) => node.props?.['aria-label'] === 'Expand payments').props.onClick();
  const groups = nodes(getTable().props.renderSubRows(order)).filter((node) => node.props?.['aria-label']?.startsWith('Actions for payment '));
  assert.equal(groups.filter((group) => nodes(group).some((node) => node.props?.label === 'Refund')).length, 2);
  const selected = groups.find((group) => group.props['aria-label'] === 'Actions for payment 18');
  nodes(selected).find((node) => node.props?.label === 'Refund').props.onClick();
  await new Promise(setImmediate);
  assert.deepEqual(requested, [18]);
});

test('order payment actions respect View and Refund permissions', () => {
  for (const [permissionCodes, expectedExpand] of [[['View_Order'], false], [['View_Order', 'View_Order_Payment'], true]]) {
    const page = component('src/pages/order/table/OrdersTable.jsx', { permissionCodes });
    const table = nodes(page.render()).find((node) => Array.isArray(node.props?.columns));
    const actions = table.props.columns.find((column) => column.id === 'actions').cell({ row: { original: { orderId: 42, payments: [{ paymentId: 17, saleType: 'Sale' }] } } });
    assert.equal(nodes(actions).some((node) => node.props?.['aria-label'] === 'Refund payment'), false);
    assert.equal(nodes(actions).some((node) => node.props?.['aria-label'] === 'More order options'), false);
    const idCell = table.props.columns.find((column) => column.id === 'orderId').cell({ row: { original: { orderId: 42 } } });
    assert.equal(nodes(idCell).some((node) => node.props?.['aria-label'] === 'Expand payments'), expectedExpand);
  }
});

test('privileged order viewers can expand payments and use actions when dedicated payment codes are missing', async () => {
  for (const roleName of ['Developer', 'Admin', 'Super Admin']) {
    const page = component('src/pages/order/table/OrdersTable.jsx', {
      user: { roleName }, permissionCodes: ['View_Order'], services: { paymentService: { getOrderPayments: async () => [{ paymentId: 17, orderId: 42, saleType: 'Sale', amount: 90 }] } }
    });
    const order = { orderId: 42, payments: [{ paymentId: 17, orderId: 42, saleType: 'Sale', amount: 90 }] };
    const table = () => nodes(page.render()).find((node) => Array.isArray(node.props?.columns));
    const toggle = () => nodes(table().props.columns.find((column) => column.id === 'orderId')
      .cell({ row: { original: order } })).find((node) => node.props?.['aria-label']?.includes('payments'));
    assert.ok(toggle(), roleName + ' sees the expand arrow');
    await toggle().props.onClick();
    assert.equal(toggle().props['aria-expanded'], true);
    const expanded = table().props.renderSubRows(order);
    assert.ok(expanded, roleName + ' can open payment details');
    for (const label of ['Refund', 'Void payment', 'Edit', 'Delete payment']) {
      assert.ok(nodes(expanded).some((node) => node.props?.label === label), roleName + ' can see ' + label);
    }
    await toggle().props.onClick();
    assert.equal(table().props.renderSubRows(order), null);
  }
});

test('personal permission overrides and pending page permissions cannot inherit privileged payment access', () => {
  for (const options of [
    { user: { roleName: 'Developer', isAssignPersonalPermission: true } },
    { user: { roleName: 'Admin', isAssignPersonalPermission: 'true' } },
    { user: { roleName: 'Developer' }, permissionsLoading: true },
    { user: { roleName: 'Developer' }, canView: false }
  ]) {
    const page = component('src/pages/order/table/OrdersTable.jsx', { ...options, permissionCodes: ['View_Order'] });
    const table = nodes(page.render()).find((node) => Array.isArray(node.props?.columns));
    const cell = table.props.columns.find((column) => column.id === 'orderId')
      .cell({ row: { original: { orderId: 42, payments: [{ paymentId: 17 }] } } });
    assert.equal(nodes(cell).some((node) => node.props?.['aria-label'] === 'Expand payments'), false);
  }
});

test('the granted View_Payments code exposes order payment details without granting refund actions', async () => {
  const page = component('src/pages/order/table/OrdersTable.jsx', {
    permissionCodes: ['View_Order'], paymentPermissionCodes: ['View_Payments'], user: { roleName: 'Agent' }
  });
  const order = { orderId: 42, payments: [{ paymentId: 17, orderId: 42, saleType: 'Sale', amount: 90 }] };
  const table = () => nodes(page.render()).find((node) => Array.isArray(node.props?.columns));
  assert.equal(typeof table().props.onRowClick, 'function');
  await table().props.onRowClick(order, 0, { target: { closest: () => null } });
  const expanded = table().props.renderSubRows(order);
  assert.ok(expanded);
  assert.equal(nodes(expanded).some((node) => node.props?.label === 'Refund'), false);
  assert.equal(nodes(expanded).some((node) => node.props?.label === 'Delete payment'), false);
  await table().props.onRowClick(order, 0, { target: { closest: () => null } });
  assert.equal(table().props.renderSubRows(order), null);
});

test('personal viewers can expand granted payments without seeing ungranted refund actions', async () => {
  const page = component('src/pages/order/table/OrdersTable.jsx', {
    user: { roleName: 'Developer', isAssignPersonalPermission: true },
    permissionCodes: ['View_Order', 'View_Order_Payment']
  });
  const order = { orderId: 42, payments: [{ paymentId: 17, saleType: 'Sale', amount: 90 }] };
  const table = () => nodes(page.render()).find((node) => Array.isArray(node.props?.columns));
  const cell = table().props.columns.find((column) => column.id === 'orderId').cell({ row: { original: order } });
  await nodes(cell).find((node) => node.props?.['aria-label'] === 'Expand payments').props.onClick();
  const expanded = table().props.renderSubRows(order);
  assert.ok(expanded);
  assert.equal(nodes(expanded).some((node) => node.props?.label === 'Refund'), false);
  assert.equal(nodes(expanded).some((node) => node.props?.label === 'Delete payment'), false);
});

test('order overview shows supplied customer contacts and payment references while masking the card number', () => {
  const page = component('src/pages/order/table/OrdersTable.jsx');
  const table = nodes(page.render()).find((node) => Array.isArray(node.props?.columns));
  const order = { orderId: 42, customerName: 'Test Customer', customerEmail: 'customer@example.test', customerPhone: '2025550123',
    payments: [{ paymentId: 17, paymentType: 'Card', cardType: 'Visa', cardNumber: '4111111111112628',
      transactionId: '12376689964', authCode: '938845', saleType: 'Sale', isVoid: 'false', isDeleted: 'false' }] };
  const cell = (id) => table.props.columns.find((column) => column.id === id).cell({ row: { original: order } });
  assert.match(text(cell('customerName')), /Test Customer/);
  assert.match(text(cell('customerName')), /customer@example.test/);
  assert.match(text(cell('customerName')), /2025550123/);
  const paymentText = text(cell('paymentType'));
  for (const value of ['Card', 'Visa', '2628', '12376689964', '938845']) assert.ok(paymentText.includes(value), value);
  assert.equal(paymentText.includes('4111111111112628'), false);
});

test('expanded payment rows span every parent column and keep the action toolbar in one row', async () => {
  const page = component('src/pages/order/table/OrdersTable.jsx', { services: { paymentService: { getOrderPayments: async () => [{ paymentId: 17, orderId: 42, paymentType: 'Card', saleType: 'Sale', amount: 199.99 }] } } });
  const getTable = () => nodes(page.render()).find((node) => Array.isArray(node.props?.columns));
  const order = { orderId: 42, payments: [{ paymentId: 17, paymentType: 'Card', saleType: 'Sale', amount: 199.99 }] };
  const cell = getTable().props.columns.find((column) => column.id === 'orderId').cell({ row: { original: order } });
  await nodes(cell).find((node) => node.props?.['aria-label'] === 'Expand payments').props.onClick();
  const table = getTable();
  const expanded = table.props.renderSubRows(order);
  assert.equal(nodes(expanded).find((node) => node.type === 'td').props.colSpan, table.props.columns.length);
  assert.equal(text(nodes(expanded).find((node) => node.type === 'th')), 'Action');
  const toolbar = nodes(expanded).find((node) => node.props?.['aria-label'] === 'Actions for payment 17');
  assert.match(toolbar.props.className, /flex-nowrap/);
  assert.equal(nodes(expanded).some((node) => node.type === 'th' && text(node) === 'Payment Type'), false, 'single-method orders use the parent payment summary');
  order.payments.push({ paymentId: 18, paymentType: 'Bank', saleType: 'Sale', amount: 100 });
  const mixed = getTable().props.renderSubRows(order);
  assert.equal(nodes(mixed).some((node) => node.type === 'th' && text(node) === 'Payment Type'), true, 'mixed-method rows retain their individual payment types');
});

test('gateway options are disabled and empty until a brand is selected', () => {
  const tree = component('src/pages/order/CreateOrderPage.jsx').render();
  const select = nodes(tree).find(
    (node) => node.props?.onValueChange && nodes(node).some((child) => child.props?.placeholder === 'Select a brand first')
  );
  assert.ok(select);
  assert.equal(select.props.disabled, true);
});

test('Edit Order loads from its URL, auto-fills saved fields, and saves the existing order without a payment request', async () => {
  const updates = [];
  const reads = [];
  const saved = {
    orderId: 12,
    customerId: 4,
    customerName: 'Saved Customer',
    salesPersonId: 7,
    salesPersonName: 'Saved Seller',
    saleDate: '2026-10-20T12:00:00Z',
    notes: 'Saved notes',
    subtotal: 200,
    discountAmount: 20,
    discountType: 'Fixed',
    orderItems: [
      { orderItemId: 25, productId: 9, productName: 'Saved product', unitPrice: 100, quantity: 2, subscriptionMonths: 12 },
      { orderItemId: 26, productId: 10, productName: 'Second product', unitPrice: 50, quantity: 1, subscriptionMonths: 24 }
    ]
  };
  const page = component('src/pages/order/CreateOrderPage.jsx', {
    query: 'orderId=12&mode=edit',
    effects: true,
    services: {
      orderService: {
        getOrderById: async (id) => {
          reads.push(id);
          return saved;
        },
        updateOrder: async (payload) => updates.push(payload)
      },
      customerService: { getCustomerById: async () => ({ customerId: 4, name: 'Saved Customer', email: 'saved@example.test' }) },
      paymentService: new Proxy(
        {},
        {
          get: () => () => {
            throw new Error('Order edits must not write a payment');
          }
        }
      )
    }
  });
  page.render();
  await page.flushEffects();
  const tree = page.render();
  assert.deepEqual(reads, [12]);
  assert.ok(nodes(tree).some((node) => node.props?.title === 'Edit Order #12'));
  assert.ok(nodes(tree).some((node) => node.props?.value === 'Saved notes'));
  assert.ok(text(tree).includes('Saved product'));
  assert.ok(text(tree).includes('Saved Seller'));
  assert.equal(hasLabel(tree, 'Card Number'), false);
  const save = nodes(tree).find((node) => text(node) === 'Update Order' && node.props?.onClick);
  assert.ok(save);
  assert.equal(save.props.disabled, false);
  await save.props.onClick();
  assert.equal(updates.length, 1);
  assert.equal(updates[0].orderId, 12);
  assert.equal(updates[0].orderItems[0].orderItemId, 25);
  assert.equal(updates[0].orderItems[0].subscriptionMonths, 12);
  assert.equal(updates[0].orderItems[1].subscriptionMonths, 24);
  assert.equal(updates[0].totalAmount, 230);
  assert.equal('payment' in updates[0], false);
  assert.equal(page.navigations[0][0], '/Orders');
});

test('a failed order load shows an error and blocks saving', async () => {
  let writes = 0;
  const page = component('src/pages/order/CreateOrderPage.jsx', {
    query: 'orderId=12&mode=edit',
    effects: true,
    services: {
      orderService: {
        getOrderById: async () => {
          throw new Error('Order access denied');
        },
        updateOrder: async () => {
          writes += 1;
        }
      }
    }
  });
  page.render();
  await page.flushEffects();
  const tree = page.render();
  assert.ok(nodes(tree).some((node) => node.props?.role === 'alert' && text(node).includes('Order access denied')));
  const save = nodes(tree).find((node) => text(node) === 'Update Order' && node.props?.onClick);
  assert.equal(save.props.disabled, true);
  await save.props.onClick();
  assert.equal(writes, 0);
});

test('failed Void stays open for retry and successful retry preserves payment details', async () => {
  let attempts = 0;
  const writes = [];
  const payment = { paymentId: 17, orderId: 42, saleType: 'Sale', paymentType: 'Bank', amount: 90, transactionId: 'TX-17' };
  const order = { orderId: 42, payments: [payment] };
  const page = component('src/pages/order/table/OrdersTable.jsx', {
    services: {
      orderService: { getOrders: async () => ({ data: [order], totalCount: 1 }), getOrderSummary: async () => ({}) },
      paymentService: {
        getOrderPayments: async () => [payment], getOrderPaymentById: async () => payment,
        updatePayment: async (payload) => { attempts++; if (attempts === 1) throw new Error('Void denied'); writes.push(payload); }
      }
    }
  });
  const table = () => nodes(page.render()).find((node) => Array.isArray(node.props?.columns));
  await nodes(table().props.columns.find((column) => column.id === 'orderId').cell({ row: { original: order } }))
    .find((node) => node.props?.['aria-label'] === 'Expand payments').props.onClick();
  nodes(table().props.renderSubRows(order)).find((node) => node.props?.label === 'Void payment').props.onClick();
  const modal = () => nodes(page.render()).find((node) => node.props?.title === 'Void Payment');
  await modal().props.onConfirm();
  assert.equal(modal().props.open, true, 'a failed PUT does not close the confirmation');
  await modal().props.onConfirm();
  assert.equal(modal().props.open, false);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].isVoid, true);
  assert.equal(writes[0].transactionId, 'TX-17');
});

test('failed payment edit cannot save a new payment and can reload using Retry', async () => {
  let attempts = 0;
  let writes = 0;
  const payment = { paymentId: 17, orderId: 42, saleType: 'Sale', paymentType: 'Bank', amount: 90 };
  const order = { orderId: 42, payments: [payment] };
  const page = component('src/pages/order/table/OrdersTable.jsx', {
    services: { paymentService: {
      getOrderPayments: async () => [payment],
      getOrderPaymentById: async () => { if (++attempts === 1) throw new Error('Payment unavailable'); return payment; },
      createPayment: async () => { writes++; }, updatePayment: async () => { writes++; }
    } }
  });
  const table = () => nodes(page.render()).find((node) => Array.isArray(node.props?.columns));
  await nodes(table().props.columns.find((column) => column.id === 'orderId').cell({ row: { original: order } }))
    .find((node) => node.props?.['aria-label'] === 'Expand payments').props.onClick();
  await nodes(table().props.renderSubRows(order)).find((node) => node.props?.label === 'Edit').props.onClick();
  await new Promise(setImmediate);
  let tree = page.render();
  assert.match(text(tree), /Payment unavailable/);
  const save = nodes(tree).find((node) => node.props?.onClick && text(node) === 'Update Payment');
  assert.ok(save.props.disabled);
  await save.props.onClick();
  assert.equal(writes, 0);
  await nodes(tree).find((node) => node.type === 'button' && text(node) === 'Retry loading payment').props.onClick();
  tree = page.render();
  assert.equal(text(tree).includes('Retry loading payment'), false);
  assert.equal(attempts, 2);
});

test('View payments uses the expand arrow and waits for the Payment API', async () => {
  let resolve;
  const pending = new Promise(done => { resolve = done; });
  const order = { orderId: 42, payments: [{ paymentId: 17, saleType: 'Sale', amount: 90 }] };
  const page = component('src/pages/order/table/OrdersTable.jsx', { services: { paymentService: { getOrderPayments: () => pending } } });
  const table = () => nodes(page.render()).find(node => Array.isArray(node.props?.columns));
  const toggle = nodes(table().props.columns.find(column => column.id === 'orderId').cell({ row: { original: order } }))
    .find(node => node.props?.['aria-label'] === 'Expand payments');
  const request = toggle.props.onClick();
  assert.match(text(table().props.renderSubRows(order)), /Loading payments/);
  assert.equal(nodes(table().props.renderSubRows(order)).some(node => node.props?.label === 'Refund'), false);
  resolve(order.payments);
  await request;
  assert.ok(nodes(table().props.renderSubRows(order)).some(node => node.props?.label === 'Refund'));
});


test('View payments hides stale Order data on API failure and Retry displays the Payment API response', async () => {
  let attempts = 0;
  const stale = { paymentId: 17, orderId: 42, authCode: 'OLD-AUTH', amount: 10, saleType: 'Sale', paymentType: 'Card' };
  const current = { paymentId: 43, orderId: 42, authCode: '86868', amount: 90.99, saleType: 'Sale', paymentType: 'Card', brandName: 'Current brand', gatewayName: 'Current gateway' };
  const order = { orderId: 42, payments: [stale] };
  const page = component('src/pages/order/table/OrdersTable.jsx', { effects: true, services: {
    orderService: { getOrders: async () => ({ data: [order], totalCount: 1 }), getOrderSummary: async () => ({}) },
    paymentService: { getOrderPayments: async () => { if (++attempts === 1) throw new Error('Payment unavailable'); return [current]; } }
  } });
  const table = () => nodes(page.render()).find(node => Array.isArray(node.props?.columns));
  table(); await page.flushEffects();
  await table().props.onRowClick(table().props.data[0], 0, { target: { closest: () => null } });
  let expanded = table().props.renderSubRows(table().props.data[0]);
  assert.match(text(expanded), /Unable to load payments/);
  assert.equal(text(expanded).includes('OLD-AUTH'), false);
  assert.equal(nodes(expanded).some(node => node.props?.label === 'Refund'), false);
  await nodes(expanded).find(node => node.type === 'button' && text(node) === 'Retry payments').props.onClick();
  expanded = table().props.renderSubRows(table().props.data[0]);
  assert.match(text(expanded), /86868/);
  assert.match(text(expanded), /90.99/);
  assert.match(text(expanded), /Current gateway/);
  assert.equal(text(expanded).includes('OLD-AUTH'), false);
  assert.ok(nodes(expanded).some(node => node.props?.['aria-label'] === 'Actions for payment 43'));
});
