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
    AbortController,
    setTimeout,
    clearTimeout,
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
function permissions(handler = async () => menus(), fetchOverride, globals = {}) {
  const local = new Storage();
  const state = { user: { roleId: 2, userId: 10, roleName: 'Agent', permissionCodes: ['View_Order'] }, token: 'test-session' };
  const window = new EventTarget();
  let expired = 0;
  const service = load(
    'src/services/permissionService.js',
    {
      './authService': {
        __esModule: true,
        AUTH_SESSION_CHANGED_EVENT: 'auth-session-changed',
        default: { getUser: () => state.user, getToken: () => state.token }
      },
      './http': {
        handleSessionExpired() {
          expired++;
        }
      },
      '@/lib/browserStorage': storageModule(local)
    },
    {
      localStorage: local,
      window,
      fetch:
        fetchOverride ||
        (async () => ({
          ok: true,
          status: 200,
          json: async () => ({ data: [{ roleId: state.user?.roleId || 2, permissionMenuDTOs: await handler() }] })
        })),
      ...globals
    }
  ).default;
  return { service, local, state, window, getExpiredCount: () => expired };
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

test('permission consumers reuse one session request, including empty permission results', async () => {
  for (const tree of [menus(), []]) {
    let calls = 0;
    const { service } = permissions(async () => {
      calls++;
      return tree;
    });
    await Promise.all([service.fetchPermissions(), service.getCrudPermissionsForPath('/Orders'), service.fetchPermissions()]);
    await service.fetchPermissions();
    await service.getGrantedPermissionCodesForPath('/Orders');
    assert.equal(calls, 1);
    assert.equal(service.hasLoadedPermissions(), true);
  }
});

test('denied View hides menus while partially granted menus and their permitted pages remain visible', () => {
  const { service, state } = permissions();
  const partial = menus();
  partial[0].hasPermission = false; // Aggregate checkbox: not every child is granted.
  partial[0].menuPermissionPageDTOs[0].hasPermission = false;
  assert.equal(service.hasPath('/Orders', service.transformMenuDTOsToNavItems(partial)), true);
  partial[0].menuPermissionPageDTOs[0].menuPagePermissionDTOs[0].hasPermission = false;
  state.user.permissionCodes = ['View_Order', 'Delete_Order'];
  assert.equal(service.hasPath('/Orders', service.transformMenuDTOsToNavItems(partial)), false, 'explicit denial overrides login codes');
  partial[0].menuPermissionPageDTOs[0].menuPagePermissionDTOs = [];
  assert.equal(
    service.getFirstAvailablePath(service.transformMenuDTOsToNavItems(partial)),
    '',
    'unassigned pages do not grant themselves access'
  );
});

test('personal permissions use UserPermission and cannot inherit another user or role grants', async () => {
  const calls = [];
  const { service, state } = permissions(undefined, async (url) => {
    calls.push(url);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { userId: 999, roleId: 2, permissionMenuDTOs: menus('/OtherUser') },
          { userId: 10, roleId: 2, permissionMenuDTOs: menus('/Personal') }
        ]
      })
    };
  });
  state.user.isAssignPersonalPermission = true;
  await service.fetchPermissions();
  assert.match(calls[0], /\/UserPermission\?userId=10$/);
  assert.equal(service.hasPath('/Personal'), true);
  assert.equal(service.hasPath('/OtherUser'), false);
  assert.equal(service.hasPath('/Orders'), false);
});

test('clearing a session immediately clears subscriber menus and direct tab URLs require grants', async () => {
  const { service, window, state } = permissions();
  await service.fetchPermissions();
  let latest;
  service.subscribe((navigation) => {
    latest = navigation;
  });
  state.user = { ...state.user, userId: 11 };
  window.dispatchEvent(new Event('auth-session-changed'));
  assert.equal(service.getFirstAvailablePath(latest), '');
  assert.equal(service.hasLoadedPermissions(), false);
  assert.equal(service.hasPath('/settings/group-email'), false);
  assert.equal(service.hasPath('/settings/brand-template'), false);
  assert.equal(service.hasPath('/MyProfile'), true);
});

