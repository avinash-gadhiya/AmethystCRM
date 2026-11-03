const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('esbuild');
const React = require('react');

function load(file, dependency = require, globals = {}) {
  const source = fs.readFileSync(file, 'utf8').replaceAll('import.meta.env', '({})');
  const code = transformSync(source, { loader: 'jsx', format: 'cjs' }).code;
  const context = { module: { exports: {} }, require: dependency, console, AbortController, AbortSignal, ...globals };
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
  assert.deepEqual(plain(calls[0].options.params), { ip: '192.0.2.9' });
  const list = await customers.getCustomers();
  assert.equal(list.totalCount, 60);
  assert.equal(list.data[1].customerId, 46);
});

test('customer detail rejects mismatched or malformed records and does not request an aborted customer', async () => {
  for (const payload of [{ data: { customerId: 99 } }, { data: 13 }, { data: null }, '<html>error</html>']) {
    await assert.rejects(service({ request: async () => payload }).getCustomerById(13), /could not be loaded/);
  }
  let calls = 0;
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(service({ request: async () => { calls++; } }).getCustomerById(13, controller.signal), { name: 'AbortError' });
  assert.equal(calls, 0);
});

test('customer list resolves existing sales person, state and country IDs using documented dropdown APIs', async () => {
  const customers = service({ request: async (path) => {
    if (path === '/Customer') return { data: [{ customerId: 13, salesPerson: 7, stateId: 5, countryId: 1 }], totalCount: 1 };
    if (path === '/User/UserDropDown') return { Data: [{ UserId: 7, FirstName: 'Test', LastName: 'Seller' }], TotalCount: 1 };
    if (path === '/State/StateDropdown') return { data: [{ stateId: 5, stateName: 'Ohio' }], totalCount: 1 };
    if (path === '/Country/CountryDropdown') return { data: [{ countryId: 1, countryName: 'USA' }], totalCount: 1 };
    throw Error(path);
  } });
  const customer = (await customers.getCustomers()).data[0];
  assert.equal(customer.salesPersonName, 'Test Seller');
  assert.equal(customer.stateName, 'Ohio');
  assert.equal(customer.countryName, 'USA');
});

test('customer activation sends isActive true while preserving the complete profile returned by the disable endpoint', async () => {
  const calls = [];
  let active = false;
  const stored = { ...fixture, customerId: 13, address: '123 Main Street', isActive: false, createdBy: 10 };
  const customers = service({
    request: async (path, options) => {
      calls.push({ path, options });
      if (path === '/Customer/CanDisableCustomer') return { Data: { ...stored, IsActive: false } };
      assert.equal(path, '/Customer');
      assert.equal(options.params.Text, '13');
      return { data: [{ customerId: 13, isActive: active }] };
    },
    put: async (path, body) => {
      calls.push({ path, body });
      assert.equal(path, '/Customer');
      assert.equal(body.customerId, 13);
      assert.equal(body.isActive, true);
      assert.equal(body.email, fixture.email);
      assert.equal(body.phone, stored.phone);
      assert.equal(body.address, stored.address);
      assert.equal(body.salesPerson, fixture.salesPerson);
      assert.equal(body.createdBy, 10);
      active = true;
      return { success: true };
    }
  });
  const customer = await customers.toggleCustomerStatus(13, true);
  assert.equal(customer.isActive, true);
  assert.equal(customer.email, fixture.email);
  assert.equal(calls.filter((call) => call.body).length, 1);
  assert.deepEqual(plain(calls[0].options.params), { id: 13 });
});

test('deactivation uses the dedicated endpoint and confirms false without rewriting the customer profile', async () => {
  const customers = service({ request: async (path) => ({ data: path === '/Customer' ? [{ customerId: 13, isActive: 'false' }] : { customerId: 13, isActive: false } }) });
  assert.equal((await customers.toggleCustomerStatus(13, false)).isActive, false);
});

test('status confirmation detects a backend that leaves the customer inactive and never repeats the write', async () => {
  let writes = 0;
  const customers = service({
    request: async (path) => ({ data: path === '/Customer' ? [{ customerId: 13, isActive: false }] : { ...fixture, customerId: 13, isActive: false } }),
    put: async () => { writes++; return { success: true }; }
  });
  await assert.rejects(customers.toggleCustomerStatus(13, true), (error) => {
    assert.equal(error.actualStatus, false);
    assert.match(error.message, /did not apply activation/);
    return true;
  });
  assert.equal(writes, 1);
});

