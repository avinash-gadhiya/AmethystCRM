const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('esbuild');
const React = require('react');

function load(file, dependency = require, globals = {}) {
  const source = fs.readFileSync(file, 'utf8').replaceAll('import.meta.env', '({})');
  const code = transformSync(source, { loader: 'jsx', format: 'cjs' }).code;
  const context = { module: { exports: {} }, require: dependency, console, ...globals };
  vm.runInNewContext(code, context, { filename: file });
  return context.module.exports;
}
const plain = (value) => JSON.parse(JSON.stringify(value));
const payloads = load('src/lib/customerPayload.js');
const actor = { userId: 99, displayName: 'CRM Creator' };
const fixture = {
  customerId: 0,
  leadId: 0,
  name: 'Test Customer',
  email: 'customer@example.test',
  phone: '(202) 555-0123',
  phone2: '',
  address: '',
  city: 'Columbus',
  stateId: 5,
  stateName: 'Ohio',
  zipCode: '43215',
  countryId: 1,
  countryName: 'USA',
  salesPerson: 7,
  salesPersonName: 'Test Seller',
  isActive: true
};

function service(api) {
  return load('src/services/customerService.js', (name) => {
    if (name === './core/apiClient') return { __esModule: true, default: api };
    if (name === './authService') return { __esModule: true, default: { getUser: () => actor } };
    if (name === './clientIpService') return { getCurrentLoginIpv4: async () => '192.0.2.9' };
    if (name === '@/lib/customerPayload') return payloads;
    throw Error(`Unexpected dependency: ${name}`);
  }).default;
}

test('Customer POST uses the supplied DTO, optional lead, and current creator without child transactions', async () => {
  let request;
  const customers = service({
    post: async (path, data) => {
      request = { path, data };
      return { Success: true, Data: { CustomerId: 45, Name: data.name } };
    }
  });
  const saved = await customers.createCustomer({
    ...fixture,
    customerId: 888,
    name: ' Test Customer ',
    createdBy: 666,
    createdByName: 'Wrong Creator',
    createdDate: '2000-01-01',
    getOrderListDTOs: [{ orderId: 4 }],
    getTicketListDTOs: [{ ticketId: 5 }],
    updatedBy: 44,
    uiOnly: true
  });
  assert.equal(request.path, '/Customer');
  assert.deepEqual(
    Object.keys(request.data).sort(),
    [
      'customerId',
      'name',
      'email',
      'phone',
      'phone2',
      'address',
      'city',
      'stateId',
      'stateName',
      'zipCode',
      'countryId',
      'countryName',
      'isActive',
      'createdBy',
      'createdByName',
      'createdDate',
      'salesPerson',
      'salesPersonName',
      'leadId',
      'getOrderListDTOs',
      'getTicketListDTOs'
    ].sort()
  );
  assert.equal(request.data.customerId, 0);
  assert.equal(request.data.leadId, 0);
  assert.equal(request.data.name, 'Test Customer');
  assert.equal(request.data.phone, '2025550123');
  assert.equal(request.data.createdBy, 99);
  assert.equal(request.data.createdByName, 'CRM Creator');
  assert.ok(Date.now() - Date.parse(request.data.createdDate) < 10000);
  assert.deepEqual(plain(request.data.getOrderListDTOs), []);
  assert.deepEqual(plain(request.data.getTicketListDTOs), []);
  assert.equal(saved.customerId, 45);
  assert.equal(saved.email, fixture.email);
});

test('customer response IDs and wrapped detail/list responses are normalized', async () => {
  for (const response of [{ data: 46 }, 46, { data: { customerId: 46 } }]) {
    const customers = service({ post: async () => response });
    assert.equal((await customers.createCustomer(fixture)).customerId, 46);
  }
  const calls = [];
  const customers = service({
    request: async (path, options) => {
      calls.push({ path, options });
      return { Data: [{ CustomerId: 1 }, { CustomerId: 46, Name: 'Correct Customer' }], TotalCount: 60 };
    }
  });
  assert.equal((await customers.getCustomerById(46)).name, 'Correct Customer');
  assert.equal(calls[0].options.params.customerViewIp, '192.0.2.9');
  const list = await customers.getCustomers();
  assert.equal(list.totalCount, 60);
  assert.equal(list.data[1].customerId, 46);
});