test('an old account 401 cannot expire the replacement account', async () => {
  let release;
  let calls = 0;
  const { service, state, window, getExpiredCount } = permissions(undefined, async () => {
    if (++calls === 1)
      return new Promise((resolve) => {
        release = resolve;
      });
    return { ok: true, status: 200, json: async () => ({ data: [{ roleId: 2, permissionMenuDTOs: menus('/Current') }] }) };
  });
  const old = service.fetchPermissions();
  await new Promise(setImmediate);
  state.user = { ...state.user, userId: 11 };
  state.token = 'replacement-session';
  window.dispatchEvent(new Event('auth-session-changed'));
  await service.fetchPermissions();
  release({ ok: false, status: 401 });
  await old;
  assert.equal(getExpiredCount(), 0);
  assert.equal(service.hasPath('/Current'), true);
});

test('permission failures remove previous grants, stop repeated reads, and recover with explicit retry', async () => {
  let fail = false,
    calls = 0;
  const { service } = permissions(async () => {
    calls++;
    if (fail) throw Error('Permission API unavailable');
    return menus();
  });
  await service.fetchPermissions();
  fail = true;
  await service.fetchPermissions(undefined, { force: true });
  assert.equal(service.hasPath('/Orders'), false);
  assert.match(service.getPermissionError(), /Unable to load/);
  await service.fetchPermissions();
  assert.equal(calls, 2, 'failed permissions do not create an API request loop');
  fail = false;
  await service.fetchPermissions(undefined, { force: true });
  assert.equal(service.getPermissionError(), '');
  assert.equal(service.hasPath('/Orders'), true);
});

test('a stalled permission request is aborted and resolves to a retryable error', async () => {
  let timeout;
  const { service } = permissions(
    undefined,
    (_url, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(Object.assign(Error('Aborted'), { name: 'AbortError' })));
      }),
    {
      setTimeout: (callback, duration) => {
        assert.equal(duration, 15000);
        timeout = callback;
        return 1;
      },
      clearTimeout() {}
    }
  );
  const pending = service.fetchPermissions();
  await new Promise(setImmediate);
  timeout();
  await pending;
  assert.equal(service.hasLoadedPermissions(), true);
  assert.match(service.getPermissionError(), /timed out/);
  assert.equal(service.getFirstAvailablePath(), '');
});

function routeHarness(session) {
  const React = require('react');
  let cursor = 0,
    dirty = true,
    tree;
  const slots = [],
    pending = [];
  const location = { pathname: '/Orders' };
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
    useEffect(callback, deps) {
      const i = cursor++;
      if (!slots[i] || !same(slots[i].deps, deps)) {
        const cleanup = slots[i]?.cleanup;
        slots[i] = { deps };
        pending.push(() => {
          cleanup?.();
          slots[i].cleanup = callback();
        });
      }
    },
    useSyncExternalStore(subscribe, getSnapshot) {
      hooks.useEffect(
        () =>
          subscribe(() => {
            dirty = true;
          }),
        [subscribe]
      );
      return getSnapshot();
    }
  };
  const auth = {
    getUser: () => session.state.user,
    getToken: () => session.state.token,
    isAuthenticated: () => Boolean(session.state.token),
    logout() {
      session.state.token = null;
      session.window.dispatchEvent(new Event('auth-session-changed'));
    }
  };
  const useAuthSession = load(
    'src/hooks/useAuthSession.js',
    {
      react: hooks,
      '@/services/authService': { __esModule: true, default: auth, AUTH_SESSION_CHANGED_EVENT: 'auth-session-changed' }
    },
    { window: session.window }
  ).default;
  const Navigate = () => null,
    Outlet = () => null,
    Loader = () => null;
  const routes = load(
    'src/auth/ProtectedRoute.jsx',
    {
      react: hooks,
      'react-router-dom': { Navigate, Outlet, Link: () => null, useLocation: () => location },
      'services/authService': { __esModule: true, default: auth },
      'services/permissionService': { __esModule: true, default: session.service },
      'components/loaders/Loader': { __esModule: true, default: Loader },
      '@/hooks/useAuthSession': { __esModule: true, default: useAuthSession }
    },
    { window: session.window, React: hooks }
  );
  const render = () => {
    cursor = 0;
    dirty = false;
    tree = routes.ProtectedRoute();
    return tree;
  };
  return {
    Navigate,
    Outlet,
    Loader,
    location,
    render,
    cleanup: () => slots.forEach((slot) => slot?.cleanup?.()),
    async settle() {
      for (let i = 0; i < 20; i++) {
        if (dirty) render();
        pending.splice(0).forEach((callback) => callback());
        await new Promise(setImmediate);
        if (!dirty && !pending.length) return tree;
      }
      throw Error('Route did not settle');
    }
  };
}