test('activation never sends a partial customer projection through PUT Customer', async () => {
  let writes = 0;
  const customers = service({ request: async () => ({ data: { customerId: 13, name: 'Example', isActive: false } }), put: async () => { writes++; } });
  await assert.rejects(customers.toggleCustomerStatus(13, true), /complete saved customer profile/);
  assert.equal(writes, 0);
});

test('successful sparse customer responses restore exact-ID contacts without treating blank location/owner fields as load failures', async () => {
  const calls = [];
  const customers = service({ request: async (path, options) => {
    calls.push({ path, options });
    if (path === '/Customer') return { data: [{ customerId: 13, name: 'Example', email: '', phone: '', city: '', stateId: 0, countryId: 0, salesPerson: 0, isActive: false }], totalCount: 1 };
    assert.equal(path, '/Customer/search');
    assert.equal(options.params.searchText, 'Example');
    return { data: [
      { customerId: 99, name: 'Example', city: 'Wrong customer city', salesPerson: 99 },
      { customerId: 13, name: 'Example', email: 'example@example.test', phone: '2025550199', isActive: true }
    ], totalCount: 2 };
  } });
  const result = await customers.getCustomers();
  assert.equal(result.data[0].email, 'example@example.test');
  assert.equal(result.data[0].phone, '2025550199');
  assert.equal(result.data[0].city, '');
  assert.equal(result.data[0].salesPerson, 0);
  assert.equal(result.data[0].isActive, false, 'search must not overwrite current list status');
  assert.equal(result.profileWarnings.length, 0);
  assert.ok(calls.every((call) => !call.options.method || call.options.method === 'GET'));
});

test('customer read-only profile enrichment failures preserve the table and report a warning', async () => {
  const customers = service({ request: async (path) => {
    if (path === '/Customer') return { data: [{ customerId: 13, name: 'Example', isActive: true }], totalCount: 1 };
    throw Error('Search access denied');
  } });
  const result = await customers.getCustomers();
  assert.equal(result.data[0].customerId, 13);
  assert.equal(result.profileWarnings[0].message, 'Search access denied');
});

