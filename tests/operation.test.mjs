import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../public/vendor/three.module.js';
import { compactJS } from './source.mjs';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const core = html.match(/<script id="flight-core">([\s\S]*?)<\/script>/)[1];
const game = compactJS(html.match(/<script type="module" id="game-code">([\s\S]*?)<\/script>/)[1]);
const extract = (a, b) => game.slice(game.indexOf(a), game.indexOf(b, game.indexOf(a)));
const context = vm.createContext({});
vm.runInContext(core + ';globalThis.C=FlightCore;', context);
const C = context.C,
  near = (a, b, e = 1e-7) => assert.ok(Math.abs(a - b) < e, a + ' != ' + b);
const body = () => ({
  q: { x: 0, y: 0, z: 0, w: 1 },
  v: { x: 0, y: 0, z: -140 },
  angular: { pitch: 0, roll: 0, yaw: 0 }
});
function fly(b, input, throttle = (140 - 75) / 225, dt = 1 / 120) {
  return C.flightStep(b.q, b.v, b.angular, input, throttle, dt);
}

test('new flight model has bounded angular response, release damping and directional momentum', () => {
  const b = body();
  fly(b, { pitch: 1 });
  assert.ok(b.angular.pitch > 0 && b.angular.pitch < 1);
  const before = b.angular.pitch;
  fly(b, {});
  assert.ok(b.angular.pitch > 0 && b.angular.pitch < before);
  b.q = { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 };
  b.angular = { pitch: 0, roll: 0, yaw: 0 };
  fly(b, {});
  assert.ok(b.v.x < 0 && b.v.x > -20);
  assert.ok(b.v.z < -110, 'velocity must not snap to the new nose direction');
});
test('cruise trim balances gravity, low energy loses lift, and thrust changes speed gradually', () => {
  const level = body();
  for (let i = 0; i < 1200; i++) fly(level, {});
  near(level.v.y, 0);
  near(Math.hypot(...Object.values(level.v)), 140, 0.1);
  const slow = body();
  slow.v.z = -60;
  fly(slow, {}, 0);
  assert.ok(slow.v.y < 0);
  const powered = body(),
    braking = body();
  const fast = fly(powered, {}, 1),
    low = fly(braking, {}, 0);
  assert.ok(fast > 140 && fast < 141);
  assert.ok(low < 140 && low > 139);
});
test('flight remains finite through sustained maneuvers at low and high energy', () => {
  const b = body();
  for (let i = 0; i < 12000; i++) {
    const speed = fly(
      b,
      { pitch: Math.sin(i * 0.003), roll: Math.cos(i * 0.001), yaw: Math.sin(i * 0.007) },
      (Math.sin(i * 0.0009) + 1) / 2
    );
    assert.ok(speed >= 0 && speed <= 360);
    near(Math.hypot(...Object.values(b.q)), 1);
    assert.ok(Object.values(b.v).every(Number.isFinite));
  }
});
test('airspeed and response are identical at one-percent and full health', () => {
  const healthy = body(),
    damaged = body();
  damaged.hp = 1;
  for (let i = 0; i < 600; i++) {
    fly(healthy, { pitch: 0.25, roll: 0.1 });
    fly(damaged, { pitch: 0.25, roll: 0.1 });
  }
  assert.deepEqual(healthy.v, damaged.v);
  assert.deepEqual(healthy.q, damaged.q);
});
test('Ctrl and Z both activate the airbrake while Shift increases throttle', () => {
  for (const code of ['ControlLeft', 'ControlRight', 'KeyZ'])
    assert.equal(C.readControls((key) => key === code).throttle, -1);
  assert.equal(C.readControls((key) => key === 'ShiftLeft').throttle, 1);
});
test('proximity fuse catches fast moving crossings but rejects near misses', () => {
  near(
    C.proximityHit(
      { x: -50, y: 0, z: 0 },
      { x: 50, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      5
    ),
    0.45
  );
  assert.equal(
    C.proximityHit(
      { x: -50, y: 5.1, z: 0 },
      { x: 50, y: 5.1, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      5
    ),
    null
  );
  near(
    C.proximityHit(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: -20, y: 0, z: 0 },
      { x: 20, y: 0, z: 0 },
      5
    ),
    0.375
  );
});
test('check-six warning distinguishes behind, forward and out-of-range contacts', () => {
  const p = { x: 0, y: 0, z: 0 },
    f = { x: 0, y: 0, z: -1 };
  assert.equal(C.behindThreat(p, f, { x: 0, y: 0, z: 800 }), true);
  assert.equal(C.behindThreat(p, f, { x: 0, y: 0, z: -800 }), false);
  assert.equal(C.behindThreat(p, f, { x: 0, y: 0, z: 1800 }), false);
});
test('operation ends at eight kills, three deaths or four minutes without early completion', () => {
  assert.equal(C.matchOutcome(7, 2, 239.9), null);
  assert.equal(C.matchOutcome(8, 2, 240), 'victory');
  assert.equal(C.matchOutcome(2, 3, 50), 'defeat');
  assert.equal(C.matchOutcome(2, 1, 240), 'timeout');
});

function phaseHarness() {
  const state = {
    mode: 'playing',
    kills: 3,
    deaths: 0,
    lives: 3,
    goal: 8,
    time: 35,
    duration: 240,
    missionMode: 'operation',
    enemyCount: 5,
    arena: 'alpine',
    countdown: 0
  };
  const nodes = new Map(),
    events = [],
    player = { p: new THREE.Vector3(), mesh: { visible: true }, snapshot() {}, sync() {} };
  const $ = (id) => {
    if (!nodes.has(id))
      nodes.set(id, {
        hidden: true,
        textContent: '',
        focus() {},
        querySelector() {
          return { scrollTop: 0 };
        }
      });
    return nodes.get(id);
  };
  const ctx = vm.createContext({
    state,
    player,
    C,
    $,
    seeker: {},
    worldCanvas: { focus() {} },
    performance: { now: () => 100 },
    accumulator: 0,
    last: 0,
    pausedFrom: 'playing',
    clearInput() {},
    clearShots() {
      events.push('clear');
    },
    feed() {},
    notice() {},
    updateTelemetry() {},
    releaseMouse() {},
    captureMouse() {},
    audioStart() {
      events.push('audio-start');
    },
    stopBattleAudio() {
      events.push('audio-stop');
    },
    resetJet(jet) {
      jet.alive = true;
      jet.hp = 100;
    },
    recenter() {},
    spawnEnemy() {
      events.push('enemy');
    },
    updateCamera() {},
    endMatch(reason, outcome = 'defeat') {
      state.mode = 'ended';
      events.push(outcome);
    }
  });
  vm.runInContext(
    extract('function beginPhase(', 'function control(') +
      extract('function pause(', 'function hangar(') +
      ';globalThis.api={beginPhase,loseAirframe,updatePhase,pause,resume};',
    ctx
  );
  return { state, player, events, nodes, api: ctx.api };
}
test('death schedules exactly one redeployment and preserves accumulated kills and time', () => {
  const h = phaseHarness();
  h.api.loseAirframe('impact');
  h.api.loseAirframe('duplicate impact');
  assert.equal(h.state.deaths, 1);
  assert.equal(h.state.mode, 'respawning');
  assert.equal(h.state.kills, 3);
  h.api.updatePhase(3.6);
  assert.equal(h.state.mode, 'playing');
  assert.equal(h.state.kills, 3);
  near(h.state.time, 38.6);
  assert.equal(h.player.hp, 100);
  assert.equal(h.player.invulnerable, 3);
  assert.equal(h.events.filter((e) => e === 'enemy').length, 5);
});
test('third death goes to results; free hunt retains unlimited redeployments', () => {
  const h = phaseHarness();
  h.state.deaths = 2;
  h.api.loseAirframe('impact');
  assert.equal(h.state.mode, 'ended');
  const free = phaseHarness();
  free.state.missionMode = 'freeflight';
  free.state.deaths = 7;
  free.api.loseAirframe('impact');
  assert.equal(free.state.mode, 'respawning');
});
test('pause and resume restore the interrupted spawning phase without spending its timer', () => {
  const h = phaseHarness();
  h.api.beginPhase('spawning', 2.5, 'CHECK', 'Ready');
  h.api.pause();
  assert.equal(h.state.mode, 'paused');
  assert.equal(h.events.filter((event) => event === 'audio-stop').length, 2);
  near(h.state.countdown, 2.5);
  h.api.resume();
  assert.equal(h.events.at(-1), 'audio-start');
  assert.equal(h.state.mode, 'spawning');
  near(h.state.countdown, 2.5);
  h.api.updatePhase(2.5);
  assert.equal(h.state.mode, 'playing');
  near(h.state.time, 35);
});
test('operation clock continues during redeployment and can expire before respawn', () => {
  const h = phaseHarness();
  h.state.time = 239;
  h.api.loseAirframe('impact');
  h.api.updatePhase(1.1);
  assert.equal(h.state.mode, 'ended');
  assert.ok(h.events.includes('timeout'));
});
test('formatted single-file code still contains documented runtime systems', () => {
  assert.match(game, /C\.proximityHit\(/);
  assert.match(game, /const burning=shot\.age<3\.5/);
  assert.match(game, /if\(!burning\)\{shot\.v\.y-=9\.81\*dt/);
  assert.match(html, /target-markers/);
  assert.match(game, /function drawFlightDirector/);
  assert.match(game, /function updateTargetMarkers/);
  assert.match(game, /updatePhase\(dt\)/);
});