test('route navigation uses cached grants without a page-wide reload, and denied URLs redirect', async (t) => {
  let calls = 0;
  const session = permissions(async () => {
    calls++;
    return menus();
  });
  const view = routeHarness(session);
  t.after(view.cleanup);
  assert.equal(view.render().type, view.Loader);
  assert.equal((await view.settle()).type, view.Outlet);
  view.location.pathname = '/Settings/Users';
  const redirected = view.render();
  assert.equal(redirected.type, view.Navigate);
  assert.equal(redirected.props.to, '/Orders');
  view.location.pathname = '/Orders';
  assert.equal(view.render().type, view.Outlet);
  await view.settle();
  assert.equal(calls, 1);
});

test('same-tab user switch immediately hides the old page and an account with no grants reaches Profile', async (t) => {
  let calls = 0;
  const session = permissions(async () => (++calls === 1 ? menus() : []));
  const view = routeHarness(session);
  t.after(view.cleanup);
  const first = await view.settle();
  assert.equal(first.type, view.Outlet);
  session.state.user = { ...session.state.user, userId: 11, permissionCodes: [] };
  session.state.token = 'restricted-session';
  session.window.dispatchEvent(new Event('auth-session-changed'));
  assert.equal(view.render().type, view.Loader);
  const redirected = await view.settle();
  assert.equal(redirected.type, view.Navigate);
  assert.equal(redirected.props.to, '/MyProfile');
  view.location.pathname = '/MyProfile';
  const profile = view.render();
  assert.equal(profile.type, view.Outlet);
  assert.notEqual(profile.key, first.key, 'account switching remounts page state and memoized permission checks');
  await view.settle();
  assert.equal(calls, 2);
});

test('cross-tab user changes reload only the new permissions and logout removes the protected layout', async (t) => {
  let calls = 0;
  const session = permissions(async () => (++calls === 1 ? menus() : []));
  const view = routeHarness(session);
  t.after(view.cleanup);
  await view.settle();
  session.state.user = { ...session.state.user, userId: 12, permissionCodes: [] };
  session.state.token = 'other-tab-session';
  const event = new Event('storage');
  Object.defineProperty(event, 'key', { value: 'user' });
  session.window.dispatchEvent(event);
  assert.equal(view.render().type, view.Loader);
  assert.equal((await view.settle()).props.to, '/MyProfile');
  assert.equal(calls, 2);
  session.state.token = null;
  session.window.dispatchEvent(new Event('auth-session-changed'));
  const logout = view.render();
  assert.equal(logout.type, view.Navigate);
  assert.equal(logout.props.to, '/login');
});

function httpSession() {
  const state = { token: 'current-session', logouts: 0, redirects: 0, timers: [] };
  let rejectAxios;
  const auth = {
    getToken: () => state.token,
    logout: () => {
      state.logouts++;
      state.token = null;
    }
  };
  const http = load(
    'src/services/http.js',
    {
      axios: {
        __esModule: true,
        default: {
          interceptors: {
            response: {
              use: (_success, failure) => {
                rejectAxios = failure;
              }
            }
          }
        }
      },
      sonner: { toast: { error() {} } },
      './authService': { __esModule: true, default: auth }
    },
    {
      window: {
        location: {
          pathname: '/Orders',
          replace: () => {
            state.redirects++;
          }
        }
      },
      setTimeout: (callback) => {
        state.timers.push(callback);
        return state.timers.length;
      }
    }
  );
  return { state, auth, http, rejectAxios: (error) => rejectAxios(error) };
}

test('late Axios 401 responses cannot sign out the current account', async () => {
  const { state, rejectAxios } = httpSession();
  for (const headers of [{ Authorization: 'Bearer previous-session' }, { get: () => 'Bearer previous-session' }, {}]) {
    const error = { response: { status: 401 }, config: { headers } };
    await assert.rejects(
      () => rejectAxios(error),
      (value) => value === error
    );
  }
  assert.equal(state.logouts, 0);
  assert.equal(state.token, 'current-session');
  assert.equal(state.timers.length, 0);
});

