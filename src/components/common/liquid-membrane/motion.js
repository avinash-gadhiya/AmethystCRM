// Material values from the supplied Cohesion settings. The menu fixture slows
// the material spring to 34%: using the unscaled spring makes the pour snap open.
export const LIQUID_MATERIAL = Object.freeze({
  viscosity: 0.35,
  breakRatio: 0.496,
  distance: 44,
  drop: 13,
  spring: 22.15,
  bounce: 0.508,
  speed: 0.965,
  pourScale: 0.34,
  blur: 5.05,
  contrast: 31.2,
  threshold: 0.392,
  // A fine rim keeps the filtered surface from becoming a heavy outline.
  rim: 0.45,
  neck: 0.704,
  recoil: 0.2665,
  count: 2,
  size: 0.99,
  sizeSpread: 0.445,
  speedSpread: 0.395,
  launch: 1.815,
  scatter: 0.36,
  gravity: 0.0367,
  drag: 0.886,
  wakeAt: 0.071,
  wakeRate: 0.158,
  bodySquash: 0.388,
  stretch: 0.4275,
  wobble: 0.256,
  ringSpeed: 0.495,
  grace: 8,
  pullRange: 2.48,
  pullHome: 0.0405
});

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const mix = (from, to, progress) => from + (to - from) * progress;
const phase = (value, from, to) => {
  const p = clamp((value - from) / (to - from));
  return p * p * (3 - 2 * p);
};

export const createLiquidMotion = () => ({
  progress: 0,
  velocity: 0,
  torn: false,
  recoil: 0,
  droplets: [],
  lastY: null,
  wake: 0,
  elapsed: 0,
  sequence: 0
});

const geometry = (state, layout) => {
  const m = LIQUID_MATERIAL;
  const p = state.progress;
  const fall = phase(p, 0, 0.78);
  const across = phase(p, 0.34, 0.9);
  const along = phase(p, 0.46, 1);
  const diameter = m.drop * 2;
  const width = mix(diameter, layout.width, across);
  const height = mix(diameter, layout.height, along);
  const x = mix(layout.x + layout.triggerWidth / 2, layout.left + layout.width / 2, across) - width / 2;
  const near = layout.upwards
    ? mix(layout.y + diameter, layout.top + layout.height, fall)
    : mix(layout.y + layout.triggerHeight - diameter, layout.top, fall);
  return { x, y: layout.upwards ? near - height : near, width, height, radius: mix(m.drop, 16, along), along };
};

const spawnDrop = (state, x, y, gap, direction, index) => {
  const m = LIQUID_MATERIAL;
  // Different sizes, launch angles and speeds stop the satellites moving as a pair.
  const variation = Math.sin(++state.sequence * 2.39996);
  const angle = (index ? 1 : -1) * m.scatter * (0.7 + Math.abs(variation));
  const speed = Math.max(1.2, (gap * m.launch) / 15) * (1 + variation * m.speedSpread);
  state.droplets.push({
    x,
    y,
    vx: Math.sin(angle) * speed,
    vy: direction * Math.cos(angle) * speed,
    radius: 7.4 * m.size * (1 + variation * m.sizeSpread * 0.5),
    age: 0,
    phase: index * 1.7,
    wobble: m.wobble
  });
};

const surfacePoint = (rect, drop) => {
  const x = clamp(drop.x, rect.x + rect.radius, rect.x + rect.width - rect.radius);
  const y = clamp(drop.y, rect.y + rect.radius, rect.y + rect.height - rect.radius);
  const dx = drop.x - x,
    dy = drop.y - y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: x + (dx / length) * rect.radius, y: y + (dy / length) * rect.radius, distance: length - rect.radius };
};

const ligament = (x, start, end, anchor, waist) => {
  const middle = (start + end) / 2;
  return `M${x - anchor},${start} C${x - anchor},${middle} ${x - waist},${middle} ${x - waist},${middle} C${x - waist},${middle} ${x - anchor},${middle} ${x - anchor},${end} L${x + anchor},${end} C${x + anchor},${middle} ${x + waist},${middle} ${x + waist},${middle} C${x + waist},${middle} ${x + anchor},${middle} ${x + anchor},${start} Z`;
};

