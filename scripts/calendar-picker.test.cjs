const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('esbuild');

function load(file, dependencies = {}) {
  const context = {
    module: { exports: {} },
    Event,
    console,
    Date,
    window: { requestAnimationFrame: (callback) => callback() },
    require: (name) => {
      if (name.endsWith('.css')) return {};
      if (!(name in dependencies)) throw new Error(`Missing test dependency ${name}`);
      return dependencies[name];
    }
  };
  vm.runInNewContext(transformSync(fs.readFileSync(file, 'utf8'), { loader: 'jsx', format: 'cjs', jsx: 'automatic' }).code, context);
  return context.module.exports;
}
const utils = load('src/utils/calendarUtils.js');
const plain = (value) => JSON.parse(JSON.stringify(value));

function harness(file, props = {}) {
  const states = [],
    refs = [];
  let stateIndex = 0,
    refIndex = 0;
  const jsx = (type, properties) => ({ type, props: properties || {} });
  const Component = load(file, {
    react: {
      useState: (initial) => {
        const index = stateIndex++;
        if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
        return [
          states[index],
          (next) => {
            states[index] = typeof next === 'function' ? next(states[index]) : next;
          }
        ];
      },
      useRef: (initial) => refs[refIndex] || (refs[refIndex++] = { current: initial }),
      useId: () => 'calendar-heading',
      forwardRef: (render) => render
    },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    '@radix-ui/react-popover': { Root: 'Root', Anchor: 'Anchor', Trigger: 'Trigger', Portal: 'Portal', Content: 'Content' },
    'lucide-react': Object.fromEntries(['Calendar', 'CalendarDays', 'ChevronLeft', 'ChevronRight', 'RotateCcw'].map((key) => [key, key])),
    './MiniCalendar': { __esModule: true, default: 'MiniCalendar' },
    '@/utils/calendarUtils': utils
  }).default;
  const render = () => {
    stateIndex = 0;
    refIndex = 0;
    return Component(props, null);
  };
  return { render, states };
}
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap((node) => nodes(node, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}

test('calendar grids include leap days and reject invalid input dates', () => {
  assert.equal(utils.calendarDate('2025-02-29'), null);
  assert.equal(utils.calendarYmd(utils.calendarDate('2024-02-29')), '2024-02-29');
  const grid = utils.calendarDays(new Date(2024, 1, 1));
  assert.equal(grid.length, 42);
  assert.equal(grid[0].getDay(), 0);
  assert.ok(grid.some((date) => utils.calendarYmd(date) === '2024-02-29'));
});

test('range selection orders reversed endpoints and starts a new selection', () => {
  assert.deepEqual(plain(utils.nextCalendarRange('2026-10-20', '', '2026-10-10')), { fromDate: '2026-10-10', toDate: '2026-10-20' });
  assert.deepEqual(plain(utils.nextCalendarRange('2026-10-10', '2026-10-20', '2026-10-29')), { fromDate: '2026-10-29', toDate: '' });
});

test('period arrows preserve full months, single days, and custom spans', () => {
  assert.deepEqual(plain(utils.shiftCalendarRange('2024-01-01', '2024-01-31', 1)), { fromDate: '2024-02-01', toDate: '2024-02-29' });
  assert.deepEqual(plain(utils.shiftCalendarRange('2026-10-29', '2026-10-29', 1)), { fromDate: '2026-10-30', toDate: '2026-10-30' });
  assert.deepEqual(plain(utils.shiftCalendarRange('2026-10-01', '2026-10-07', -1)), { fromDate: '2026-09-24', toDate: '2026-09-30' });
});

test('min/max bounds include endpoints and date-time selection retains time', () => {
  assert.equal(utils.dateWithinBounds('2026-10-10', '2026-10-10T14:00', '2026-10-20T17:00'), true);
  assert.equal(utils.dateWithinBounds('2026-10-09', '2026-10-10'), false);
  assert.equal(utils.dateWithinBounds('2026-10-21', '', '2026-10-20'), false);
  assert.equal(utils.dateWithTime('2026-10-29', '2026-10-28T15:30:45'), '2026-10-29T15:30:45');
  assert.equal(utils.dateWithTime('2026-10-29', '', '2026-10-29T09:00'), '2026-10-29T09:00');
});

test('single-date picker preserves the real field name, constraints, and change target', () => {
  const calls = [];
  const h = harness('src/components/common/MiniCalendarInput.jsx', {
    name: 'paymentDate',
    value: '2026-10-01',
    required: true,
    min: '2026-10-01',
    onChange: (event) => calls.push(event.target.value)
  });
  const tree = h.render();
  const input = nodes(tree, (node) => node.type === 'input')[0];
  const element = { value: input.props.value, name: input.props.name };
  input.props.ref(element);
  nodes(tree, (node) => node.type === 'MiniCalendar')[0].props.onSelect('2026-10-29');
  assert.deepEqual(calls, ['2026-10-29']);
  assert.equal(input.props.name, 'paymentDate');
  assert.equal(input.props.required, true);
  assert.equal(input.props.min, '2026-10-01');
  assert.equal(input.props.type, 'date');
});

test('disabled date inputs cannot change values', () => {
  let changes = 0;
  const h = harness('src/components/common/MiniCalendarInput.jsx', { disabled: true, onChange: () => changes++ });
  const tree = h.render();
  nodes(tree, (node) => node.type === 'input')[0].props.ref({ value: '' });
  nodes(tree, (node) => node.type === 'MiniCalendar')[0].props.onSelect('2026-10-29');
  assert.equal(changes, 0);
});

test('ticket date-time calendar retains the time when changing date', () => {
  let selected;
  const h = harness('src/components/common/MiniCalendarInput.jsx', {
    type: 'datetime-local',
    value: '2026-10-01T14:35',
    onChange: (event) => {
      selected = event.target.value;
    }
  });
  const tree = h.render();
  nodes(tree, (node) => node.type === 'input' && node.props.type === 'datetime-local')[0].props.ref({ value: '2026-10-01T14:35' });
  nodes(tree, (node) => node.type === 'MiniCalendar')[0].props.onSelect('2026-10-29');
  assert.equal(selected, '2026-10-29T14:35');
});

test('range calendar works by default and only applies confirmed changes', () => {
  const calls = [];
  const h = harness('src/components/common/LiquidGlassDatePicker.jsx', {
    initialFromDate: '2026-10-01',
    initialToDate: '2026-10-31',
    onChange: (...args) => calls.push(args)
  });
  let tree = h.render();
  assert.equal(nodes(tree, (node) => node.type === 'input').length, 0);
  nodes(tree, (node) => node.type === 'MiniCalendar')[0].props.onSelect('2026-10-10');
  tree = h.render();
  nodes(tree, (node) => node.type === 'MiniCalendar')[0].props.onSelect('2026-10-20');
  assert.equal(calls.length, 0);
  tree = h.render();
  nodes(tree, (node) => node.type === 'button' && node.props.children === 'Apply')[0].props.onClick();
  assert.deepEqual(calls, [['2026-10-10', '2026-10-20']]);
});

test('quick date presets remain available alongside the mini calendar', () => {
  let selected;
  const h = harness('src/components/common/LiquidGlassDatePicker.jsx', {
    showQuickDateDropdown: true,
    showQuickDateCustomOption: false,
    quickDateOptions: [{ value: 'month', label: 'This month' }],
    onQuickDateChange: (value) => {
      selected = value;
    }
  });
  const tree = h.render();
  assert.equal(nodes(tree, (node) => node.type === 'MiniCalendar').length, 1);
  nodes(tree, (node) => node.type === 'button' && node.props.children === 'This month')[0].props.onClick();
  assert.equal(selected, 'month');
});