test('customer creation reaches the authenticated JSON POST endpoint and rejects API business errors', async () => {
  const requests = [];
  let response = { success: true, data: { customerId: 55 } };
  const api = load(
    'src/services/core/apiClient.js',
    (name) => {
      if (name === '../authService') return { __esModule: true, default: { getToken: () => 'test-session-token' } };
      if (name === '../http') return { handleSessionExpired() {} };
      throw Error(name);
    },
    {
      URLSearchParams,
      fetch: async (url, options) => {
        requests.push({ url, options });
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'Content-Type': 'application/json' }),
          text: async () => JSON.stringify(response)
        };
      }
    }
  ).default;
  const customers = service(api);
  assert.equal((await customers.createCustomer(fixture)).customerId, 55);
  assert.equal(requests[0].url, 'https://demoapi.enstasol.com/api/Customer');
  assert.equal(requests[0].options.method, 'POST');
  assert.equal(requests[0].options.headers.Authorization, 'Bearer test-session-token');
  assert.equal(requests[0].options.headers['Content-Type'], 'application/json');
  assert.equal(JSON.parse(requests[0].options.body).createdBy, actor.userId);
  response = { success: false, message: 'Email already exists.' };
  await assert.rejects(() => customers.createCustomer(fixture), /Email already exists/);
});

test('customer updates preserve identity, creation details and existing relations; errors propagate', async () => {
  let request;
  const customers = service({
    put: async (path, data) => {
      request = { path, data };
      return { data };
    }
  });
  const customer = {
    ...fixture,
    customerId: 21,
    createdBy: 12,
    createdByName: 'Original Creator',
    createdDate: '2025-01-01T00:00:00Z',
    getOrderListDTOs: [{ orderId: 9 }],
    isActive: false
  };
  await customers.updateCustomer(customer);
  assert.equal(request.path, '/Customer');
  assert.equal(request.data.customerId, 21);
  assert.equal(request.data.createdBy, 12);
  assert.equal(request.data.createdDate, customer.createdDate);
  assert.equal(request.data.isActive, false);
  assert.deepEqual(plain(request.data.getOrderListDTOs), [{ orderId: 9 }]);
  await assert.rejects(() => customers.updateCustomer({ ...fixture, customerId: 0 }), /Customer ID is required/);
  const failure = Object.assign(Error('Duplicate email'), { status: 400 });
  await assert.rejects(
    () =>
      service({
        post: async () => {
          throw failure;
        }
      }).createCustomer(fixture),
    (e) => e === failure
  );
});

test('country and state API choices support PascalCase responses and filter states by country', async () => {
  const calls = [];
  const country = load('src/services/countryService.js', (name) => {
    if (name === 'axios')
      return {
        get: async (url, options) => {
          calls.push({ url, options });
          return {
            data: {
              Data: url.endsWith('/State')
                ? [
                    { StateId: 5, StateName: 'Ohio', CountryId: 1 },
                    { StateId: 6, StateName: 'Other country', CountryId: 2 }
                  ]
                : [{ CountryId: 1, CountryName: 'USA' }]
            }
          };
        }
      };
    if (name === './http') return { getAuthHeaders: () => ({ Authorization: 'Bearer test-only' }) };
    throw Error(name);
  }).default;
  assert.equal((await country.getCountryDropdown()).data[0].countryId, 1);
  const states = await country.getStates({ CountryId: 1, countryName: 'USA' });
  assert.deepEqual(plain(states), [{ stateId: 5, stateName: 'Ohio', countryId: 1, countryName: 'USA' }]);
  assert.equal(calls[1].options.params.CountryId, 1);
  assert.equal(calls[1].options.headers.Authorization, 'Bearer test-only');
});

