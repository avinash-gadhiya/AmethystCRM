const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('esbuild');

class Storage {
  constructor(values = {}) {
    this.values = new Map(Object.entries(values));
  }
  get length() {
    return this.values.size;
  }
  key(index) {
    return [...this.values.keys()][index] ?? null;
  }
  getItem(key) {
    return this.values.get(key) ?? null;
  }
  setItem(key, value) {
    this.values.set(key, String(value));
  }
  removeItem(key) {
    this.values.delete(key);
  }
}
const plain = (value) => JSON.parse(JSON.stringify(value));
function load(file, dependencies = {}, globals = {}) {
  const source = fs.readFileSync(file, 'utf8').replaceAll('import.meta.env', '({ VITE_APP_API_URL: "https://test.invalid/api" })');
  const code = transformSync(source, { format: 'cjs', loader: 'jsx' }).code;
  const context = {
    module: { exports: {} },
    console: { ...console, error() {} },
    Event,
    require: (name) => dependencies[name],
    ...globals
  };
  vm.runInNewContext(code, context, { filename: file });
  return context.module.exports;
}
const storageModule = (storage) => load('src/lib/browserStorage.js', {}, { localStorage: storage });

test('migration preserves the current login and removes every obsolete menu cache and token copy', () => {
  const storage = new Storage({
    token: 'test-session',
    userToken: 'test-session',
    api_token: 'test-session',
    accessToken: 'test-session',
    authToken: 'test-session',
    user: JSON.stringify({
      userId: 10,
      roleId: 12,
      userToken: 'test-session',
      tokenExpirationTime: '2099-01-01',
      permissionCodes: ['View_Order']
    }),
    authData: JSON.stringify({ data: { userToken: 'test-session' } }),
    permissionCodes: '["View_Order"]',
    permissions: '["View_Order"]',
    'crm_permission_menus:v2:12:10': '[]',
    'crm_permission_menus:v1:3:20': '[]',
    crm_permission_menus: '[]',
    crm_auth_activity_notifications: '[{"id":"keep"}]',
    unrelated: 'keep'
  });
  storageModule(storage).migrateAuthStorage();
  assert.equal(storage.getItem('token'), 'test-session');
  assert.deepEqual([...storage.values.keys()].sort(), ['crm_auth_activity_notifications', 'token', 'unrelated', 'user']);
  const user = JSON.parse(storage.getItem('user'));
  assert.equal(user.userId, 10);
  assert.equal(user.userToken, undefined);
  assert.equal(user.tokenExpirationTime, '2099-01-01');
  assert.deepEqual(user.permissionCodes, ['View_Order']);
});

test('legacy alias-only logins migrate without losing permissions or profile fields', () => {
  const storage = new Storage({
    accessToken: 'legacy-session',
    user: '{"userId":2,"displayName":"Test","phone":"123"}',
    permissionCodes: '["View_Order"]'
  });
  storageModule(storage).migrateAuthStorage();
  assert.equal(storage.getItem('token'), 'legacy-session');
  assert.equal(storage.getItem('accessToken'), null);
  assert.equal(JSON.parse(storage.getItem('user')).phone, '123');
  assert.deepEqual(JSON.parse(storage.getItem('user')).permissionCodes, ['View_Order']);
});

test('migration does not replace an explicitly empty permission list with stale grants', () => {
  const storage = new Storage({ token: 'test-session', user: '{"userId":2,"permissionCodes":[]}', permissions: '["Delete_Order"]' });
  storageModule(storage).migrateAuthStorage();
  assert.deepEqual(JSON.parse(storage.getItem('user')).permissionCodes, []);
  assert.equal(storage.getItem('permissions'), null);
});

test('a failed storage write leaves the previous token available for recovery', () => {
  const storage = new Storage({ userToken: 'legacy-session' });
  storage.setItem = () => {
    throw new Error('Storage blocked');
  };
  assert.doesNotThrow(() => storageModule(storage).migrateAuthStorage());
  assert.equal(storage.getItem('userToken'), 'legacy-session');
});

test('credentials are stripped from nested profiles while expiry metadata is retained', () => {
  const result = storageModule(new Storage()).stripStoredCredentials({
    UserToken: 'legacy',
    tokenExpirationTime: '2099',
    nested: { password: 'test-only', name: 'Test' }
  });
  assert.deepEqual(plain(result), { tokenExpirationTime: '2099', nested: { name: 'Test' } });
});

function element() {
  const classes = new Set(['dark']);
  const attributes = new Map([['data-theme-mode', 'dark']]);
  const styles = new Map();
  return {
    classes,
    attributes,
    styles,
    classList: { remove: (value) => classes.delete(value) },
    setAttribute: (key, value) => attributes.set(key, value),
    style: { setProperty: (key, value) => styles.set(key, value) }
  };
}
test('startup enforces light mode and cleans legacy session menus on a new device', () => {
  const local = new Storage();
  const session = new Storage({ 'crm_permission_menus:v2:12:10': '[]', unrelated: 'keep' });
  const doc = { documentElement: element(), body: element() };
  const browserStorage = storageModule(local);
  load('src/bootstrap.js', { './lib/browserStorage': browserStorage }, { document: doc, localStorage: local, sessionStorage: session });
  for (const item of [doc.documentElement, doc.body]) {
    assert.equal(item.classes.has('dark'), false);
    assert.equal(item.attributes.get('data-theme-mode'), 'light');
    assert.equal(item.attributes.get('data-bs-theme'), 'light');
    assert.equal(item.styles.get('color-scheme'), 'only light');
  }
  assert.equal(local.length, 0, 'light mode does not create a redundant preference entry');
  assert.equal(session.getItem('crm_permission_menus:v2:12:10'), null);
  assert.equal(session.getItem('unrelated'), 'keep');
});