test('customer save verification reports incomplete read-backs separately from write failures', async () => {
  const customers = service({ request: async (path) => ({ data: path === '/Customer' ? [{ customerId: 13, name: fixture.name }] : { customerId: 13, name: fixture.name } }) });
  const result = await customers.verifyCustomerSave(13, fixture);
  assert.equal(result.verified, false);
  assert.equal(result.customer, null);
  assert.ok(result.missingFields.includes('email'));
  assert.ok(result.missingFields.includes('phone'));
  assert.ok(result.missingFields.includes('salesPerson'));
  assert.match(result.message, /Customer #13 was saved/);
});

test('customer save verification accepts the persisted list record when the detail projection omits fields', async () => {
  const persisted = { ...fixture, customerId: 13 };
  const customers = service({ request: async (path) => ({ data: path === '/Customer' ? [persisted] : { customerId: 13, name: fixture.name } }) });
  const result = await customers.verifyCustomerSave(13, fixture);
  assert.equal(result.verified, true);
  assert.equal(result.customer.email, fixture.email);
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
  assert.equal('CountryId' in calls[1].options.params, false, 'State has no documented CountryId filter; returned rows are filtered locally');
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
      if (name === 'react-router-dom') return { useNavigate: () => options.navigate || (() => {}) };
      if (name === '@/lib/dynamicPaths') return { resolveDynamicPath: async () => '/Orders/CreateOrder' };
      if (name === 'react-dom') return { createPortal: (child) => child };
      if (name === 'components/ui/Bootstrap') {
        const Modal = Object.assign(() => null, { Header: () => null, Body: () => null, Footer: () => null, Title: () => null });
        return { Modal };
      }
      if (name === '@/services') return options.services;
      if (name.endsWith('/authService')) return { __esModule: true, default: { getUser: () => actor } };
      if (name === 'services/customerService') return { __esModule: true, default: options.services.customerService };
      if (name === 'services/customerDetailsService') return { getCustomerDetails: options.services.getCustomerDetails };
      if (name === '@/lib/salesRoles')
        return { fetchSalesPersonList: options.sales || (async () => [{ userId: 7, fullName: 'Test Seller' }]) };
      if (name === '@/lib/usPhone') return load('src/lib/usPhone.js');
      if (name === '@/lib/customerPayload') return payloads;
      if (name === '@/lib/apiError') return { getApiErrorMessage: (e, fallback) => e?.message || fallback };
      if (name === '@/lib/utils') return { cn: (...values) => values.filter(Boolean).join(' ') };
      if (name === '@/services/http') return { getAuthHeaders: () => ({}) };
      if (name === '@/utils/configuredPagePermissions')
        return { resolveConfiguredPagePermissions: (key) => (key === 'order' ? options.orderPermissions : null) || options.permissions || { canAdd: true, canUpdate: true, canDelete: true } };
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
    services: { countryService: defaultCountries, ...overrides.services, customerService: {
      verifyCustomerSave: async (customerId, submitted) => ({ verified: true, customer: { ...submitted, customerId } }),
      ...overrides.services?.customerService
    } }
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

test('typed contact and address values reach the actual Customer POST serializer with the selected owner', async (t) => {
  let posted;
  const api = service({ post: async (path, body) => {
    assert.equal(path, '/Customer');
    posted = plain(body);
    return { success: true, data: 14 };
  } });
  const view = modal({ services: { customerService: { createCustomer: (data) => api.createCustomer(data) } } });
  t.after(() => view.cleanup());
  let tree = await view.settle();
  const entered = { name: 'Example Customer', email: 'example@example.test', address: '123 Main Street', city: 'Columbus', zipCode: '43215' };
  for (const [name, value] of Object.entries(entered)) field(tree, name).props.onChange({ target: { name, value } });
  field(tree, 'phone').props.onChange('(202) 555-0199');
  field(tree, 'phone2').props.onChange('(202) 555-0188');
  tree = await view.settle();
  await form(tree).props.onSubmit({ preventDefault() {} });
  for (const [name, value] of Object.entries(entered)) assert.equal(posted[name], value);
  assert.equal(posted.phone, '2025550199');
  assert.equal(posted.phone2, '2025550188');
  assert.equal(posted.salesPerson, 7);
  assert.equal(posted.salesPersonName, 'Test Seller');
  assert.equal(posted.stateId, 5);
  assert.equal(posted.countryId, 1);
  assert.deepEqual(posted.getOrderListDTOs, []);
  assert.deepEqual(posted.getTicketListDTOs, []);
});

test('an incomplete read-back retains entered fields as a warning and requires edits before updating the same ID', async (t) => {
  let creates = 0, updates = 0, checks = 0;
  const view = modal({ services: { customerService: {
    createCustomer: async () => { creates++; return { customerId: 13 }; },
    updateCustomer: async (payload) => { updates++; assert.equal(payload.customerId, 13); return payload; },
    verifyCustomerSave: async (customerId, payload) => {
      assert.equal(customerId, 13);
      if (++checks === 1) return { verified: false, message: 'Customer #13 was saved. Some details could not be confirmed by the API.' };
      return { verified: true, customer: { ...payload, customerId } };
    }
  } } });
  t.after(() => view.cleanup());
  let tree = await view.settle();
  await form(tree).props.onSubmit({ preventDefault() {} });
  tree = await view.settle();
  assert.equal(find(tree, (node) => node.props?.role === 'alert'), undefined);
  assert.match(text(find(tree, (node) => node.props?.role === 'status')), /Customer #13 was saved/);
  assert.equal(field(tree, 'email').props.value, fixture.email);
  assert.equal(field(tree, 'city').props.value, fixture.city);
  assert.equal(text(submit(tree)), 'Save Changes');
  assert.equal(submit(tree).props.disabled, true);
  await form(tree).props.onSubmit({ preventDefault() {} });
  assert.equal(updates, 0);
  assert.ok(find(tree, (node) => node.type === 'button' && text(node) === 'Done'));
  field(tree, 'email').props.onChange({ target: { name: 'email', value: 'updated@example.test' } });
  tree = await view.settle();
  assert.equal(submit(tree).props.disabled, false);
  await form(tree).props.onSubmit({ preventDefault() {} });
  assert.equal(creates, 1);
  assert.equal(updates, 1);
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

test('customer detail modal shows fresh fields and order status and makes all related records reachable', async (t) => {
  const customer = { ...fixture, customerId: 13 };
  const view = component('src/pages/customer/CustomersPage.jsx', {
    services: {
      customerService: { getCustomers: async () => ({ data: [customer], totalCount: 1 }) },
      getCustomerDetails: async () => ({
        customer,
        orders: Array.from({ length: 12 }, (_, index) => ({ orderId: index + 1, orderStatus: 'Paid', totalAmount: 399.99 })),
        tickets: [{ ticketId: 8, subject: 'Help', ticketStatusName: 'Open' }],
        errors: {}
      })
    }
  });
  t.after(() => view.cleanup());
  let tree = await view.settle();
  const table = find(tree, (node) => node.props?.pagination?.itemName === 'Customers');
  await find(table.props.columns.find((column) => column.id === 'customer').cell(customer), (node) => node.type === 'button').props.onClick();
  tree = await view.settle();
  const orders = find(tree, (node) => node.props?.title === 'Orders (12)');
  assert.equal(text(orders.props.columns[2].cell(orders.props.data[0])), 'Paid');
  assert.equal(orders.props.data.length, 10);
  assert.equal(orders.props.pagination.totalCount, 12);
  orders.props.pagination.onPageChange(2);
  tree = await view.settle();
  assert.deepEqual(plain(find(tree, (node) => node.props?.title === 'Orders (12)').props.data.map((row) => row.orderId)), [11, 12]);
  const fields = find(tree, (node) => node.props?.fields);
  assert.equal(fields.props.fields.find((field) => field.label === 'Email').value, fixture.email);
});

test('failed ticket API requests show a modal error instead of a false No tickets table and can be retried', async (t) => {
  let calls = 0;
  const customer = { ...fixture, customerId: 13 };
  const view = component('src/pages/customer/CustomersPage.jsx', {
    services: {
      customerService: { getCustomers: async () => ({ data: [customer], totalCount: 1 }) },
      getCustomerDetails: async () => {
        calls++;
        return { customer, orders: [], tickets: [], errors: { tickets: 'Access denied' } };
      }
    }
  });
  t.after(() => view.cleanup());
  let tree = await view.settle();
  const table = find(tree, (node) => node.props?.pagination?.itemName === 'Customers');
  await find(table.props.columns.find((column) => column.id === 'customer').cell(customer), (node) => node.type === 'button').props.onClick();
  tree = await view.settle();
  assert.match(text(find(tree, (node) => node.props?.role === 'alert')), /Tickets: Access denied/);
  assert.equal(find(tree, (node) => node.props?.title === 'Tickets (0)'), undefined);
  await find(tree, (node) => node.type === 'button' && text(node) === 'Retry').props.onClick();
  assert.equal(calls, 2);
});

test('closing customer details aborts pending API requests and ignores late responses', async (t) => {
  let signal;
  let release;
  const customer = { ...fixture, customerId: 13 };
  const view = component('src/pages/customer/CustomersPage.jsx', {
    services: {
      customerService: { getCustomers: async () => ({ data: [customer], totalCount: 1 }) },
      getCustomerDetails: async (_customer, requestSignal) => {
        signal = requestSignal;
        return new Promise((resolve) => { release = resolve; });
      }
    }
  });
  t.after(() => view.cleanup());
  let tree = await view.settle();
  const table = find(tree, (node) => node.props?.pagination?.itemName === 'Customers');
  const pending = find(table.props.columns.find((column) => column.id === 'customer').cell(customer), (node) => node.type === 'button').props.onClick();
  tree = await view.settle();
  find(tree, (node) => node.props?.show === true && node.props?.size === 'xl').props.onHide();
  assert.equal(signal.aborted, true);
  release({ customer: { ...customer, name: 'Late response' }, orders: [], tickets: [], errors: {} });
  await pending;
  tree = await view.settle();
  assert.equal(find(tree, (node) => node.props?.title === 'Orders (0)'), undefined);
  assert.doesNotMatch(text(tree), /Late response/);
});

test('customer list matches the reference columns and Create Order navigates with the selected customer', async (t) => {
  const customer = { ...fixture, customerId: 13, createdByName: 'CRM Creator', address: '123 Main Street' };
  let destination;
  const view = component('src/pages/customer/CustomersPage.jsx', {
    navigate: (path) => { destination = path; },
    services: { customerService: { getCustomers: async () => ({ data: [customer], totalCount: 1 }) } }
  });
  t.after(() => view.cleanup());
  const tree = await view.settle();
  const table = find(tree, (node) => node.props?.pagination?.itemName === 'Customers');
  assert.deepEqual(plain(table.props.columns.map((column) => column.header)), ['ID', 'Name', 'Address', 'Sales Person', 'Created By', 'Create Date', 'Is Active Status', 'Action']);
  assert.equal(table.props.columns.find((column) => column.id === 'address').cell(customer), 'Columbus, Ohio, USA');
  assert.equal(table.props.columns.find((column) => column.id === 'salesPerson').cell(customer), 'Test Seller');
  const identity = table.props.columns.find((column) => column.id === 'customer').cell(customer);
  assert.match(text(identity), /Test Customer/);
  assert.match(text(identity), /customer@example.test/);
  const actions = table.props.columns.find((column) => column.id === 'actions').cell(customer);
  await find(actions, (node) => node.props?.label === 'Create Order').props.onClick();
  assert.equal(destination, '/Orders/CreateOrder?customerId=13');
});

test('customer Create Order action respects order permissions independently of customer permissions', async (t) => {
  const view = component('src/pages/customer/CustomersPage.jsx', {
    orderPermissions: { canAdd: false },
    services: { customerService: { getCustomers: async () => ({ data: [], totalCount: 0 }) } }
  });
  t.after(() => view.cleanup());
  const tree = await view.settle();
  const table = find(tree, (node) => node.props?.pagination?.itemName === 'Customers');
  const actions = table.props.columns.find((column) => column.id === 'actions').cell({ customerId: 13 });
  assert.equal(find(actions, (node) => node.props?.label === 'Create Order'), undefined);
  assert.ok(find(actions, (node) => node.props?.label === 'Edit customer'));
});

test('customer activation stays pending until confirmed and blocks repeated clicks', async (t) => {
  const customer = { customerId: 13, name: 'Example', isActive: 'false' };
  let resolve, calls = 0;
  const pending = new Promise((done) => { resolve = done; });
  const view = component('src/pages/customer/CustomersPage.jsx', { services: { customerService: {
    getCustomers: async () => ({ data: [customer], totalCount: 1 }),
    toggleCustomerStatus: async (id, checked) => { assert.equal(id, 13); assert.equal(checked, true); calls++; return pending; }
  } } });
  t.after(() => view.cleanup());
  let tree = await view.settle();
  const table = () => find(tree, (node) => node.props?.pagination?.itemName === 'Customers');
  const toggle = () => find(table().props.columns.find((column) => column.id === 'status').cell(table().props.data[0]), (node) => node.props?.onCheckedChange);
  assert.equal(toggle().props.checked, false);
  const handler = toggle().props.onCheckedChange;
  const first = handler(true);
  await handler(true);
  tree = await view.settle();
  assert.equal(calls, 1);
  assert.equal(toggle().props.checked, false);
  assert.equal(toggle().props.disabled, true);
  resolve({ ...customer, isActive: true, address: '123 Main Street' });
  await first;
  tree = await view.settle();
  assert.equal(toggle().props.checked, true);
  assert.equal(toggle().props.disabled, false);
  assert.equal(table().props.data[0].address, '123 Main Street');
});

test('customer status errors appear beside the switch and retain the actual inactive state', async (t) => {
  const customer = { customerId: 13, isActive: false };
  const view = component('src/pages/customer/CustomersPage.jsx', { services: { customerService: {
    getCustomers: async () => ({ data: [customer], totalCount: 1 }),
    toggleCustomerStatus: async () => { const error = Error('The API did not apply activation.'); error.actualStatus = false; throw error; }
  } } });
  t.after(() => view.cleanup());
  let tree = await view.settle();
  const status = () => {
    const table = find(tree, (node) => node.props?.pagination?.itemName === 'Customers');
    return table.props.columns.find((column) => column.id === 'status').cell(table.props.data[0]);
  };
  await find(status(), (node) => node.props?.onCheckedChange).props.onCheckedChange(true);
  tree = await view.settle();
  assert.equal(find(status(), (node) => node.props?.onCheckedChange).props.checked, false);
  assert.match(text(find(status(), (node) => node.props?.role === 'alert')), /did not apply activation/);
});

test('customer list starts with All fields and preserves selected date bounds when searching', async (t) => {
  const calls = [];
  const view = component('src/pages/customer/CustomersPage.jsx', {
    services: { customerService: { getCustomers: async (params) => { calls.push(params); return { data: [], totalCount: 0 }; } } }
  });
  t.after(() => view.cleanup());
  let tree = await view.settle();
  const toolbar = () => find(tree, (node) => node.props?.searchFields);
  assert.equal(toolbar().props.searchField, '');
  toolbar().props.onDateChange('2026-10-01', '2026-10-31');
  toolbar().props.onSearchChange('Customer');
  tree = await view.settle();
  toolbar().props.onSearchSubmit();
  tree = await view.settle();
  assert.equal(calls.at(-1).Text, 'Customer');
  assert.equal(calls.at(-1).SearchField, '');
  assert.equal(calls.at(-1).FromDate, '2026-10-01T00:00:00');
  assert.equal(calls.at(-1).ToDate, '2026-10-31T23:59:59');
});