// Run the real components' effects and event handlers. UI primitives are opaque
// React elements; API responses are controlled so no live customers are created.
function component(file, options = {}) {
  const slots = [];
  let cursor = 0,
    dirty = true,
    tree;
  let props = options.props || {};
  const pending = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const hooks = {
    ...React,
    useState(initial) {
      const i = cursor++;
      if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial };
      return [
        slots[i].value,
        (value) => {
          const next = typeof value === 'function' ? value(slots[i].value) : value;
          if (!Object.is(next, slots[i].value)) {
            slots[i].value = next;
            dirty = true;
          }
        }
      ];
    },
    useRef(value) {
      const i = cursor++;
      return (slots[i] ||= { current: value });
    },
    useMemo(fn, deps) {
      const i = cursor++;
      if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { value: fn(), deps };
      return slots[i].value;
    },
    useCallback(fn, deps) {
      return hooks.useMemo(() => fn, deps);
    },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!slots[i] || !same(slots[i].deps, deps)) {
        const cleanup = slots[i]?.cleanup;
        slots[i] = { deps };
        pending.push(() => {
          cleanup?.();
          slots[i].cleanup = fn();
        });
      }
    }
  };
  const ui = new Map();
  const stub = (name) => {
    if (!ui.has(name)) {
      const values = { __esModule: true, default: () => null };
      ui.set(name, new Proxy(values, { get: (target, key) => (target[key] ||= () => null) }));
    }
    return ui.get(name);
  };
  const document = {
    body: { style: {}, classList: { contains: () => false }, getAttribute: () => 'light' },
    documentElement: { classList: { contains: () => false }, getAttribute: () => 'light' },
    addEventListener() {},
    removeEventListener() {},
    querySelector: () => null
  };
  const exported = load(
    file,
    (name) => {
      if (name === 'react') return hooks;
      if (name === 'react-dom') return { createPortal: (child) => child };
      if (name === 'components/ui/Bootstrap') {
        const Modal = Object.assign(() => null, { Header: () => null, Body: () => null, Footer: () => null, Title: () => null });
        return { Modal };
      }
      if (name === '@/services') return options.services;
      if (name.endsWith('/authService')) return { __esModule: true, default: { getUser: () => actor } };
      if (name === 'services/customerService') return { __esModule: true, default: options.services.customerService };
      if (name === '@/lib/salesRoles')
        return { fetchSalesPersonList: options.sales || (async () => [{ userId: 7, fullName: 'Test Seller' }]) };
      if (name === '@/lib/usPhone') return load('src/lib/usPhone.js');
      if (name === '@/lib/apiError') return { getApiErrorMessage: (e, fallback) => e?.message || fallback };
      if (name === '@/lib/utils') return { cn: (...values) => values.filter(Boolean).join(' ') };
      if (name === '@/services/http') return { getAuthHeaders: () => ({}) };
      if (name === '@/utils/configuredPagePermissions')
        return { resolveConfiguredPagePermissions: () => options.permissions || { canAdd: true, canUpdate: true, canDelete: true } };
      if (name === 'sonner') return { toast: { error() {}, success() {} } };
      if (name === 'axios')
        return {
          get: async () => {
            throw Error('Unexpected request');
          }
        };
      return stub(name);
    },
    { React: hooks, document, window: { setTimeout, clearTimeout }, setTimeout, clearTimeout, AbortController }
  );
  const render = () => {
    cursor = 0;
    dirty = false;
    tree = exported.default(props);
    return tree;
  };
  return {
    render,
    ui,
    document,
    async settle(nextProps) {
      if (nextProps) {
        props = { ...props, ...nextProps };
        dirty = true;
      }
      for (let i = 0; i < 25; i++) {
        if (dirty) render();
        pending.splice(0).forEach((effect) => effect());
        await new Promise(setImmediate);
        if (!dirty && !pending.length) return tree;
      }
      throw Error('Component did not settle');
    },
    cleanup() {
      slots.forEach((slot) => slot?.cleanup?.());
    }
  };
}
function nodes(element) {
  if (!element || typeof element !== 'object') return [];
  return [element, ...React.Children.toArray(element.props?.children).flatMap(nodes)];
}
const find = (tree, predicate) => nodes(tree).find(predicate);
const text = (tree) => (typeof tree === 'string' ? tree : React.Children.toArray(tree?.props?.children).map(text).join(''));
const form = (tree) => find(tree, (n) => n.type === 'form');
const field = (tree, name) => find(tree, (n) => n.props?.name === name);
const submit = (tree) => find(tree, (n) => n.props?.type === 'submit');
const defaultCountries = {
  getCountryDropdown: async () => ({ data: [{ countryId: 1, countryName: 'USA' }] }),
  getStates: async () => [{ stateId: 5, stateName: 'Ohio', countryId: 1 }]
};
function modal(overrides = {}) {
  return component('src/components/customer/CustomerFormModal.jsx', {
    ...overrides,
    props: { open: true, initialValues: fixture, ...overrides.props },
    services: { countryService: defaultCountries, customerService: {}, ...overrides.services }
  });
}

test('modal POST allows no lead, blocks duplicate submits and closes only after successful save', async (t) => {
  let resolve,
    count = 0,
    saved,
    closed;
  const request = new Promise((done) => {
    resolve = done;
  });
  const view = modal({
    services: {
      customerService: {
        createCustomer: (data) => {
          count++;
          assert.equal(data.leadId, 0);
          return request;
        }
      }
    },
    props: {
      onSaved: (value) => {
        saved = value;
      },
      onOpenChange: (value) => {
        closed = value;
      }
    }
  });
  t.after(() => view.cleanup());
  let tree = await view.settle();
  assert.equal(submit(tree).props.disabled, false);
  const event = { preventDefault() {} };
  const first = form(tree).props.onSubmit(event);
  await form(tree).props.onSubmit(event);
  assert.equal(count, 1);
  tree = view.render();
  assert.equal(submit(tree).props.disabled, true);
  assert.equal(find(tree, (n) => n.type === 'fieldset').props.disabled, true);
  find(tree, (n) => n.type === 'button' && text(n) === 'Cancel').props.onClick();
  assert.equal(closed, undefined);
  resolve({ ...fixture, customerId: 45 });
  await first;
  assert.equal(saved.customerId, 45);
  assert.equal(closed, false);
});

