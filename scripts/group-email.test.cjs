const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('esbuild');

const plain = (value) => JSON.parse(JSON.stringify(value));

test('Add Group Email opens the shared modal and saving refreshes the active table', async () => {
  const React = require('react');
  const state = [];
  let cursor = 0;
  const hookReact = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (next) => { state[index] = typeof next === 'function' ? next(state[index]) : next; }];
    },
    useEffect() {},
    useMemo: (fn) => fn(),
    useCallback: (fn) => fn,
    useRef: (current) => ({ current })
  };
  const Stub = () => null;
  const Modal = () => null;
  const requests = [];
  const service = { getGroupEmails: async (...args) => { requests.push(args); return { data: [], totalCount: 0 }; } };
  const permissions = { canView: true, canAdd: true, canUpdate: true, canDelete: true };
  const source = transformSync(fs.readFileSync('src/pages/settings/group/GroupPage.jsx', 'utf8'), { format: 'cjs', loader: 'jsx' }).code;
  const context = {
    module: { exports: {} }, console, URLSearchParams,
    require(name) {
      if (name === 'react') return hookReact;
      if (name === 'react-router-dom') return { useSearchParams: () => [new URLSearchParams('tab=groupEmail'), () => {}] };
      if (name === 'lucide-react') return new Proxy({}, { get: () => Stub });
      if (name === 'sonner') return { toast: { success() {}, error() {} }, Toaster: Stub };
      if (name.endsWith('/groupService')) return { __esModule: true, default: service };
      if (name.endsWith('/groupPermissions')) return { resolveGroupPermissions: () => permissions };
      if (name.endsWith('/apiError')) return { getApiErrorMessage: (error) => error.message };
      return { __esModule: true, default: name.endsWith('/GroupEmailModal') ? Modal : Stub };
    }
  };
  vm.runInNewContext(source, context);
  const render = () => { cursor = 0; return context.module.exports.default(); };
  const nodes = (element) => {
    if (!element || typeof element !== 'object') return [];
    return [element, ...React.Children.toArray(element.props?.children).flatMap(nodes)];
  };
  let tree = render();
  const addButton = nodes(tree).find((element) => element.type === Stub && nodes(element).some((child) => child.type === 'span' && child.props.children === 'Add Group Email'));
  assert.ok(addButton, 'Add Group Email action is available');
  addButton.props.onClick();
  tree = render();
  const modal = nodes(tree).find((element) => element.type === Modal);
  assert.equal(modal.props.open, true);
  assert.equal(modal.props.canAdd, true);
  assert.equal(modal.props.canUpdate, true);
  modal.props.onSuccess();
  await Promise.resolve();
  assert.equal(requests.length, 1);
  assert.equal(requests[0][2], true, 'saving reloads fresh records');
  assert.equal(nodes(render()).find((element) => element.type === Modal).props.open, false);
});

function setup(handler = () => ({ success: true, data: [] })) {
  const calls = [];
  const apiClient = Object.fromEntries(
    ['get', 'post', 'put', 'delete'].map((method) => [
      method,
      async (path, data) => {
        calls.push({ method, path, data });
        return handler(method, path, data);
      }
    ])
  );
  function load(file, dependencies) {
    const source = transformSync(fs.readFileSync(file, 'utf8'), { format: 'cjs', loader: 'jsx' }).code;
    const context = { module: { exports: {} }, console, require: (name) => dependencies[name] };
    vm.runInNewContext(source, context, { filename: file });
    return context.module.exports.default;
  }
  const email = load('src/services/groupEmailService.js', { './core/apiClient': { default: apiClient, __esModule: true } });
  const group = load('src/services/groupService.js', {
    './core/apiClient': { default: apiClient, __esModule: true },
    './groupEmailService': { default: email, __esModule: true }
  });
  return { email, group, calls };
}

test('create trims form data, sends the documented DTO, and refreshes the Groups tab cache', async () => {
  let created = false;
  const { email, group, calls } = setup((method) => {
    if (method === 'post') {
      created = true;
      return { success: true };
    }
    return { data: created ? [{ groupEmailId: 8, email: 'support@example.test' }] : [], totalCount: created ? 1 : 0 };
  });
  assert.equal((await group.getGroupEmails()).totalCount, 0);
  await email.createGroupEmail({
    groupEmailId: 99,
    email: ' support@example.test ',
    nameOnEmail: ' Support ',
    location: ' DEL ',
    groupId: '2',
    groupName: ' Service ',
    isActive: false
  });
  assert.deepEqual(plain(calls[1]), {
    method: 'post',
    path: '/GroupEmail',
    data: {
      groupEmailId: 0,
      email: 'support@example.test',
      nameOnEmail: 'Support',
      location: 'DEL',
      groupId: 2,
      groupName: 'Service',
      isActive: false
    }
  });
  assert.equal((await group.getGroupEmails()).data[0].groupEmailId, 8);
});

