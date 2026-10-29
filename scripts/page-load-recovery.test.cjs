const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('src/lib/pageLoadRecovery.js', 'utf8').replace('export function', 'function');

function setup({ stored = null, storageUnavailable = false } = {}) {
  const listeners = new Map();
  let time = 100_000;
  let reloads = 0;
  let prevented = 0;
  const storage = { value: stored };
  const browser = {
    location: { href: 'https://crm.test/DashboardKit/settings/gateway', reload: () => reloads++ },
    sessionStorage: {
      getItem() {
        if (storageUnavailable) throw new Error('Storage unavailable');
        return storage.value;
      },
      setItem(key, value) {
        if (storageUnavailable) throw new Error('Storage unavailable');
        storage.value = value;
      }
    },
    addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener: (name) => listeners.delete(name)
  };
  const context = vm.createContext({ Date: { now: () => time } });
  vm.runInContext(source + '\nthis.install = installPageLoadRecovery;', context);
  const uninstall = context.install(browser);
  return {
    browser,
    storage,
    listeners,
    uninstall,
    fail: () => listeners.get('vite:preloadError')({ preventDefault: () => prevented++ }),
    advance: (milliseconds) => {
      time += milliseconds;
    },
    get reloads() {
      return reloads;
    },
    get prevented() {
      return prevented;
    }
  };
}

test('a stale page download reloads once and preserves the current URL', () => {
  const app = setup();
  app.fail();
  assert.equal(app.reloads, 1);
  assert.equal(app.prevented, 1);
  assert.equal(JSON.parse(app.storage.value).path, app.browser.location.href);
});

test('repeated failures, including after a full document reload, cannot loop', () => {
  const app = setup();
  app.fail();
  app.fail();
  assert.equal(app.reloads, 1);
  assert.equal(app.prevented, 1);
  const reloaded = setup({ stored: app.storage.value });
  reloaded.fail();
  assert.equal(reloaded.reloads, 0);
  assert.equal(reloaded.prevented, 0, 'Allow the router to show the error screen');
});

test('a later deployment can recover after the retry window expires', () => {
  const app = setup();
  app.fail();
  app.advance(60_001);
  app.fail();
  assert.equal(app.reloads, 2);
});

test('a different page can recover independently', () => {
  const app = setup();
  app.fail();
  app.browser.location.href = 'https://crm.test/DashboardKit/Dashboard/Leads';
  app.fail();
  assert.equal(app.reloads, 2);
});

test('unavailable or invalid storage falls through to the manual recovery screen', () => {
  for (const options of [{ storageUnavailable: true }, { stored: '{invalid' }]) {
    const app = setup(options);
    assert.doesNotThrow(app.fail);
    assert.equal(app.reloads, 0);
    assert.equal(app.prevented, 0);
  }
});

test('the recovery handler can be removed', () => {
  const app = setup();
  app.uninstall();
  assert.equal(app.listeners.size, 0);
});
