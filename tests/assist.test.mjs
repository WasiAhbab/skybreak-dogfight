import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../public/vendor/three.module.js';
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const core = html.match(/<script id="flight-core">([\s\S]*?)<\/script>/)[1];
const context = vm.createContext({});
vm.runInContext(core + ';globalThis.C=FlightCore;', context);
const C = context.C;
const game = html.match(/<script type="module" id="game-code">([\s\S]*?)<\/script>/)[1];
const manual = { pitch: 0, roll: 0, yaw: 0, throttle: 0, missile: false };
function follow(direction, q = new THREE.Quaternion()) {
  const v = new THREE.Vector3(0, 0, -140),
    angular = { pitch: 0, roll: 0, yaw: 0 };
  const aim = direction.clone().normalize();
  for (let i = 0; i < 1200; i++) {
    C.flightStep(q, v, angular, C.assistedInput(q, aim, manual), (140 - 75) / 225, 1 / 120);
    assert.ok(q.toArray().every(Number.isFinite));
  }
  return { q, forward: new THREE.Vector3(0, 0, -1).applyQuaternion(q) };
}
test('mouse heading assist converges in all four directions without permanent circling', () => {
  for (const vector of [
    [0.5, 0.15, -1],
    [-0.5, 0.15, -1],
    [0.3, -0.2, -1],
    [-0.3, -0.2, -1]
  ]) {
    const aim = new THREE.Vector3(...vector).normalize(),
      result = follow(aim);
    assert.ok(result.forward.angleTo(aim) < 0.005, 'nose must settle onto the requested heading');
  }
});
test('assisted flight returns bank to level when a turn is completed', () => {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -0.5);
  const result = follow(new THREE.Vector3(0, 0, -1), q);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(result.q);
  assert.ok(Math.abs(right.y) < 0.005);
});
test('manual controls override the heading controller and preserve fire/throttle inputs', () => {
  const input = { ...manual, roll: 1, throttle: -1, missile: true };
  assert.deepEqual({ ...C.assistedInput(new THREE.Quaternion(), { x: 1, y: 0, z: 0 }, input) }, input);
});
test('assisted targeting is forgiving but range and line of sight still gate lock', () => {
  const aim = { x: 640, y: 360, visible: true },
    target = { x: 712, y: 360, visible: true };
  assert.equal(C.inScope(target, aim, 36, 500, true), false);
  assert.equal(C.inScope(target, aim, C.assistedScopeRadius(36, false), 500, true), true);
  assert.equal(C.inScope(target, aim, C.assistedScopeRadius(36, true), 2500, true), false);
  assert.equal(C.inScope(target, aim, C.assistedScopeRadius(36, true), 500, false), false);
  assert.ok(C.assistedScopeRadius(36, true) > C.assistedScopeRadius(36, false));
});
test('assisted lock acquires in 350 milliseconds without bypassing a target switch', () => {
  const lock = {},
    first = {},
    second = {};
  C.lockStep(lock, first, true, (0.34 * 0.65) / 0.35);
  assert.equal(lock.locked, false);
  C.lockStep(lock, first, true, (0.02 * 0.65) / 0.35);
  assert.equal(lock.locked, true);
  C.lockStep(lock, second, true, (0.01 * 0.65) / 0.35);
  assert.equal(lock.locked, false);
});
test('rift spawn corridor remains clear below the mountain shoulders', () => {
  for (let z = -1000; z <= 4000; z += 62.5) assert.ok(C.alpineTerrain(-150, z) < 2300);
  assert.match(html, /rock-strata-v1/);
  assert.match(html, /vRockPosition/);
});
function mouseHarness(assist = true) {
  const pilotAim = new THREE.Vector3(0, 0, -1),
    look = { yaw: 0, pitch: 0 };
  const ctx = vm.createContext({
    THREE,
    C,
    clamp: C.clamp,
    pilotAim,
    look,
    lookSettings: { assist, sensitivity: 0.8, invert: false },
    RIGHT: new THREE.Vector3(1, 0, 0),
    UP: new THREE.Vector3(0, 1, 0),
    camera: { quaternion: new THREE.Quaternion() },
    player: { forward: () => new THREE.Vector3(0, 0, -1) }
  });
  const start = game.indexOf('function changeLook(');
  vm.runInContext(
    game.slice(start, game.indexOf("document.addEventListener('mousemove'", start)) +
      ';globalThis.move=changeLook;',
    ctx
  );
  return { ctx, pilotAim, look };
}
test('actual mouse handler moves the assisted heading right and up intuitively', () => {
  const h = mouseHarness();
  h.ctx.move(120, -60);
  assert.ok(h.pilotAim.x > 0);
  assert.ok(h.pilotAim.y > 0);
  assert.deepEqual(h.look, { yaw: 0, pitch: 0 });
});
test('extreme mouse input remains finite and cannot request an instant backwards turn', () => {
  const h = mouseHarness();
  for (let i = 0; i < 100; i++) h.ctx.move(10000, -5000);
  assert.ok(h.pilotAim.toArray().every(Number.isFinite));
  assert.ok(h.pilotAim.angleTo(new THREE.Vector3(0, 0, -1)) <= 0.950001);
  const before = h.pilotAim.clone();
  h.ctx.move(NaN, Infinity);
  assert.deepEqual(h.pilotAim, before);
});
test('classic mode preserves independent mouse-camera aiming', () => {
  const h = mouseHarness(false);
  h.ctx.move(100, -50);
  assert.ok(h.look.yaw < 0);
  assert.ok(h.look.pitch > 0);
  assert.deepEqual(h.pilotAim, new THREE.Vector3(0, 0, -1));
});