test('modal keeps input and displays API validation errors after a failed POST', async (t) => {
  let closed = false;
  const view = modal({
    services: {
      customerService: {
        createCustomer: async () => {
          throw { payload: { errors: { Email: ['Email already exists.'] } } };
        }
      }
    },
    props: {
      onOpenChange: () => {
        closed = true;
      }
    }
  });
  t.after(() => view.cleanup());
  let tree = await view.settle();
  await form(tree).props.onSubmit({ preventDefault() {} });
  tree = await view.settle();
  assert.equal(text(find(tree, (n) => n.props?.role === 'alert')), 'Email already exists.');
  assert.equal(field(tree, 'name').props.value, fixture.name);
  assert.equal(submit(tree).props.disabled, false);
  assert.equal(closed, false);
});

test('country loading can be retried without clearing input; lookup APIs only run when open', async (t) => {
  let countries = 0,
    states = 0,
    sellers = 0;
  const view = modal({
    props: { open: false },
    sales: async () => {
      sellers++;
      return [];
    },
    services: {
      countryService: {
        getCountryDropdown: async () => {
          if (++countries === 1) throw Error('Country lookup unavailable');
          return { data: [{ countryId: 1, countryName: 'USA' }] };
        },
        getStates: async () => {
          states++;
          return [{ stateId: 5, stateName: 'Ohio', countryId: 1 }];
        }
      }
    }
  });
  t.after(() => view.cleanup());
  assert.equal(await view.settle(), null);
  assert.equal(countries + states + sellers, 0);
  let tree = await view.settle({ open: true });
  assert.match(text(find(tree, (n) => n.props?.role === 'alert')), /Country lookup unavailable/);
  field(tree, 'name').props.onChange({ target: { name: 'name', value: 'Typed Customer' } });
  tree = view.render();
  find(tree, (n) => n.type === 'button' && text(n) === 'Retry loading options').props.onClick();
  tree = await view.settle();
  assert.equal(countries, 2);
  assert.equal(states, 1);
  assert.equal(sellers, 2);
  assert.equal(field(tree, 'name').props.value, 'Typed Customer');
  assert.equal(
    find(tree, (n) => n.props?.role === 'alert'),
    undefined
  );
});

test('modal footer stays outside scrollable fields and validation prevents invalid/unauthorized saves', async (t) => {
  let count = 0;
  const view = modal({
    props: { initialValues: { ...fixture, email: 'bad-email' } },
    services: {
      customerService: {
        createCustomer: async () => {
          count++;
        }
      }
    }
  });
  t.after(() => view.cleanup());
  let tree = await view.settle();
  const children = React.Children.toArray(form(tree).props.children);
  assert.equal(children[0].type, 'fieldset');
  assert.equal(submit(children[0]), undefined);
  assert.ok(submit(children[1]));
  assert.match(children[1].props.className, /shrink-0/);
  await form(tree).props.onSubmit({ preventDefault() {} });
  tree = await view.settle();
  assert.equal(count, 0);
  assert.match(find(tree, (n) => n.props?.label === 'Email').props.error, /valid email/);
  tree = await view.settle({ canAdd: false });
  assert.equal(submit(tree).props.disabled, true);
  await form(tree).props.onSubmit({ preventDefault() {} });
  assert.equal(count, 0);
});

test('Customers page opens the shared modal and refreshes the customer list after creation', async (t) => {
  let calls = 0;
  const view = component('src/pages/customer/CustomersPage.jsx', {
    services: {
      customerService: {
        getCustomers: async () => {
          calls++;
          return { data: [], totalCount: 0 };
        }
      }
    }
  });
  t.after(() => view.cleanup());
  let tree = await view.settle();
  find(tree, (n) => n.props?.onClick && text(n).trim() === 'Add Customer').props.onClick();
  tree = await view.settle();
  const modalType = view.ui.get('@/components/customer/CustomerFormModal').default;
  const editor = find(tree, (n) => n.type === modalType);
  assert.equal(editor.props.open, true);
  assert.equal(editor.props.mode, 'add');
  assert.equal(editor.props.initialValues.leadId, 0);
  assert.equal(editor.props.canAdd, true);
  const before = calls;
  editor.props.onSaved({ customerId: 45 });
  await view.settle();
  assert.equal(calls, before + 1);
});
