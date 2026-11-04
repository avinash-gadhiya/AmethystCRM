const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLiquidMotion, stepLiquidMotion, LIQUID_MATERIAL } = require('../src/components/common/liquid-membrane/motion.js');

const layout = { x: 100, y: 50, triggerWidth: 210, triggerHeight: 42, left: 100, top: 136, width: 252, height: 320, upwards: false };
const run = (state, target, seconds, fps = 60, bounds = layout) => {
  let frame;
  for (let index = 0; index < Math.round(seconds * fps); index++) frame = stepLiquidMotion(state, target, bounds, 1 / fps);
  return frame;
};

test('the menu emerges as a droplet before expanding; it does not snap into a full list', () => {
  const state = createLiquidMotion();
  const early = run(state, 1, 0.1);
  assert.ok(early.body.width < 35);
  assert.ok(early.body.height < 35);
  assert.equal(early.opacity, 0);
  const final = run(state, 1, 2.5);
  assert.equal(final.settled, true);
  assert.equal(final.opacity, 1);
  assert.ok(Math.abs(final.body.width - layout.width) < 0.1);
  assert.ok(Math.abs(final.body.height - layout.height) < 0.1);
});

test('the ligament stretches and tears at the configured separation, emitting two unequal satellites', () => {
  const state = createLiquidMotion();
  let neckSeen = false,
    torn;
  for (let index = 0; index < 80; index++) {
    const frame = stepLiquidMotion(state, 1, layout, 1 / 120);
    neckSeen ||= Boolean(frame.neck);
    if (state.torn && frame.droplets.length) {
      torn = frame;
      break;
    }
  }
  assert.equal(neckSeen, true);
  assert.ok(torn);
  assert.equal(torn.droplets.length, LIQUID_MATERIAL.count);
  assert.notEqual(torn.droplets[0].rx, torn.droplets[1].rx);
  assert.notEqual(torn.droplets[0].angle, torn.droplets[1].angle);
  assert.ok(state.recoil > 0);
  run(state, 1, 2.5);
  assert.equal(state.droplets.length, 0, 'satellites return to the surface or dissipate');
});

test('opening can reverse into a drain without a jump or stranded droplets', () => {
  const state = createLiquidMotion();
  run(state, 1, 0.2);
  const previous = state.progress;
  stepLiquidMotion(state, 0, layout, 1 / 120);
  assert.ok(Math.abs(state.progress - previous) < 0.06);
  const closed = run(state, 0, 3);
  assert.equal(closed.settled, true);
  assert.equal(closed.opacity, 0);
  assert.equal(closed.droplets.length, 0);
});

test('the material remains stable at different frame rates and when opening above the trigger', () => {
  const positions = [30, 60, 120].map((fps) => {
    const state = createLiquidMotion();
    run(state, 1, 0.3, fps);
    return state.progress;
  });
  assert.ok(Math.max(...positions) - Math.min(...positions) < 0.025);
  const above = { ...layout, y: 500, top: 136, upwards: true };
  const frame = run(createLiquidMotion(), 1, 3, 60, above);
  assert.ok(Math.abs(frame.body.y - above.top) < 0.1);
  assert.equal(frame.settled, true);
});

test('reduced motion immediately shows or hides the list without a neck or satellites', () => {
  const state = createLiquidMotion();
  const open = stepLiquidMotion(state, 1, layout, 1 / 60, true);
  assert.equal(open.settled, true);
  assert.equal(open.opacity, 1);
  assert.equal(open.neck, '');
  assert.equal(open.droplets.length, 0);
  const closed = stepLiquidMotion(state, 0, layout, 1 / 60, true);
  assert.equal(closed.settled, true);
  assert.equal(closed.opacity, 0);
});

test('a compact menu settles near the trigger with a detached surface and no leftover ligament', () => {
  const state = createLiquidMotion();
  const compact = { ...layout, top: layout.y + layout.triggerHeight + 12 };
  const frame = run(state, 1, 3, 60, compact);
  assert.ok(Math.abs(frame.body.y - layout.y - layout.triggerHeight - 12) < 0.1);
  assert.equal(frame.neck, '');
  assert.equal(frame.droplets.length, 0);
  assert.equal(frame.settled, true);
  assert.equal(state.torn, true);
});
