import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { compactJS } from './source.mjs';

// Exercise the shipped inline implementation, not a second copy of its math.
const html = readFileSync(new URL('../public/skybreak.html', import.meta.url), 'utf8');
const inline = html.match(/<script id="flight-core">([\s\S]*?)<\/script>/)[1];
const game = compactJS(html.match(/<script type="module" id="game-code">([\s\S]*?)<\/script>/)[1]);
const context = vm.createContext({});
vm.runInContext(inline + '\nglobalThis.core=FlightCore;', context);
const C = context.core;
const boxSource = game.slice(game.indexOf('const boxDefinitions='), game.indexOf('const plumeGeometry='));
vm.runInContext(boxSource + '\nglobalThis.boxes=hitboxes;', context);
const boxes = context.boxes;
const identity = () => ({ x: 0, y: 0, z: 0, w: 1 });
const origin = () => ({ x: 0, y: 0, z: 0 });
const pose = () => ({ p: origin(), q: identity() });
const near = (a, b, eps = 1e-7) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const localRay = (a, b) => C.aircraftHit(a, b, pose(), pose(), boxes);

test('localhost entry is the complete standalone HTML, not a wrapper', () => {
  assert.equal(readFileSync(new URL('../public/index.html', import.meta.url), 'utf8'), html);
  assert.match(html, /https:\/\/unpkg.com\/three@0\.180\.0\/build\/three.module.js/);
  assert.doesNotMatch(html, /<script[^>]*\bsrc=|<link[^>]*rel="stylesheet"|import\s.*from\s*['"]\.\//);
  assert.match(html, /<style>[\s\S]+<\/style>/);
  assert.ok(html.endsWith('</html>\n'));
});
test('missile operations retain target validation alongside the separate cannon modes', () => {
  assert.match(game, /state\.missionMode==='duel'\|\|state\.missionMode==='laststand'/);
  const fire = game.slice(game.indexOf('function fireMissile('), game.indexOf('function feed('));
  assert.ok(fire.indexOf('!eligibleTarget(seeker.target)') < fire.indexOf('C.launchReady(jet.launcher)'));
  assert.match(game, /shot\.owner=null;shot\.target=null;freeShots\.push\(shot\)/);
  assert.match(
    game,
    /for\(const aircraft of shot\.owner===player\?enemies:\[player,\.\.\.\(escort\?\.alive\?\[escort\]:\[\]\)\]\)/
  );
  assert.match(game, /for\(let i=0;i<state.enemyCount;i\+\+\)spawnEnemy\(i,true\)/);
});
test('released inputs leave quaternion bit-for-bit unchanged', () => {
  const q = identity();
  C.integrate(q, { pitch: 0.8, roll: -0.5, yaw: 0.1 }, 140, 0.5);
  const previous = { ...q };
  for (let i = 0; i < 1000; i++) C.integrate(q, {}, 140, 1 / 120);
  assert.deepEqual(q, previous);
});
test('pitch completes a 360 degree loop without angular clamps', () => {
  const q = identity(),
    duration = (2 * Math.PI) / (1.03 * C.authority(140));
  for (let i = 0; i < 1000; i++) C.integrate(q, { pitch: 1 }, 140, duration / 1000);
  near(Math.abs(q.w), 1);
  near(q.x, 0);
  near(q.y, 0);
  near(q.z, 0);
});
test('roll passes through inverted attitude and completes 360 degrees', () => {
  const q = identity();
  C.integrate(q, { roll: 1 }, 140, Math.PI / 2.4);
  near(C.rotate({ x: 0, y: 1, z: 0 }, q).y, -1);
  C.integrate(q, { roll: 1 }, 140, Math.PI / 2.4);
  near(Math.abs(q.w), 1);
});
test('combined pitch, roll and yaw are frame-subdivision independent', () => {
  const a = identity(),
    b = identity(),
    input = { pitch: 0.71, yaw: -0.22, roll: 0.5 };
  for (let i = 0; i < 30; i++) C.integrate(a, input, 156, 1 / 30);
  for (let i = 0; i < 144; i++) C.integrate(b, input, 156, 1 / 144);
  for (const key of ['x', 'y', 'z', 'w']) near(a[key], b[key]);
});
test('quaternions remain normalized during extended arbitrary flight', () => {
  const q = identity();
  for (let i = 0; i < 40000; i++)
    C.integrate(q, { pitch: Math.sin(i), yaw: Math.cos(i * 0.3), roll: Math.sin(i * 0.7) }, 170, 1 / 120);
  near(Math.hypot(q.x, q.y, q.z, q.w), 1);
  assert.ok(Object.values(q).every(Number.isFinite));
});
test('speed sweet spot is an actual window and maximum speed widens turns', () => {
  near(C.authority(125), C.authority(140));
  near(C.authority(140), C.authority(155));
  assert.ok(C.authority(80) < C.authority(140));
  assert.ok(C.authority(300) < C.authority(140));
  assert.ok(300 / C.authority(300) > (140 / C.authority(140)) * 3);
  assert.ok(
    75 / C.authority(75) > 140 / C.authority(140),
    'slower than the corner-speed window must also widen the turn'
  );
});
test('airspeed approaches its target without overshoot', () => {
  near(C.speedStep(140, 141, 1), 141);
  near(C.speedStep(140, 75, 0.1), 134.8);
  near(C.speedStep(140, 300, 0.1), 143.6);
});
test('health cannot reduce flight authority or airspeed', () => {
  const a = identity(),
    b = identity();
  C.integrate(a, { pitch: 1, roll: 0.4, hp: 100 }, 140, 0.2);
  C.integrate(b, { pitch: 1, roll: 0.4, hp: 1 }, 140, 0.2);
  assert.deepEqual(a, b);
  const playerFunction = game.slice(
    game.indexOf('function updatePlayer('),
    game.indexOf('function obstacleHeight(')
  );
  assert.match(
    playerFunction,
    /player\.speed=C\.flightStep\(player\.q,player\.v,player\.angular,input,player\.throttle,dt\)/
  );
  assert.doesNotMatch(playerFunction, /speed\s*[*\/]?=.*hp|integrate\([^;]*hp/);
});
test('fast swept shots strike the fuselage instead of tunnelling', () => {
  const t = localRay({ x: 0, y: 0, z: -40 }, { x: 0, y: 0, z: 40 });
  assert.ok(t > 0 && t < 0.5);
});
test('wing hitboxes are thin boxes, not oversized damage spheres', () => {
  assert.notEqual(localRay({ x: 5, y: 0.18, z: -8 }, { x: 5, y: 0.18, z: 8 }), null);
  assert.equal(localRay({ x: 5, y: 2, z: -8 }, { x: 5, y: 2, z: 8 }), null);
  assert.equal(localRay({ x: 6, y: -2, z: -6 }, { x: 6, y: 2, z: -6 }), null);
});
test('vertical tail can be hit independently of fuselage', () => {
  assert.notEqual(localRay({ x: -5, y: 3, z: 4 }, { x: 5, y: 3, z: 4 }), null);
});
test('compound hitboxes rotate and translate with the aircraft', () => {
  const q = { x: 0, y: Math.sin(0.7), z: 0, w: Math.cos(0.7) },
    p = { x: 570, y: 430, z: -300 };
  const transform = (v) => {
    const r = C.rotate(v, q);
    return { x: r.x + p.x, y: r.y + p.y, z: r.z + p.z };
  };
  const a = { x: 0, y: 0, z: -40 },
    b = { x: 0, y: 0, z: 40 };
  near(C.aircraftHit(transform(a), transform(b), { p, q }, { p, q }, boxes), localRay(a, b));
});
test('moving-target sweep catches crossings between simulation ticks', () => {
  const box = [{ c: origin(), q: identity(), h: { x: 1, y: 1, z: 1 } }];
  const a = { p: { x: -10, y: 0, z: 0 }, q: identity() },
    b = { p: { x: 10, y: 0, z: 0 }, q: identity() };
  near(C.aircraftHit(origin(), origin(), a, b, box), 0.45);
});
test('parallel slab rays handle misses, boundaries and zero-length hits', () => {
  const lo = { x: -1, y: -1, z: -1 },
    hi = { x: 1, y: 1, z: 1 };
  assert.equal(C.segmentBox({ x: 2, y: 0, z: 0 }, { x: 2, y: 5, z: 0 }, lo, hi), null);
  near(C.segmentBox(origin(), origin(), lo, hi), 0);
  near(C.segmentBox({ x: -5, y: 1, z: 0 }, { x: 5, y: 1, z: 0 }, lo, hi), 0.4);
});
test('vector intercept predicts the moving target', () => {
  const r = { x: 0, y: 0, z: -600 },
    v = { x: 100, y: 0, z: 0 },
    time = C.interceptTime(r, v, 1800);
  near(Math.hypot(v.x * time, 600), 1800 * time);
  assert.ok(time > 600 / 1800);
  assert.equal(C.interceptTime({ x: 10, y: 0, z: 0 }, { x: 2000, y: 0, z: 0 }, 1800), null);
});
test('every missile launch starts a one-second reload and cannot fire before it completes', () => {
  const launcher = C.makeLauncher();
  assert.equal(C.launchReady(launcher), true);
  near(launcher.reload, 1);
  for (let i = 0; i < 119; i++) {
    assert.equal(C.launchReady(launcher), false);
    C.updateLauncher(launcher, 1 / 120);
  }
  assert.equal(C.launchReady(launcher), false);
  C.updateLauncher(launcher, 1 / 120);
  assert.equal(C.launchReady(launcher), true);
  near(launcher.reload, 1);
});
test('missile reload does not overshoot, accumulate credits or depend on health', () => {
  const launcher = C.makeLauncher();
  C.launchReady(launcher);
  C.updateLauncher(launcher, 100);
  near(launcher.reload, 0);
  C.launchReady(launcher);
  C.updateLauncher(launcher, -1);
  near(launcher.reload, 1);
  launcher.hp = 1;
  C.updateLauncher(launcher, 1);
  assert.equal(C.launchReady(launcher), true);
});
test('terrain keeps the airfield flat and ocean below it', () => {
  near(C.terrain(-650, 0), 26);
  near(C.terrain(450, 1200), 26);
  assert.ok(C.terrain(-5000, 0) > 100);
  assert.ok(C.terrain(19000, 0) < 0);
});
test('seeded world generation is deterministic', () => {
  const a = C.random(520),
    b = C.random(520);
  for (let i = 0; i < 200; i++) near(a(), b());
});

test('laptop, arrows and physical numeric keypad control the same axes', () => {
  const read = (...codes) => C.readControls((code) => codes.includes(code));
  for (const code of ['KeyW', 'ArrowUp', 'Numpad8']) assert.equal(read(code).pitch, 1);
  for (const code of ['KeyS', 'ArrowDown', 'Numpad2']) assert.equal(read(code).pitch, -1);
  for (const code of ['KeyA', 'ArrowLeft', 'Numpad4']) assert.equal(read(code).roll, -1);
  for (const code of ['KeyD', 'ArrowRight', 'Numpad6']) assert.equal(read(code).roll, 1);
  for (const code of ['KeyQ', 'Numpad7']) assert.equal(read(code).yaw, -1);
  for (const code of ['KeyE', 'Numpad9']) assert.equal(read(code).yaw, 1);
  for (const code of ['ShiftLeft', 'ShiftRight', 'Equal', 'NumpadAdd']) assert.equal(read(code).throttle, 1);
  for (const code of ['KeyZ', 'Minus', 'NumpadSubtract']) assert.equal(read(code).throttle, -1);
  assert.equal('cannon' in read(), false);
  for (const code of ['Space', 'Numpad0', 'KeyX', 'Enter', 'NumpadEnter', 'NumpadDecimal'])
    assert.equal(read(code).missile, true);
  assert.equal(read('KeyW', 'KeyS').pitch, 0);
  assert.equal(read('KeyW', 'ArrowUp').pitch, 1);
});
test('releasing one alias does not cancel a second held key, and releasing all stops rotation', () => {
  const held = new Set(['KeyW', 'ArrowUp']),
    q = identity();
  held.delete('KeyW');
  assert.equal(C.readControls((code) => held.has(code)).pitch, 1);
  held.clear();
  const input = C.readControls((code) => held.has(code));
  C.integrate(q, input, 140, 0.5);
  assert.deepEqual(q, identity());
});
test('touch and keyboard axes combine without exceeding full authority', () => {
  const input = C.readControls((code) => code === 'KeyD', {
    pitch: 0.7,
    roll: 0.8
  });
  near(input.pitch, 0.7);
  near(input.roll, 1);
});
test('scope requires visible, in-range, unobstructed target inside its drawn circle', () => {
  const aim = { x: 300, y: 200, visible: true },
    target = { x: 340, y: 200, visible: true };
  assert.equal(C.inScope(target, aim, 100, 480, true), true);
  assert.equal(C.inScope({ ...target, x: 401 }, aim, 100, 480, true), false);
  assert.equal(C.inScope({ ...target, visible: false }, aim, 100, 480, true), false);
  assert.equal(C.inScope(target, aim, 100, 2401, true), false);
  assert.equal(C.inScope(target, aim, 100, 480, false), false);
  assert.equal(C.inScope(target, { ...aim, visible: false }, 100, 480, true), false);
});
test('lock needs continuous dwell, immediately breaks on loss and never carries to a new target', () => {
  const lock = {},
    first = {},
    second = {};
  C.lockStep(lock, first, true, 0.3);
  assert.equal(lock.locked, false);
  near(lock.progress, 0.3 / 0.65);
  C.lockStep(lock, first, true, 0.36);
  assert.equal(lock.locked, true);
  C.lockStep(lock, second, true, 0.1);
  assert.equal(lock.locked, false);
  assert.equal(lock.target, second);
  near(lock.progress, 0.1 / 0.65);
  C.lockStep(lock, second, false, 1);
  assert.equal(lock.target, null);
  assert.equal(lock.progress, 0);
  C.lockStep(lock, second, true, 0);
  assert.equal(lock.locked, false);
  C.lockStep(lock, null, false, 0);
  assert.equal(lock.locked, false);
});
test('lock dwell is independent of render frame rate', () => {
  for (const rate of [30, 60, 144]) {
    const lock = {},
      target = {};
    for (let i = 0; i < rate; i++) C.lockStep(lock, target, true, 1 / rate);
    assert.equal(lock.locked, true);
    near(lock.progress, 1);
  }
});
test('homing missile turns toward a moving opponent without changing its speed', () => {
  const v = { x: 0, y: 0, z: -1100 },
    relative = { x: 300, y: 100, z: -650 },
    tv = { x: 120, y: 0, z: 0 };
  const next = C.guidedVelocity(v, relative, tv, 1 / 120);
  assert.ok(next.x > 0 && next.y > 0);
  near(Math.hypot(next.x, next.y, next.z), 1100);
  const angle = Math.acos(-next.z / 1100);
  assert.ok(angle <= 4 / 120 + 1e-9);
  assert.deepEqual(JSON.parse(JSON.stringify(C.guidedVelocity(v, relative, tv, 0))), v);
});
test('guidance is finite for coincident, opposite and zero velocity inputs', () => {
  for (const v of [origin(), { x: 0, y: 0, z: -960 }, { x: 0, y: 960, z: 0 }])
    for (const r of [origin(), { x: 0, y: 0, z: 900 }, { x: 0, y: -900, z: 0 }]) {
      const n = C.guidedVelocity(v, r, origin(), 0.01);
      assert.ok(Object.values(n).every(Number.isFinite));
      near(Math.hypot(n.x, n.y, n.z), Math.hypot(v.x, v.y, v.z));
    }
});
test('guided projectile intercepts a crossing moving aircraft using actual swept hitboxes', () => {
  let p = { x: 0, y: 0, z: 0 },
    v = { x: 0, y: 0, z: -1100 },
    target = { x: 130, y: 0, z: -800 },
    hit = false;
  const targetVelocity = { x: 125, y: 0, z: 0 },
    dt = 1 / 120;
  for (let i = 0; i < 240; i++) {
    const previous = { ...target },
      last = { ...p };
    v = C.guidedVelocity(v, { x: target.x - p.x, y: target.y - p.y, z: target.z - p.z }, targetVelocity, dt);
    for (const axis of ['x', 'y', 'z']) {
      p[axis] += v[axis] * dt;
      target[axis] += targetVelocity[axis] * dt;
    }
    if (
      C.aircraftHit(last, p, { p: previous, q: identity() }, { p: target, q: identity() }, boxes, 0.16) !==
      null
    ) {
      hit = true;
      break;
    }
  }
  assert.equal(hit, true, 'guided missile must hit a target that a straight launch would miss');
});

test('mouse look changes camera angles without ever writing the aircraft quaternion', () => {
  const q = identity(),
    look = { yaw: 0, pitch: 0 };
  C.moveLook(look, 120, -40);
  near(look.yaw, -0.3);
  near(look.pitch, 0.1);
  assert.deepEqual(q, identity());
  const normal = { yaw: 0, pitch: 0 },
    inverted = { yaw: 0, pitch: 0 };
  C.moveLook(normal, 20, 30, 1, false);
  C.moveLook(inverted, 20, 30, 1, true);
  near(normal.yaw, inverted.yaw);
  near(normal.pitch, -inverted.pitch);
  const sensitive = { yaw: 0, pitch: 0 };
  C.moveLook(sensitive, 20, 30, 2);
  near(sensitive.pitch, normal.pitch * 2);
});
test('camera yaw wraps continuously and pitch is constrained at extreme mouse input', () => {
  const look = { yaw: 0, pitch: 0 };
  for (let i = 0; i < 1000; i++) C.moveLook(look, 1000, -1000, 2);
  assert.ok(look.yaw >= -Math.PI && look.yaw <= Math.PI);
  near(look.pitch, 1.28);
  C.moveLook(look, 0, 100000);
  near(look.pitch, -1.28);
});
test('multi-contact selection is stable and only changes when a held target becomes ineligible', () => {
  const a = {},
    b = {},
    c = {};
  const choices = [
    { target: a, score: 20, eligible: true },
    { target: b, score: 2, eligible: true },
    { target: c, score: 0, eligible: false }
  ];
  assert.equal(C.chooseTarget(choices), b);
  assert.equal(C.chooseTarget(choices, a), a);
  choices[0].eligible = false;
  assert.equal(C.chooseTarget(choices, a), b);
  choices[1].eligible = false;
  assert.equal(C.chooseTarget(choices, a), null);
});
test('fly-through scoring requires a swept passage with wing clearance and cannot repeat on the same side', () => {
  const gate = { z: 0, minX: -150, maxX: 150, minY: 30, maxY: 330 };
  assert.equal(C.crossedGate({ x: 0, y: 200, z: 15 }, { x: 0, y: 200, z: -15 }, gate), true);
  assert.equal(C.crossedGate({ x: 0, y: 200, z: 15 }, { x: 0, y: 200, z: 5 }, gate), false);
  assert.equal(C.crossedGate({ x: 145, y: 200, z: 15 }, { x: 145, y: 200, z: -15 }, gate), false);
  assert.equal(C.crossedGate({ x: 0, y: 340, z: 15 }, { x: 0, y: 340, z: -15 }, gate), false);
  assert.equal(C.crossedGate({ x: 0, y: 200, z: 0 }, { x: 0, y: 200, z: 0 }, gate), false);
});
test('built portal colliders preserve the opening and collide with their visible supports', () => {
  const source = game.slice(game.indexOf('function gate('), game.indexOf("gate('01 / VIADUCT'"));
  const solids = [],
    gates = [];
  const sandbox = vm.createContext({
    C: { terrain: () => 26 },
    gates,
    scene: {},
    hazardMaterial: {},
    beaconMaterial: {},
    box: () => {},
    solid: (x, y, z, w, h, d) =>
      solids.push({
        min: { x: x - w / 2, y: y - h / 2, z: z - d / 2 },
        max: { x: x + w / 2, y: y + h / 2, z: z + d / 2 }
      })
  });
  vm.runInContext(source + "\ngate('TEST',0,0,300,330,20,{});", sandbox);
  const trace = (a, b) => solids.some((s) => C.segmentBox(a, b, s.min, s.max, 0.3) !== null);
  assert.equal(trace({ x: 0, y: 200, z: 50 }, { x: 0, y: 200, z: -50 }), false);
  assert.equal(trace({ x: 162, y: 200, z: 50 }, { x: 162, y: 200, z: -50 }), true);
  assert.equal(trace({ x: 0, y: 340, z: 50 }, { x: 0, y: 340, z: -50 }), true);
  assert.equal(gates.length, 1);
});
test('neutral mouse input leaves the view still, and settings do not alter flight bindings', () => {
  const look = { yaw: 0.42, pitch: -0.27 };
  C.moveLook(look, 0, 0, 0.3);
  near(look.yaw, 0.42);
  near(look.pitch, -0.27);
  const input = C.readControls((code) => code === 'KeyW');
  assert.equal(input.pitch, 1);
});