test('an active-session 401 logs out once, but its delayed redirect cannot interrupt a new login', async () => {
  const { state, http, rejectAxios } = httpSession();
  http.handleSessionExpired('previous-session');
  assert.equal(state.logouts, 0);
  const error = { response: { status: 401 }, config: { headers: { Authorization: 'Bearer current-session' } } };
  await assert.rejects(
    () => rejectAxios(error),
    (value) => value === error
  );
  assert.equal(state.logouts, 1);
  assert.equal(state.token, null);
  state.token = 'replacement-session';
  state.timers.shift()();
  assert.equal(state.redirects, 0);
  http.handleSessionExpired('replacement-session');
  state.timers.shift()();
  assert.equal(state.logouts, 2);
  assert.equal(state.redirects, 1, 'a genuinely expired session still redirects to login');
});

test('all fetch clients associate a 401 with the token used for that request', async () => {
  const clients = [
    ['src/services/core/apiClient.js', (service) => service.request('/Example'), '../authService', '../http'],
    ['src/services/attendanceService.js', (service) => service.getRegister({}), './authService', './http'],
    ['src/services/dashboardService.js', (service) => service.getMonthlyFinancialData('', ''), './authService', './http'],
    ['src/services/reportService.js', (service) => service.getRenewalReport({}), './authService', './http'],
    ['src/services/ticketService.js', (service) => service.getTickets({}), './authService', './http']
  ];
  for (const [file, request, authPath, httpPath] of clients) {
    let token = 'request-session',
      release;
    const expired = [];
    const service = load(
      file,
      {
        [authPath]: { __esModule: true, default: { getToken: () => token } },
        [httpPath]: { handleSessionExpired: (value) => expired.push(value) }
      },
      {
        URLSearchParams,
        fetch: async () =>
          new Promise((resolve) => {
            release = resolve;
          })
      }
    ).default;
    const pending = request(service);
    token = 'replacement-session';
    release({
      ok: false,
      status: 401,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ message: 'Unauthorized' }),
      json: async () => ({ message: 'Unauthorized' })
    });
    await assert.rejects(() => pending, /Unauthorized|401|permission/i, file);
    assert.deepEqual(expired, ['request-session'], file);
  }
});

test('session expiry cancels the previous login redirect and schedules expiration for the replacement account', () => {
  const window = new EventTarget();
  const document = new EventTarget();
  const timers = new Map();
  let nextTimer = 0,
    cleanup,
    token = 'first-session',
    expires = Date.now() + 60000,
    logouts = 0,
    redirects = 0;
  window.setTimeout = (callback, delay) => {
    timers.set(++nextTimer, { callback, delay });
    return nextTimer;
  };
  window.clearTimeout = (id) => timers.delete(id);
  const auth = {
    getToken: () => token,
    getExpirationTime: () => expires,
    setupAxios() {},
    logout() {
      logouts++;
      token = null;
      window.dispatchEvent(new Event('auth-session-changed'));
    }
  };
  const Handler = load(
    'src/auth/SessionExpiryHandler.jsx',
    {
      react: {
        useEffect: (effect) => {
          cleanup = effect();
        }
      },
      sonner: { toast: { error() {} } },
      'services/authService': { __esModule: true, default: auth, AUTH_SESSION_CHANGED_EVENT: 'auth-session-changed' },
      'services/http': {
        redirectToLogin: () => {
          redirects++;
        }
      }
    },
    { window, document }
  ).default;
  Handler();
  try {
    expires = Date.now() - 1;
    window.dispatchEvent(new Event('focus'));
    assert.equal(logouts, 1);
    const oldRedirect = [...timers.values()].find((timer) => timer.delay === 750).callback;
    token = 'replacement-session';
    expires = Date.now() + 60000;
    window.dispatchEvent(new Event('auth-session-changed'));
    assert.equal(
      [...timers.values()].some((timer) => timer.delay === 750),
      false
    );
    oldRedirect();
    assert.equal(redirects, 0, 'an already queued redirect also cannot replace the new login');
    expires = Date.now() - 1;
    window.dispatchEvent(new Event('focus'));
    assert.equal(logouts, 2);
    [...timers.values()].find((timer) => timer.delay === 750).callback();
    assert.equal(redirects, 1);
  } finally {
    cleanup();
  }
});