test('delete from either screen uses the documented query ID and invalidates the shared list', async () => {
  let deleted = false;
  const { email, group, calls } = setup((method) => {
    if (method === 'delete') {
      deleted = true;
      return { success: true, data: null, status: 204 };
    }
    return { data: deleted ? [] : [{ groupEmailId: 8 }], totalCount: deleted ? 0 : 1 };
  });
  await email.getGroupEmails();
  await group.deleteGroupEmail('8');
  assert.deepEqual(plain(calls[1]), { method: 'delete', path: '/GroupEmail', data: { id: 8 } });
  assert.equal((await email.getGroupEmails()).totalCount, 0);
});

test('invalid delete IDs never reach the API', async () => {
  const { email, calls } = setup();
  for (const id of [undefined, 'bad', 0, -2]) await assert.rejects(email.deleteGroupEmail(id), /valid group email ID/);
  assert.equal(calls.length, 0);
});

test('normalizes PascalCase IDs and false strings without losing pagination totals', async () => {
  const { group } = setup(() => ({ Data: { Items: [{ GroupEmailId: 8, GroupId: 2, IsActive: 'false' }], TotalCount: 31 } }));
  const result = await group.getGroupEmails();
  assert.equal(result.data[0].groupEmailId, 8);
  assert.equal(result.data[0].groupId, 2);
  assert.equal(result.data[0].isActive, false);
  assert.equal(result.totalCount, 31);
});

test('an old in-flight list cannot refill the cache after a mutation', async () => {
  let resolveOld;
  let reads = 0;
  const { email, group } = setup((method) => {
    if (method !== 'get') return { success: true };
    if (++reads === 1)
      return new Promise((resolve) => {
        resolveOld = resolve;
      });
    return { data: [{ groupEmailId: 9 }], totalCount: 1 };
  });
  const old = group.getGroupEmails();
  await email.createGroupEmail({ email: 'new@example.test', groupId: 2 });
  await group.getGroupEmails();
  resolveOld({ data: [{ groupEmailId: 1 }], totalCount: 1 });
  await old;
  assert.equal((await email.getGroupEmails()).data[0].groupEmailId, 9);
});

test('dropdown uses its own endpoint and group changes refresh its cached options', async () => {
  const { email, group, calls } = setup(() => ({ Data: [{ GroupId: 2, GroupName: 'Support', IsActive: 'false' }] }));
  assert.deepEqual(plain(await group.getGroupDropdownOptions()), [{ id: 2, name: 'Support', isActive: false }]);
  await email.getGroupDropdownOptions();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/Group/GroupDropdown');
  await group.createGroup({ groupName: 'Sales' });
  await email.getGroupDropdownOptions();
  assert.equal(calls.length, 3);
});

test('dropdown authorization errors propagate and are not cached as empty results', async () => {
  const { email, calls } = setup(() => {
    throw Object.assign(new Error('Not authorized'), { status: 403 });
  });
  await assert.rejects(email.getGroupDropdownOptions(), /Not authorized/);
  await assert.rejects(email.getGroupDropdownOptions(), /Not authorized/);
  assert.equal(calls.length, 2);
});

test('older servers fall back to the list only when the dropdown route is unavailable', async () => {
  const { email, calls } = setup((_method, path) => {
    if (path.endsWith('GroupDropdown')) throw Object.assign(new Error('Not found'), { status: 404 });
    return { data: [{ groupId: 3, groupName: 'Sales' }] };
  });
  assert.equal((await email.getGroupDropdownOptions())[0].id, 3);
  assert.deepEqual(
    calls.map((call) => call.path),
    ['/Group/GroupDropdown', '/Group']
  );
});

test('failed deletes preserve cached records and surface the API error', async () => {
  const { email, calls } = setup((method) => {
    if (method === 'delete') throw Object.assign(new Error('Permission denied'), { status: 403 });
    return { data: [{ groupEmailId: 8 }], totalCount: 1 };
  });
  await email.getGroupEmails();
  await assert.rejects(email.deleteGroupEmail(8), /Permission denied/);
  assert.equal((await email.getGroupEmails()).totalCount, 1);
  assert.equal(calls.length, 2);
});

test('system dark preference cannot activate dark utilities in the light CRM', async () => {
  const postcss = require('postcss');
  const tailwind = require('tailwindcss');
  const config = require('../tailwind.config.js');
  const result = await postcss([
    tailwind({ ...config, content: [{ raw: '<div class="bg-white dark:bg-black text-gray-900 dark:text-white" />' }] })
  ]).process('@tailwind utilities;', { from: undefined });
  assert.doesNotMatch(result.css, /prefers-color-scheme/);
  assert.match(result.css, /:is\(\.dark/);
});
