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
function load(file, globals = {}, dependencies = {}) {
  const source = transformSync(fs.readFileSync(file, 'utf8'), { format: 'cjs' }).code;
  const context = {
    module: { exports: {} },
    Event,
    AbortController,
    setTimeout,
    clearTimeout,
    require: (key) => dependencies[key],
    ...globals
  };
  vm.runInNewContext(source, context);
  return context.module.exports;
}
const ipService = (storage, fetch) => load('src/services/clientIpService.js', { window: { localStorage: storage }, fetch });

test('removes old activity storage, keeps authentication, and leaves one public IP entry', () => {
  const storage = new Storage({
    token: 'test-session',
    userIp: '203.0.113.42',
    unrelated: 'keep',
    crm_auth_activity_attendance_snapshot: '{}',
    crm_auth_activity_notifications: '[]',
    'crm_auth_activity_notifications_read:10': '123'
  });
  load('src/lib/browserStorage.js', { localStorage: storage }).clearStoredActivityData();
  assert.deepEqual([...storage.values.keys()].sort(), ['token', 'unrelated', 'userIp']);
});

test('activity recording, attendance snapshots, and unread tracking work without any browser storage', () => {
  const blocked = {
    getItem() {
      throw new Error('Storage must not be read');
    },
    setItem() {
      throw new Error('Storage must not be written');
    }
  };
  const service = load('src/services/activityNotificationService.js', { localStorage: blocked, window: new EventTarget() }).default;
  const user = { userId: 10, userName: 'test', roleName: 'Developer' };
  service.record('login', user, { timestamp: '2020-01-01T00:00:00Z' });
  assert.equal(service.getActivities().length, 1);
  assert.equal(service.getUnreadCount(user), 1);
  service.markAllAsRead(user);
  assert.equal(service.getUnreadCount(user), 0);
  assert.equal(service.isActivityRead(service.getActivities()[0], user), true);
  service.syncAttendanceRegister({
    data: { users: [{ userId: 11, totalLogins: 1, isOnline: true, lastLoginLocal: '2020-01-01T00:00:00Z' }] }
  });
  service.syncAttendanceRegister({
    data: { users: [{ userId: 11, totalLogins: 2, isOnline: true, lastLoginLocal: '2020-01-02T00:00:00Z' }] }
  });
  assert.equal(service.getActivities().filter((activity) => activity.userId === 11 && activity.type === 'login').length, 1);
  service.syncAttendanceRegister({
    data: {
      users: [
        { userId: 11, totalLogins: 2, isOnline: false, lastLoginLocal: '2020-01-02T00:00:00Z', lastLogoutLocal: '2020-01-02T01:00:00Z' }
      ]
    }
  });
  assert.equal(service.getActivities().filter((activity) => activity.userId === 11 && activity.type === 'logout').length, 1);
});

test('IP detection deduplicates startup and login requests and stores only userIp', async () => {
  const storage = new Storage({ 'crm.currentLoginIpv4': '198.51.100.10', clientIp: '198.51.100.10' });
  let calls = 0;
  let release;
  const service = ipService(storage, () => {
    calls += 1;
    return new Promise((resolve) => {
      release = resolve;
    });
  });
  const startup = service.getCurrentLoginIpv4(true);
  const login = service.getCurrentLoginIpv4(true);
  release({ ok: true, json: async () => ({ ip: '203.0.113.42' }) });
  assert.equal(await startup, '203.0.113.42');
  assert.equal(await login, '203.0.113.42');
  assert.equal(calls, 1);
  assert.equal(storage.getItem('userIp'), '203.0.113.42');
  assert.deepEqual([...storage.values.keys()], ['userIp']);
});

test('invalid provider data falls back to a valid IPv4 response', async () => {
  const storage = new Storage();
  const calls = [];
  const service = ipService(storage, async (url) => {
    calls.push(url);
    return url.includes('ipify')
      ? { ok: true, json: async () => ({ ip: 'invalid-203.0.113.42' }) }
      : { ok: true, text: async () => '203.0.113.43\n' };
  });
  assert.equal(await service.getCurrentLoginIpv4(true), '203.0.113.43');
  assert.equal(calls.length, 2);
  assert.equal(storage.getItem('userIp'), '203.0.113.43');
});

test('IP lookup still returns the detected IP when localStorage is disabled', async () => {
  const storage = {
    getItem() {
      throw new Error('Blocked');
    },
    setItem() {
      throw new Error('Blocked');
    }
  };
  const service = ipService(storage, async () => ({ ok: true, json: async () => ({ ip: '203.0.113.42' }) }));
  assert.equal(await service.getCurrentLoginIpv4(), '203.0.113.42');
  assert.equal(await service.getCurrentLoginIpv4(), '203.0.113.42');
});

test('failed lookup clears a stale IP and never saves localhost or a fabricated address', async () => {
  const storage = new Storage({ userIp: '198.51.100.10' });
  let calls = 0;
  const service = ipService(storage, async () => {
    calls += 1;
    throw new Error('Offline');
  });
  assert.equal(await service.getCurrentLoginIpv4(true), '');
  assert.equal(storage.getItem('userIp'), null);
  assert.equal(await service.getCurrentLoginIpv4(), '');
  assert.equal(calls, 2, 'ordinary requests do not repeatedly retry a failed lookup');
});

test('legacy stored IP values migrate to one readable userIp key', () => {
  const storage = new Storage({ 'crm.currentLoginIpv4': '203.0.113.42', loginIp: '203.0.113.42' });
  const service = ipService(storage, () => {
    throw new Error('No network lookup needed');
  });
  assert.equal(service.getStoredUserIp(), '203.0.113.42');
  assert.deepEqual([...storage.values.keys()], ['userIp']);
});

test('startup removes both legacy activity caches and initializes the IP lookup', () => {
  const local = new Storage({ crm_auth_activity_notifications: '[]', crm_auth_activity_attendance_snapshot: '{}' });
  const session = new Storage({ 'crm_auth_activity_notifications_read:10': '123' });
  const browserStorage = load('src/lib/browserStorage.js', { localStorage: local });
  let calls = 0;
  load(
    'src/bootstrap.js',
    { window: {}, localStorage: local, sessionStorage: session },
    {
      './lib/browserStorage': browserStorage,
      './services/clientIpService': {
        getCurrentLoginIpv4: async (force) => {
          assert.equal(force, true);
          calls += 1;
        }
      }
    }
  );
  assert.equal(local.length, 0);
  assert.equal(session.length, 0);
  assert.equal(calls, 1);
});
