import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../public/vendor/three.module.js';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const core = html.match(/<script id="flight-core">([\s\S]*?)<\/script>/)[1];
const game = html.match(/<script type="module" id="game-code">([\s\S]*?)<\/script>/)[1];
const context = vm.createContext({});
vm.runInContext(core + ';globalThis.C = FlightCore;', context);
const C = context.C;
const near = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test('compact reticle stays between 48 and 80 pixels wide across display sizes', () => {
  near(C.reticleRadius(1280, 720), 36);
  near(C.reticleRadius(1920, 1080), 40);
  near(C.reticleRadius(390, 844), 24);
  near(C.reticleRadius(0, 0), 24);
  assert.match(game, /const scopeRadius = \(\) => C.reticleRadius\(width, height\)/);
  assert.match(game, /scopeRadius\(\),\s*e\.p\.distanceTo/);
  assert.match(game, /r = scopeRadius\(\)/);
});

test('classic lock acquisition requires the enemy to be inside the visible ring', () => {
  const center = { x: 640, y: 360, visible: true },
    r = C.reticleRadius(1280, 720);
  assert.equal(C.inScope({ x: 675, y: 360, visible: true }, center, r, 800, true), true);
  assert.equal(C.inScope({ x: 678, y: 360, visible: true }, center, r, 800, true), false);
});

test('cinematic flight ramps into rolls, caps the rate and settles promptly on release', () => {
  const q = new THREE.Quaternion(),
    v = new THREE.Vector3(0, 0, -140);
  const angular = { pitch: 0, roll: 0, yaw: 0 },
    dt = 1 / 120,
    throttle = (140 - 75) / 225;
  let maxRate = 0;
  for (let i = 0; i < 120; i++) {
    const before = q.clone();
    C.flightStep(q, v, angular, { roll: 1 }, throttle, dt);
    maxRate = Math.max(maxRate, before.angleTo(q) / dt);
    if (i === 11) assert.ok(angular.roll > 0.4 && angular.roll < 0.5);
  }
  assert.ok(maxRate > 1.4 && maxRate < 1.49, 'maximum bank rate is about 85 degrees per second');
  const released = q.clone();
  for (let i = 0; i < 72; i++) C.flightStep(q, v, angular, {}, throttle, dt);
  assert.ok(angular.roll < 0.002);
  assert.ok(released.angleTo(q) < 0.14, 'release must not carry the pilot into a long unintended roll');
});

function cameraHarness() {
  const player = {
    p: new THREE.Vector3(0, 1000, 0),
    speed: 140,
    mesh: { position: new THREE.Vector3(0, 1000, 0), quaternion: new THREE.Quaternion() }
  };
  const camera = new THREE.PerspectiveCamera(56, 16 / 9, 2, 45000);
  const rig = {
    distance: 34,
    height: 8.5,
    attitude: new THREE.Quaternion(),
    offset: new THREE.Vector3(),
    shake: 0
  };
  const ctx = vm.createContext({
    THREE,
    C,
    clamp: C.clamp,
    player,
    camera,
    chaseRig: rig,
    UP: new THREE.Vector3(0, 1, 0),
    look: { yaw: 0, pitch: 0 },
    smoothLook: { yaw: 0, pitch: 0 },
    cameraMatrix: new THREE.Matrix4(),
    cameraRotation: new THREE.Quaternion(),
    state: { view: 0, shake: 0 },
    reduced: false,
    shakeEnabled: true,
    clock: 0,
    worldHit: () => null
  });
  const begin = game.indexOf('function viewDirection()');
  vm.runInContext(
    game.slice(begin, game.indexOf('function menuScene()', begin)) + ';globalThis.update = updateCamera;',
    ctx
  );
  ctx.update(0, true);
  return { ctx, rig, player, camera };
}

test('chase camera shows the aircraft banking before its horizon catches up', () => {
  const h = cameraHarness();
  h.player.mesh.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 3);
  h.ctx.update(1 / 60);
  const lag = h.rig.attitude.angleTo(h.player.mesh.quaternion);
  assert.ok(lag > 0.8 && lag < Math.PI / 3);
  for (let i = 0; i < 180; i++) h.ctx.update(1 / 60);
  assert.ok(h.rig.attitude.angleTo(h.player.mesh.quaternion) < 0.001);
});

test('camera boom stays attached during fast translation and is continuous through loops', () => {
  const h = cameraHarness();
  let previous = h.camera.quaternion.clone();
  for (let i = 0; i < 1440; i++) {
    h.player.mesh.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), (i * Math.PI) / 360);
    h.player.p.z -= 5;
    h.player.mesh.position.copy(h.player.p);
    h.player.speed = 300;
    h.ctx.update(1 / 60);
    assert.ok(h.camera.position.distanceTo(h.player.mesh.position) < 47);
    assert.ok(previous.angleTo(h.camera.quaternion) < 0.08, 'no pole flips or sudden horizon jumps');
    assert.ok(h.camera.position.toArray().every(Number.isFinite));
    near(h.camera.quaternion.length(), 1);
    previous.copy(h.camera.quaternion);
  }
});

test('camera reset discards the previous aircraft attitude, boom and shake', () => {
  const h = cameraHarness();
  h.rig.attitude.setFromAxisAngle(new THREE.Vector3(0, 0, 1), 2);
  h.rig.offset.set(100, 100, 100);
  h.rig.shake = 1;
  h.ctx.update(0, true);
  near(h.rig.attitude.angleTo(h.player.mesh.quaternion), 0);
  near(h.camera.position.x, 0);
  near(h.camera.position.y, 1008.5);
  near(h.camera.position.z, 34);
  near(h.rig.shake, 0);
});

test('camera collision is resolved after smoothing, rather than before it', () => {
  const h = cameraHarness();
  h.ctx.worldHit = () => 0.4;
  h.ctx.update(1 / 60);
  assert.ok(h.camera.position.distanceTo(h.player.p) < 13);
});

test('pilot camera stays close to the airframe, hides its mesh, and restores chase view', () => {
  const h = cameraHarness();
  h.ctx.state.pilotView = true;
  h.ctx.update(0, true);
  assert.equal(h.player.mesh.visible, false);
  assert.ok(h.camera.position.distanceTo(h.player.p) < 4);
  assert.ok(h.camera.position.z < h.player.p.z);
  h.ctx.state.pilotView = false;
  h.ctx.update(0, true);
  assert.equal(h.player.mesh.visible, true);
  assert.ok(h.camera.position.distanceTo(h.player.p) > 30);
});
