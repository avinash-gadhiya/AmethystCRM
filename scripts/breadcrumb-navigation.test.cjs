const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const React = require('react');
const { transformSync } = require('esbuild');

const load = (file, requireDependency, globals = {}) => {
  const source = fs.readFileSync(file, 'utf8').replaceAll('import.meta.env', '({ VITE_APP_BASE_NAME: "/crm" })');
  const code = transformSync(source, { format: 'cjs', loader: 'jsx' }).code;
  const context = { module: { exports: {} }, require: requireDependency, ...globals };
  vm.runInNewContext(code, context, { filename: file });
  return context.module.exports;
};
const helpers = load('src/lib/breadcrumbNavigation.js');
const resolve = helpers.getBreadcrumbNavigation;
const plain = (value) => JSON.parse(JSON.stringify(value));
const navigation = { items: [{ title: 'Navigation', type: 'group', children: [
  { title: 'Dashboards', type: 'item', url: '/Dashboards' },
  { title: 'Orders', type: 'collapse', url: '/Orders', children: [
    { title: 'Payments', type: 'item', url: '/Orders/Payments' },
    { title: 'Create Order', type: 'item', url: '/Orders/CreateOrder' }
  ] }
] }] };

test('Home opens the main dashboard and does not point to Performance', () => {
  assert.equal(resolve(navigation, '/Orders').homePath, '/Dashboards');
  assert.equal(resolve({ items: [] }, '/Orders').homePath, '/Dashboards');
  assert.equal(resolve([{ title: 'Dashboard', url: '/Workspace/Overview' }], '/Orders').homePath, '/Workspace/Overview');
});

test('breadcrumbs match the most specific route independently of menu order', () => {
  const result = resolve(navigation, '/orders/payments/37/');
  assert.equal(result.title, 'Payments');
  assert.deepEqual(plain(result.parents).map((item) => item.title), ['Orders']);
  assert.equal(resolve(navigation, '/Orders/CreateOrder').title, 'Create Order');
  assert.equal(resolve(navigation, '/OrdersArchive').title, 'Orders Archive');
});

test('base-path deployments do not duplicate the router base or lose page matching', () => {
  const prefixed = { items: [{ title: 'Dashboards', url: '/crm/Dashboards' }, { title: 'Payments', url: '/Orders/Payments' }] };
  const result = resolve(prefixed, '/crm/Orders/Payments/', '/crm');
  assert.equal(result.title, 'Payments');
  assert.equal(result.homePath, '/Dashboards');
  assert.equal(resolve(prefixed, '/crmextra/Orders', '/crm').title, 'Orders');
});

test('navigation groups and duplicate dashboard parents do not pollute the visible trail', () => {
  const result = resolve(navigation, '/Dashboards');
  assert.deepEqual(plain(result.parents), []);
  const leads = resolve({ items: [] }, '/Leads/MyLeads');
  assert.equal(leads.title, 'My Leads');
  assert.deepEqual(plain(leads.parents), [{ title: 'Leads' }], 'do not invent an ungranted parent link');
});

test('the header Home link uses the resolved dashboard and updates with permission navigation', () => {
  const state = [], effects = [];
  let cursor = 0, notify, unsubscribed = false;
  const document = { title: '' };
  const Link = () => null;
  const Stub = () => null;
  const hookReact = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
      return [state[index], (next) => { state[index] = typeof next === 'function' ? next(state[index]) : next; }];
    },
    useMemo: (compute) => compute(),
    useEffect: (effect) => effects.push(effect)
  };
  const permissionService = {
    getNavigation: () => navigation,
    subscribe: (callback) => { notify = callback; return () => { unsubscribed = true; }; }
  };
  const { default: Breadcrumb } = load('src/layouts/AdminLayout/Breadcrumb.jsx', (name) => {
    if (name === 'react') return hookReact;
    if (name === 'react-router-dom') return { Link, useLocation: () => ({ pathname: '/crm/Orders/Payments' }) };
    if (name === 'lucide-react') return { Home: Stub, ChevronRight: Stub };
    if (name === 'services/permissionService') return { __esModule: true, default: permissionService };
    if (name === 'config/constant') return { BASE_TITLE: '| CRM' };
    if (name === '@/lib/breadcrumbNavigation') return helpers;
    throw new Error('Unexpected dependency: ' + name);
  }, { document, React: hookReact });
  const nodes = (element) => !element || typeof element !== 'object' ? []
    : [element, ...React.Children.toArray(element.props?.children).flatMap(nodes)];
  const render = () => { cursor = 0; return Breadcrumb(); };
  let tree = render();
  assert.equal(nodes(tree).find((node) => node.props?.title === 'Open dashboard').props.to, '/Dashboards');
  assert.equal(nodes(tree).find((node) => node.props?.['aria-current'] === 'page').props.children[1].props.children, 'Payments');
  const cleanups = effects.splice(0).map((effect) => effect());
  assert.equal(document.title, 'Payments | CRM');
  notify({ items: [{ title: 'Dashboard', url: '/Workspace/Overview' }, { title: 'Payment History', url: '/Orders/Payments' }] });
  tree = render();
  assert.equal(nodes(tree).find((node) => node.props?.title === 'Open dashboard').props.to, '/Workspace/Overview');
  assert.equal(nodes(tree).find((node) => node.type === 'h1').props.children, 'Payment History');
  cleanups.filter((cleanup) => typeof cleanup === 'function').forEach((cleanup) => cleanup());
  assert.equal(unsubscribed, true);
});