export const stepLiquidMotion = (state, target, layout, seconds, reduced = false) => {
  const m = LIQUID_MATERIAL;
  const dt = Math.min(seconds, 0.04) * m.speed;
  const frames = dt * 60;
  state.elapsed += dt;
  if (reduced) {
    state.progress = target;
    state.velocity = 0;
    state.droplets = [];
    state.recoil = 0;
  } else {
    const omega = m.spring * m.pourScale;
    // Substeps keep the same material stable at 30, 60 and 120 Hz.
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    for (let index = 0; index < steps; index++) {
      const delta = dt / steps;
      state.velocity += ((target - state.progress) * omega * omega - 2 * m.bounce * omega * state.velocity) * delta;
      state.progress += state.velocity * delta;
    }
  }
  const body = geometry(state, layout);
  const direction = layout.upwards ? -1 : 1;
  const centerX = layout.x + layout.triggerWidth / 2;
  const start = layout.upwards ? layout.y + 5 : layout.y + layout.triggerHeight - 5;
  const end = layout.upwards ? body.y + body.height - 5 : body.y + 5;
  const gap = Math.max(0, direction * (end - start) - 10);
  const separation = layout.upwards ? layout.y - layout.top - layout.height : layout.top - layout.y - layout.triggerHeight;
  const breaking = Math.max(1, Math.min(m.distance, separation)) * m.breakRatio * 1.6;
  const anchor = Math.min(layout.triggerHeight, body.height) * 0.3;
  const waist = Math.max(m.blur * 0.6, anchor * (1 - m.neck * clamp(gap / breaking)));
  let neck = '';

  if (gap < breaking * 0.45) state.torn = false;
  if (!reduced && !state.torn && gap > breaking) {
    state.torn = true;
    state.recoil = 1;
    state.droplets = [];
    for (let index = 0; index < m.count; index++) {
      spawnDrop(
        state,
        centerX + (index ? 2 : -2),
        mix(start, end, (index + 1) / (m.count + 1)),
        gap,
        index ? direction : -direction,
        index
      );
    }
  }
  if (!reduced && !state.torn && gap > 0) neck = ligament(centerX, start, end, anchor, waist);
  if (!reduced && state.torn && state.recoil > 0) {
    const length = Math.abs(end - start) * 0.3 * state.recoil;
    neck =
      ligament(centerX, start, start + direction * length, anchor * state.recoil, waist * state.recoil) +
      ligament(centerX, end - direction * length, end, anchor * state.recoil, waist * state.recoil);
    state.recoil = Math.max(0, state.recoil - m.recoil * frames);
  }

  const movement = state.lastY === null ? 0 : (body.y - state.lastY) / Math.max(frames, 0.01);
  state.lastY = body.y;
  const radius = Math.min(body.width, body.height) / 2;
  const speed = Math.abs(movement) / Math.max(radius, 1);
  if (!reduced && target && !state.torn) {
    state.wake += Math.max(0, speed - m.wakeAt) * m.wakeRate * frames;
    if (state.wake >= 1 && state.droplets.length < m.count) {
      state.wake %= 1;
      spawnDrop(state, centerX, start + direction * gap * 0.4, Math.max(10, gap), -direction, 0);
    }
  }

  const trigger = { x: layout.x, y: layout.y, width: layout.triggerWidth, height: layout.triggerHeight, radius: layout.triggerHeight / 2 };
  state.droplets = state.droplets.filter((drop) => {
    drop.age += frames;
    const points = [surfacePoint(trigger, drop), surfacePoint(body, drop)].sort((a, b) => a.distance - b.distance);
    const home = points[0];
    if (drop.age > m.grace && home.distance < drop.radius * 0.25) return false;
    if (drop.age > m.grace) {
      const dx = home.x - drop.x,
        dy = home.y - drop.y;
      const distance = Math.hypot(dx, dy) || 1;
      const proximity = clamp(1 - home.distance / (drop.radius * m.pullRange));
      const pull = m.pullHome * 24 * (0.35 + proximity * proximity * 2) * frames;
      drop.vx += (dx / distance) * pull;
      drop.vy += (dy / distance) * pull;
    }
    drop.vy += m.gravity * frames;
    drop.vx *= Math.pow(m.drag, frames);
    drop.vy *= Math.pow(m.drag, frames);
    drop.x += drop.vx * frames;
    drop.y += drop.vy * frames;
    drop.phase += m.ringSpeed * frames;
    drop.wobble *= Math.pow(0.93, frames);
    if (drop.age > m.grace * 5) drop.radius *= Math.pow(0.9, frames);
    return drop.radius > 2 && drop.age < 150;
  });

  // Conserve approximate area as the moving body stretches and then settles.
  const squash = reduced ? 0 : Math.min(0.12, speed * m.bodySquash * 0.18);
  const width = body.width / (1 + squash);
  const height = body.height * (1 + squash);
  const shape = { ...body, x: body.x + (body.width - width) / 2, y: body.y - (height - body.height) / 2, width, height };
  const droplets = state.droplets.map((drop) => {
    const stretch = Math.min(0.65, Math.hypot(drop.vx, drop.vy) * m.stretch * 0.15);
    const radius = drop.radius * (1 + drop.wobble * Math.sin(drop.phase));
    return {
      x: drop.x,
      y: drop.y,
      rx: radius * (1 + stretch),
      ry: radius / (1 + stretch),
      angle: (Math.atan2(drop.vy, drop.vx) * 180) / Math.PI
    };
  });
  return {
    body: shape,
    neck,
    droplets,
    opacity: phase(body.along, 0.45, 0.85),
    settled:
      (reduced || (Math.abs(target - state.progress) < 0.001 && Math.abs(state.velocity) < 0.01)) &&
      !state.droplets.length &&
      state.recoil === 0
  };
};