test('login writes one token, Axios uses it, and logout removes it', async () => {
  const local = new Storage({ 'crm_permission_menus:v2:2:10': '[]' });
  const axios = { defaults: { headers: { common: {} } } };
  const browserStorage = storageModule(local);
  const auth = load(
    'src/services/authService.js',
    {
      axios: { __esModule: true, default: axios },
      './activityNotificationService': { __esModule: true, default: { record() {} } },
      './clientIpService': { getCurrentLoginIpv4: async () => '203.0.113.42' },
      '@/lib/browserStorage': browserStorage
    },
    {
      localStorage: local,
      window: new EventTarget(),
      fetch: async (_url, options) => {
        assert.equal(JSON.parse(options.body).loginIp, '203.0.113.42');
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: { userToken: 'login-test-session', userId: 10, roleId: 2, roleName: 'Agent', permissionCodes: ['View_Order'] }
          })
        };
      }
    }
  ).default;
  assert.equal((await auth.login('test-user', 'test-password')).success, true);
  assert.equal(auth.getToken(), 'login-test-session');
  assert.equal(axios.defaults.headers.common.Authorization, 'Bearer login-test-session');
  assert.equal(auth.getUser().userToken, undefined);
  assert.deepEqual(plain(auth.getUser().permissionCodes), ['View_Order']);
  for (const key of [
    'userToken',
    'api_token',
    'accessToken',
    'authToken',
    'authData',
    'permissions',
    'permissionCodes',
    'crm_permission_menus:v2:2:10'
  ])
    assert.equal(local.getItem(key), null);
  auth.logout();
  assert.equal(auth.getToken(), null);
  assert.equal(axios.defaults.headers.common.Authorization, undefined);
  axios.defaults.headers.common.Authorization = 'stale-test-session';
  auth.setupAxios();
  assert.equal(axios.defaults.headers.common.Authorization, undefined);
});

const menus = (url = '/Orders') => [
  {
    menuId: 1,
    menuName: 'Orders',
    isActive: true,
    menuPermissionPageDTOs: [
      {
        pageId: 2,
        pageName: 'Orders',
        pageUrl: url,
        isActive: true,
        menuPagePermissionDTOs: [
          { permissionName: 'View', permissionCode: 'View_Order', hasPermission: true, isActive: true },
          { permissionName: 'Delete', permissionCode: 'Delete_Order', hasPermission: false, isActive: true }
        ]
      }
    ]
  }
];
function permissions(handler = async () => menus()) {
  const local = new Storage();
  const state = { user: { roleId: 2, userId: 10, roleName: 'Agent', permissionCodes: ['View_Order'] }, token: 'test-session' };
  const window = new EventTarget();
  const service = load(
    'src/services/permissionService.js',
    {
      './authService': {
        __esModule: true,
        AUTH_SESSION_CHANGED_EVENT: 'auth-session-changed',
        default: { getUser: () => state.user, getToken: () => state.token }
      },
      './http': { handleSessionExpired() {} },
      '@/lib/browserStorage': storageModule(local)
    },
    {
      localStorage: local,
      window,
      fetch: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ roleId: state.user?.roleId || 2, permissionMenuDTOs: await handler() }] })
      })
    }
  ).default;
  return { service, local, state, window };
}

test('menus, navigation, and page actions work in memory without writing permission storage', async () => {
  const { service, local } = permissions();
  const navigation = await service.fetchPermissions();
  assert.equal(service.hasPath('/Orders', navigation), true);
  assert.equal(service.getPermissionMenus().length, 1);
  assert.equal(service.getPageActionPermissions('/Orders').canView, true);
  assert.equal(service.getPageActionPermissions('/Orders').canDelete, false);
  assert.equal((await service.getGrantedPermissionCodesForPath('/Orders')).has('view_order'), true);
  assert.equal(local.length, 0);
});

test('another user or replacement token cannot reuse the previous session menu', async () => {
  const { service, state } = permissions();
  await service.fetchPermissions();
  state.user = { ...state.user, userId: 11 };
  assert.equal(service.getPermissionMenus().length, 0);
  assert.equal(service.getPageActionPermissions('/Orders').canView, false);
  await service.fetchPermissions();
  state.token = 'replacement-test-session';
  assert.equal(service.getPermissionMenus().length, 0);
});

test('an old response cannot restore menus after logout', async () => {
  let release;
  const { service, state, window } = permissions(
    () =>
      new Promise((resolve) => {
        release = resolve;
      })
  );
  const pending = service.fetchPermissions();
  await new Promise(setImmediate);
  state.token = null;
  state.user = null;
  window.dispatchEvent(new Event('auth-session-changed'));
  release(menus());
  await pending;
  assert.equal(service.getPermissionMenus().length, 0);
  assert.equal(service.getPageActionPermissions('/Orders').canView, false);
});

test('cache invalidation prevents an older response from replacing fresh permissions', async () => {
  let release;
  let count = 0;
  const { service } = permissions(() =>
    ++count === 1
      ? new Promise((resolve) => {
          release = resolve;
        })
      : Promise.resolve(menus('/Fresh'))
  );
  const old = service.fetchPermissions();
  await new Promise(setImmediate);
  service.clearCache();
  await service.fetchPermissions();
  release(menus('/Old'));
  await old;
  assert.equal(service.getPermissionMenus()[0].menuPermissionPageDTOs[0].pageUrl, '/Fresh');
});
