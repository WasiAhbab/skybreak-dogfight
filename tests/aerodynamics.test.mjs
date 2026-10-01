import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../public/vendor/three.module.js';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const source = html.match(/<script id="flight-core">([\s\S]*?)<\/script>/)[1];
const context = vm.createContext({});
vm.runInContext(source + ';this.C = FlightCore;', context);
const C = context.C,
  trim = (140 - 75) / 225;
const neutral = { pitch: 0, roll: 0, yaw: 0, throttle: 0, missile: false };
function aircraft(pitch = 0, bank = 0) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, 0, bank));
  return { q, v: new THREE.Vector3(0, 0, -140).applyQuaternion(q), angular: { pitch: 0, roll: 0, yaw: 0 } };
}
function simulate(body, seconds, input = {}, throttle = trim, dt = 1 / 120) {
  for (let i = 0; i < Math.round(seconds / dt); i++)
    C.flightStep(
      body.q,
      body.v,
      body.angular,
      typeof input === 'function' ? input(body) : input,
      throttle,
      dt
    );
  return body;
}
test('climbing spends energy, descending restores it, and cruise remains trimmed', () => {
  const level = simulate(aircraft(), 5),
    climb = simulate(aircraft(0.35), 5),
    dive = simulate(aircraft(-0.35), 5);
  assert.ok(Math.abs(level.v.length() - 140) < 0.01);
  assert.ok(climb.v.length() < 130 && climb.v.y > 35);
  assert.ok(dive.v.length() > 150 && dive.v.y < -40);
});
test('bank-generated lift turns the flight path and coordinated heading without a rudder command', () => {
  const b = simulate(aircraft(0, -0.6), 5);
  assert.ok(b.v.x > 20);
  assert.ok(new THREE.Vector3(0, 0, -1).applyQuaternion(b.q).x > 0.15);
  assert.ok(Math.abs(b.angular.slip) < 2, 'banking must not become sideways skating');
  assert.ok(b.v.length() > 130, 'normal bank must not delete forward momentum');
});
test('engine spool is gradual, finite and retained between throttle changes', () => {
  const b = simulate(aircraft(), 0.1);
  simulate(b, 0.1, {}, 1);
  assert.ok(b.angular.spool > trim && b.angular.spool < 0.5);
  const high = b.angular.spool;
  simulate(b, 0.1, {}, 0);
  assert.ok(b.angular.spool < high && b.angular.spool > 0);
});
test('airbrake adds drag at unchanged throttle and retracts after release', () => {
  const clean = simulate(aircraft(), 5),
    brake = simulate(aircraft(), 5, { brake: true });
  assert.ok(clean.v.length() - brake.v.length() > 35);
  assert.ok(brake.angular.brake > 0.99);
  simulate(brake, 1);
  assert.ok(brake.angular.brake < 0.002);
});
test('number-pad throttle does not accidentally deploy the brake, while laptop Z does', () => {
  const keys = (code) => C.readControls((key) => key === code);
  assert.equal(keys('NumpadSubtract').brake, false);
  assert.equal(keys('Minus').brake, false);
  assert.equal(keys('KeyZ').brake, true);
  assert.equal(keys('KeyZ').throttle, -1);
});
test('full pitch respects the signed load envelope and stays finite through repeated loops', () => {
  const b = aircraft();
  for (let i = 0; i < 12000; i++) {
    C.flightStep(b.q, b.v, b.angular, { pitch: Math.sin(i / 500) > 0 ? 1 : -1 }, 1, 1 / 120);
    assert.ok(b.angular.g >= -3.00001 && b.angular.g <= 9.00001);
    assert.ok(Number.isFinite(b.angular.aoa));
    assert.ok(Math.abs(b.q.length() - 1) < 1e-7);
  }
});
test('aerodynamic integration converges across 60 and 120 Hz simulation steps', () => {
  const input = { pitch: 0.3, roll: 0.2, yaw: 0.1 };
  const a = simulate(aircraft(), 5, input, trim, 1 / 60),
    b = simulate(aircraft(), 5, input);
  assert.ok(a.v.distanceTo(b.v) < 0.5);
  assert.ok(a.q.angleTo(b.q) < 0.005);
});
test('wings-level recovery works from a climbing bank without changing fire commands', () => {
  const b = aircraft(0.4, -0.9);
  simulate(b, 9, (body) => C.recoveryInput(body.q, { ...neutral, missile: true, brake: true }), 0.5);
  const f = new THREE.Vector3(0, 0, -1).applyQuaternion(b.q),
    right = new THREE.Vector3(1, 0, 0).applyQuaternion(b.q);
  assert.ok(Math.abs(f.y) < 0.01 && Math.abs(right.y) < 0.01);
  const recovered = C.recoveryInput(b.q, { ...neutral, missile: true, brake: true });
  assert.equal(recovered.missile, true);
  assert.equal(recovered.brake, false);
});
test('flight instruments use velocity, ground clearance, load and actual engine state', () => {
  const b = simulate(aircraft(0.35), 2);
  const panel = C.flightInstruments(b.q, b.v, b.angular, 2600, 1200);
  assert.equal(panel.agl, 1400);
  assert.equal(panel.verticalSpeed, b.v.y);
  assert.equal(panel.g, b.angular.g);
  assert.ok(panel.mach > 0.3 && panel.mach < 0.5);
  assert.equal(C.flightInstruments(b.q, b.v, b.angular, 200, 300).agl, 0);
});
test('terrain prediction warns ahead along velocity, not simply when altitude is low', () => {
  assert.equal(
    C.terrainAlert({ x: 0, y: 300, z: 0 }, { x: 0, y: 0, z: -140 }, () => 0),
    ''
  );
  assert.equal(
    C.terrainAlert({ x: 0, y: 300, z: 0 }, { x: 0, y: -100, z: -140 }, () => 0),
    'TERRAIN AHEAD'
  );
  assert.equal(
    C.terrainAlert({ x: 0, y: 100, z: 0 }, { x: 0, y: -100, z: -140 }, () => 0),
    'PULL UP'
  );
  assert.equal(
    C.terrainAlert({ x: 0, y: 120, z: 0 }, { x: 0, y: 100, z: -140 }, () => 0),
    ''
  );
  assert.equal(
    C.terrainAlert({ x: 0, y: 300, z: 0 }, { x: 140, y: 0, z: 0 }, (x) => (x > 300 ? 290 : 0)),
    'TERRAIN AHEAD'
  );
  assert.equal(
    C.terrainAlert({ x: 0, y: 300, z: 0 }, { x: 140, y: 0, z: 0 }, (x) => (x > 200 ? 290 : 0)),
    'PULL UP'
  );
});

