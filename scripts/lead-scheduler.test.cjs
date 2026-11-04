const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('esbuild');
const contract = require('../src/services/catalog/crmApiContract.json');

function load(file, dependencies = {}) {
  const context = {
    module: { exports: {} },
    require: (name) => {
      if (!(name in dependencies)) throw Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    }
  };
  vm.runInNewContext(transformSync(fs.readFileSync(file, 'utf8'), { format: 'cjs' }).code, context, { filename: file });
  return context.module.exports;
}
const helpers = load('src/lib/leadScheduler.js');
const plain = (value) => JSON.parse(JSON.stringify(value));
const actor = { userId: 11, displayName: 'Schedule Manager' };
const stored = {
  leadSchedulerId: 4,
  isActive: true,
  groupId: 2004,
  groupName: 'nj',
  shiftStartTime: '09:05:00',
  shiftEndTime: '22:00:00',
  createdDate: '2026-10-09T01:18:00',
  updatedDate: '2026-10-09T06:48:20.907',
  createdBy: 10,
  createdByName: 'CRM Developer',
  updatedBy: 10,
  updatedByName: 'CRM Developer'
};
const form = { groupId: '2004', groupName: 'nj', shiftStartTime: '09:05', shiftEndTime: '22:00', isActive: true };
const service = (api) =>
  load('src/services/leadSchedulerService.js', {
    './core/apiClient': { __esModule: true, default: api },
    './authService': { __esModule: true, default: { getUser: () => actor } },
    '@/lib/leadScheduler': helpers
  }).default;

test('GET shift strings and POST/PUT tick objects round-trip without timezone conversion', () => {
  assert.equal(helpers.shiftTimeTicks(stored.shiftStartTime), 327000000000);
  assert.equal(helpers.shiftTimeTicks(stored.shiftEndTime), 792000000000);
  assert.equal(helpers.formatShiftTime({ ticks: 327000000000 }), '09:05:00');
  assert.equal(helpers.shiftTimeTicks('00:00'), 0);
  assert.equal(helpers.shiftTimeTicks('23:59:59.9999999'), 863999999999);
  assert.equal(helpers.formatShiftTime({ ticks: 863999999999 }), '23:59:59.9999999');
  assert.equal(helpers.shiftTimeInput('09:05:00.1234567'), '09:05:00.123');
});

test('invalid or out-of-day times cannot be serialized as valid shifts', () => {
  for (const value of ['', null, '24:00', '09:60', '09:05:60', '-01:00', '09:05:00.12345678', {}, { ticks: -1 }, { ticks: 864000000000 }]) {
    assert.throws(() => helpers.shiftTimeTicks(value), /valid shift time/);
  }
  assert.equal(helpers.formatShiftTime('invalid'), '');
});

test('POST uses exactly the supplied LeadScheduler DTO and the authenticated creator', async () => {
  let request;
  const scheduler = service({
    post: async (path, body) => {
      request = { path, body };
      return { success: true };
    }
  });
  await scheduler.createSchedule({ ...form, leadSchedulerId: 999, createdBy: 999, createdByName: 'Wrong Creator', uiOnly: true });
  assert.equal(request.path, '/LeadScheduler');
  assert.deepEqual(Object.keys(request.body).sort(), [...contract.operations['POST /LeadScheduler'].bodyFields].sort());
  assert.equal(request.body.leadSchedulerId, 0);
  assert.equal(request.body.groupId, 2004);
  assert.equal(request.body.groupName, 'nj');
  assert.deepEqual(plain(request.body.shiftStartTime), { ticks: 327000000000 });
  assert.deepEqual(plain(request.body.shiftEndTime), { ticks: 792000000000 });
  assert.equal(request.body.createdBy, 11);
  assert.equal(request.body.createdByName, 'Schedule Manager');
  assert.equal(request.body.updatedBy, 11);
  assert.ok(Date.now() - Date.parse(request.body.createdDate) < 5000);
});

test('PUT targets the existing schedule, preserves creation metadata, and supports inactive overnight shifts', async () => {
  let request;
  await service({
    put: async (path, body) => {
      request = { path, body };
    }
  }).updateSchedule({ ...form, shiftStartTime: '22:00', shiftEndTime: '06:00', isActive: false }, stored);
  assert.equal(request.path, '/LeadScheduler');
  assert.deepEqual(Object.keys(request.body).sort(), [...contract.operations['PUT /LeadScheduler'].bodyFields].sort());
  assert.equal(request.body.leadSchedulerId, 4);
  assert.equal(request.body.isActive, false);
  assert.equal(request.body.createdDate, stored.createdDate);
  assert.equal(request.body.createdBy, 10);
  assert.equal(request.body.createdByName, 'CRM Developer');
  assert.equal(request.body.updatedBy, 11);
  assert.equal(request.body.updatedByName, 'Schedule Manager');
  assert.deepEqual(plain(request.body.shiftStartTime), { ticks: 792000000000 });
  assert.deepEqual(plain(request.body.shiftEndTime), { ticks: 216000000000 });
});

test('unedited times retain sub-millisecond precision and explicit edits replace it', () => {
  const existing = { ...stored, shiftStartTime: '09:05:00.1234567' };
  const input = { ...form, shiftStartTime: helpers.shiftTimeInput(existing.shiftStartTime) };
  assert.equal(helpers.buildLeadSchedulerPayload(input, { existing, user: actor }).shiftStartTime.ticks, 327001234567);
  assert.equal(
    helpers.buildLeadSchedulerPayload({ ...input, shiftStartTime: '10:00' }, { existing, user: actor }).shiftStartTime.ticks,
    360000000000
  );
});

test('DELETE uses the required path ID, validates identity, and propagates API failures', async () => {
  const calls = [];
  const scheduler = service({
    delete: async (...args) => {
      calls.push(args);
      return { success: true };
    }
  });
  await scheduler.deleteSchedule(4);
  assert.deepEqual(plain(calls), [['/LeadScheduler/4']]);
  for (const id of [0, -1, 'wrong', 1.5]) assert.throws(() => scheduler.deleteSchedule(id), /valid schedule ID/);
  const failure = Error('Permission denied');
  await assert.rejects(
    service({
      delete: async () => {
        throw failure;
      }
    }).deleteSchedule(4),
    (error) => error === failure
  );
});

test('missing group/session or invalid update identity blocks writes; save errors propagate', async () => {
  assert.throws(() => helpers.buildLeadSchedulerPayload({ ...form, groupId: 0 }, { user: actor }), /Select a group/);
  assert.throws(() => helpers.buildLeadSchedulerPayload(form, { user: null }), /session/);
  assert.throws(() => helpers.buildLeadSchedulerPayload(form, { user: actor, existing: { leadSchedulerId: 0 } }), /schedule ID/);
  const failure = Error('Schedule already exists');
  await assert.rejects(
    service({
      post: async () => {
        throw failure;
      }
    }).createSchedule(form),
    (error) => error === failure
  );
});
