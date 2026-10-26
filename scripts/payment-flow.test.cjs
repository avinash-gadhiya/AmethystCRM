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
  const dependency = (name) => (name === './core/apiClient' ? { __esModule: true, default: api } : methods);
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
    useRef: (current) => ({ current })
  };
  const permissionHook = () => ({ loading: false, canView: true, canAdd: true, canUpdate: true, canDelete: true, has: () => true });
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
          { get: (_target, service) => options.services?.[service] || new Proxy({}, { get: () => async () => ({ data: [] }) }) }
        );
      if (name.includes('usePageCrudPermissions')) return { usePageCrudPermissions: permissionHook };
      if (name.includes('usePagePermissionCodes'))
        return { __esModule: true, default: permissionHook, usePagePermissionCodes: permissionHook };
      if (name.includes('useSearchFieldFetchGuard')) return { useSearchFieldFetchGuard: () => ({ current: false }) };
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