test('actual AI update obeys the shared physics and survives an extended clear-air maneuver', () => {
  const game = html.match(/<script type="module" id="game-code">([\s\S]*?)<\/script>/)[1];
  const b = aircraft(),
    e = Object.assign(b, {
      p: new THREE.Vector3(0, 2600, -520),
      previous: { p: new THREE.Vector3(0, 2600, -520) },
      alive: true,
      age: 0,
      slot: 0,
      evade: 0,
      evadeCooldown: 1,
      decision: 0.1,
      flareCooldown: 0,
      launcher: C.makeLauncher(),
      lock: {},
      phase: 0,
      breakSide: 1,
      speed: 140,
      nextAttack: 1000,
      forward() {
        return new THREE.Vector3(0, 0, -1).applyQuaternion(this.q);
      }
    });
  let steps = 0;
  const ctx = vm.createContext({
    THREE,
    C: {
      ...C,
      flightStep(...args) {
        steps++;
        return C.flightStep(...args);
      }
    },
    clamp: C.clamp,
    RIGHT: new THREE.Vector3(1, 0, 0),
    state: { difficulty: 'practice', time: 0, arena: 'alpine' },
    shots: [],
    enemies: [e],
    player: { p: new THREE.Vector3(0, 2600, 0), v: new THREE.Vector3(0, 0, -140), invulnerable: 0 },
    terrainHeight: () => 0,
    worldHit: () => null,
    activeGates: () => [],
    random: () => 0.5,
    spawnEnemy() {
      assert.fail('unexpected respawn');
    },
    damage() {
      assert.fail('unexpected terrain damage');
    }
  });
  const start = game.indexOf('function updateEnemy(');
  vm.runInContext(
    game.slice(start, game.indexOf('const cameraMatrix', start)) + ';this.update = updateEnemy;',
    ctx
  );
  for (let i = 0; i < 3600; i++) {
    ctx.state.time += 1 / 120;
    e.previous.p.copy(e.p);
    ctx.update(e, 1 / 120);
    assert.ok(e.p.toArray().every(Number.isFinite));
    assert.ok(e.speed > 80 && e.speed < 200);
  }
  assert.equal(steps, 3600);
  assert.ok(Math.abs(e.p.y - 2600) < 600);
});
