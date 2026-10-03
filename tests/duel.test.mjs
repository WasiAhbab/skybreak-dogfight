import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../public/vendor/three.module.js';
import { compactJS } from './source.mjs';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const core = html.match(/<script id="flight-core">([\s\S]*?)<\/script>/)[1];
const duel = html.match(/<script id="duel-core">([\s\S]*?)<\/script>/)[1];
const game = compactJS(html.match(/<script type="module" id="game-code">([\s\S]*?)<\/script>/)[1]);
const scope = vm.createContext({ THREE });
vm.runInContext(core + duel + ';globalThis.C=FlightCore;globalThis.D=DuelCore;', scope);
const { C, D } = scope;
const extract = (a, b) => {
  const start = game.indexOf(a);
  assert.ok(start >= 0, a);
  const end = game.indexOf(b, start);
  assert.ok(end > start, b);
  return game.slice(start, end);
};
vm.runInContext(
  extract('const boxDefinitions=', 'const plumeGeometry=') + ';globalThis.hitboxes=hitboxes;',
  scope
);
const hitboxes = scope.hitboxes;
const near = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${a} differs from ${b}`);

test('five-round series awards exactly one point per win, none per draw, and rotates once', () => {
  const s = D.create();
  for (const result of ['win', 'loss', 'draw', 'win', 'win']) {
    assert.equal(D.finish(s, result), true);
    assert.equal(D.finish(s, result), false);
    if (s.round < 5) assert.equal(D.next(s), true);
  }
  assert.equal(s.player, 3);
  assert.equal(s.rival, 1);
  assert.equal(s.results.length, 5);
  assert.equal(s.complete, true);
  assert.equal(D.next(s), false);
  assert.equal(D.outcome(s), 'victory');
});
test('timeout is a draw at exactly two minutes, with no scoring by remaining health', () => {
  const s = D.create();
  assert.equal(D.tick(s, 119.99, true, true), null);
  assert.equal(D.tick(s, 0.01, true, true), 'draw');
  near(s.elapsed, 120);
  assert.equal(s.player + s.rival, 0);
  assert.equal(D.tick(s, 10, false, true), null);
});
test('mutual destruction is a draw; a terrain loss awards the surviving pilot', () => {
  const simultaneous = D.create();
  assert.equal(D.tick(simultaneous, 0.01, false, false), 'draw');
  const crash = D.create();
  assert.equal(D.tick(crash, 0.01, false, true), 'loss');
  assert.equal(crash.rival, 1);
  const rivalCrash = D.create();
  assert.equal(D.tick(rivalCrash, 0.01, true, false), 'win');
  assert.equal(rivalCrash.player, 1);
});
test('repeated draw series has a finite end and tied scores produce a drawn match', () => {
  const s = D.create();
  for (let i = 0; i < 5; i++) {
    D.tick(s, 120, true, true);
    D.next(s);
  }
  assert.equal(s.complete, true);
  assert.equal(D.outcome(s), 'draw');
  assert.equal(s.results.length, 5);
});
test('new rounds reset elapsed time but preserve scores and history', () => {
  const s = D.create();
  D.tick(s, 7, true, false);
  D.next(s);
  assert.equal(s.elapsed, 0);
  assert.equal(s.player, 1);
  assert.equal(s.round, 2);
  assert.equal(D.next(s), false);
  assert.equal(s.round, 2);
});
test('identical cannon loadout delivers a lethal four-hit burst within half a second', () => {
  assert.equal(D.CANNON.range, 500);
  assert.equal(D.CANNON.speed, 1300);
  const gun = D.makeGun();
  let health = 100,
    t = 0,
    shots = 0;
  while (health > 0 && t < 1) {
    if (D.fire(gun)) {
      health -= D.CANNON.damage;
      shots++;
    }
    D.cool(gun, 1 / 120);
    t += 1 / 120;
  }
  assert.equal(shots, 4);
  assert.ok(t <= 0.5);
  assert.equal(health, 0);
});
test('new terrain collision is exactly the rendered 125-metre triangle surface', () => {
  for (const id of ['airport', 'desert', 'city', 'carrier', 'windfarm', 'fortress', 'farmland'])
    for (const [x, z] of [
      [34, 76],
      [-789, 543],
      [5523, -6677]
    ]) {
      const gx = Math.floor(x / 125) * 125,
        gz = Math.floor(z / 125) * 125,
        u = (x - gx) / 125,
        v = (z - gz) / 125;
      const a = D.rawHeight(id, gx, gz),
        b = D.rawHeight(id, gx + 125, gz),
        c = D.rawHeight(id, gx, gz + 125),
        d = D.rawHeight(id, gx + 125, gz + 125);
      near(
        D.height(id, x, z),
        u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v)
      );
    }
});
test('actual duel phase preserves scoring, freezes during pause, and prepares only one next opponent', () => {
  const state = { mode: 'respawning', missionMode: 'duel', countdown: 4, time: 18, series: D.create() },
    nodes = new Map();
  D.finish(state.series, 'win');
  let preparations = 0;
  const $ = (id) => {
    if (!nodes.has(id))
      nodes.set(id, {
        hidden: false,
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
    C,
    D,
    $,
    cannonMode: () => true,
    seeker: {},
    performance: { now: () => 100 },
    worldCanvas: { focus() {} },
    accumulator: 0,
    last: 0,
    pausedFrom: 'playing',
    enemies: [{ name: 'VIPER / AI' }],
    clearInput() {},
    stopBattleAudio() {},
    updateTelemetry() {},
    releaseMouse() {},
    captureMouse() {},
    audioStart() {},
    notice() {},
    prepareDuelRound() {
      preparations++;
    },
    player: {},
    feed() {},
    endMatch() {}
  });
  vm.runInContext(
    extract('function beginPhase(', 'function control(') +
      extract('function pause(', 'function hangar(') +
      ';globalThis.api={updatePhase,pause,resume};',
    ctx
  );
  ctx.api.updatePhase(1);
  near(state.countdown, 3);
  ctx.api.pause();
  assert.equal(state.mode, 'paused');
  near(state.series.elapsed, 0);
  ctx.api.resume();
  assert.equal(state.mode, 'respawning');
  near(state.countdown, 3);
  ctx.api.updatePhase(3);
  assert.equal(state.mode, 'spawning');
  assert.equal(state.series.round, 2);
  assert.equal(state.series.player, 1);
  assert.equal(preparations, 1);
  ctx.api.updatePhase(2);
  assert.equal(state.mode, 'playing');
  assert.equal(preparations, 1);
  near(state.time, 18);
});
test('actual fifth-round verdict reports a tied score honestly', () => {
  const series = D.create();
  for (const result of ['win', 'loss', 'draw', 'win', 'loss']) {
    D.finish(series, result);
    D.next(series);
  }
  const state = { series },
    nodes = new Map(),
    outcomes = [],
    $ = (id) => {
      if (!nodes.has(id)) nodes.set(id, { textContent: '' });
      return nodes.get(id);
    };
  const ctx = vm.createContext({
    state,
    D,
    $,
    clearInput() {},
    clearShots() {},
    feed() {},
    endMatch(reason, outcome) {
      outcomes.push(outcome);
    },
    arenaName: () => 'MERIDIAN',
    beginPhase() {
      assert.fail('A completed series must not redeploy');
    }
  });
  vm.runInContext(
    extract('function finishDuelRound(', 'function enterLastStand(') + ';globalThis.finish=finishDuelRound;',
    ctx
  );
  ctx.finish('loss');
  assert.deepEqual(outcomes, ['draw']);
  assert.equal(nodes.get('result-heading').textContent, 'HONOURS EVEN.');
});
test('cannon cooldown, overheating and recovery cannot bank extra shots', () => {
  const gun = D.makeGun();
  assert.equal(D.fire(gun), true);
  assert.equal(D.fire(gun), false);
  for (let i = 0; i < 600 && !gun.overheated; i++) {
    D.cool(gun, 1 / 120);
    D.fire(gun);
  }
  assert.equal(gun.overheated, true);
  assert.equal(D.fire(gun), false);
  D.cool(gun, 2);
  assert.equal(gun.overheated, true);
  D.cool(gun, 4);
  assert.equal(D.fire(gun), true);
  assert.equal(D.fire(gun), false);
});
test('gear creates real drag at unchanged power, with no health-dependent control penalty', () => {
  const fly = (gear) => {
    const q = new THREE.Quaternion(),
      v = new THREE.Vector3(0, 0, -180),
      a = { pitch: 0, roll: 0, yaw: 0 };
    for (let i = 0; i < 600; i++) C.flightStep(q, v, a, { gear }, (180 - 75) / 225, 1 / 120);
    return v.length();
  };
  assert.ok(fly(true) < fly(false) - 18);
});

function weaponHarness() {
  const craft = (z = 0) => {
    const p = new THREE.Vector3(0, 600, z),
      q = new THREE.Quaternion();
    return {
      p,
      q,
      v: new THREE.Vector3(),
      previous: { p: p.clone(), q: q.clone() },
      current: { p, q },
      gun: D.makeGun(),
      alive: true,
      hp: 100,
      invulnerable: 0,
      forward: () => new THREE.Vector3(0, 0, -1),
      muzzleTime: 0
    };
  };
  const player = craft(),
    enemy = craft(-400),
    events = [],
    state = { mode: 'playing', grounded: false, shots: 0, shake: 0 };
  let wall = null;
  const ctx = vm.createContext({
    THREE,
    C,
    D,
    hitboxes,
    scene: new THREE.Scene(),
    player,
    enemies: [enemy],
    state,
    look: { yaw: 0, pitch: 0 },
    random: () => 0.5,
    sparks: { emit() {} },
    worldHit: () => wall,
    noiseSound() {},
    damage(jet, amount) {
      jet.hp = Math.max(0, jet.hp - amount);
      jet.alive = jet.hp > 0;
      events.push(jet);
    },
    notice() {},
    ping() {}
  });
  vm.runInContext(
    extract('const cannonShots=', 'function releaseShot(') +
      ';globalThis.api={fireCannon,updateCannon,clearCannon,fireRailgun,shots:cannonShots,pool:cannonPool,lines:cannonLines,renderCannon};',
    ctx
  );
  return { ctx, api: ctx.api, player, enemy, events, state, craft, setWall: (t) => (wall = t) };
}
test('actual cannon traces hit moving compound boxes without a proximity fuse or seeker', () => {
  const h = weaponHarness();
  assert.equal(h.api.fireCannon(h.player), true);
  for (let i = 0; i < 50; i++) h.api.updateCannon(1 / 120);
  assert.equal(h.enemy.hp, 75);
  assert.equal(h.events.length, 1);
  assert.equal(h.api.shots.length, 0);
  assert.equal(h.api.pool.length, 96);
});
test('actual cannon expires at 500 metres, does not tunnel, and cannot shoot through cover', () => {
  for (const [z, wall, expected] of [
    [-525, null, 100],
    [-400, 0.1, 100],
    [-490, null, 75]
  ]) {
    const h = weaponHarness();
    h.enemy.p.z = z;
    h.enemy.previous.p.z = z;
    h.setWall(wall);
    h.api.fireCannon(h.player);
    for (let i = 0; i < 55; i++) h.api.updateCannon(1 / 120);
    assert.equal(h.enemy.hp, expected);
    assert.equal(h.api.pool.length, 96);
  }
});
test('both pilots use the same cannon speed, damage, range and firing interval', () => {
  const h = weaponHarness();
  h.enemy.p.z = 400;
  h.enemy.previous.p.z = 400;
  h.api.fireCannon(h.enemy);
  near(h.api.shots[0].v.length(), D.CANNON.speed);
  for (let i = 0; i < 50; i++) h.api.updateCannon(1 / 120);
  assert.equal(h.player.hp, 75);
  near(h.player.gun.cooldown, 0);
  near(h.enemy.gun.cooldown, D.CANNON.interval);
});
test('paused/dead guns cannot fire, and restart returns every projectile to its bounded pool', () => {
  const h = weaponHarness();
  h.state.mode = 'paused';
  assert.equal(h.api.fireCannon(h.player), false);
  h.state.mode = 'playing';
  h.player.alive = false;
  assert.equal(h.api.fireCannon(h.player), false);
  h.player.alive = true;
  for (let i = 0; i < 30; i++) {
    D.cool(h.player.gun, 1);
    h.api.fireCannon(h.player);
  }
  assert.equal(h.api.pool.length + h.api.shots.length, 96);
  h.api.clearCannon();
  assert.equal(h.api.pool.length, 96);
  assert.equal(h.api.shots.length, 0);
});
test('ground railgun is manual, hits instantly, recharges for three seconds, and respects cover', () => {
  const h = weaponHarness();
  h.state.grounded = true;
  h.state.railCooldown = 0;
  assert.equal(h.api.fireRailgun(), true);
  assert.equal(h.enemy.hp, 0);
  near(h.state.railCooldown, 3);
  assert.equal(h.api.fireRailgun(), false);
  const cover = weaponHarness();
  cover.state.grounded = true;
  cover.state.railCooldown = 0;
  cover.setWall(0.1);
  assert.equal(cover.api.fireRailgun(), true);
  assert.equal(cover.enemy.hp, 100);
});
test('ground railgun misses off-axis targets; it cannot be fired in the air or while paused', () => {
  const h = weaponHarness();
  h.state.railCooldown = 0;
  assert.equal(h.api.fireRailgun(), false);
  h.state.grounded = true;
  h.state.mode = 'paused';
  assert.equal(h.api.fireRailgun(), false);
  h.state.mode = 'playing';
  h.enemy.p.x = 30;
  h.enemy.previous.p.x = 30;
  h.api.fireRailgun();
  assert.equal(h.enemy.hp, 100);
});

function worldHarness() {
  const state = { arena: 'airport' },
    scene = new THREE.Scene(),
    buildings = [],
    obstacleGrid = new Map(),
    theaters = new Map(),
    unit = new THREE.BoxGeometry(1, 1, 1);
  const ctx = vm.createContext({
    THREE,
    C,
    D,
    state,
    scene,
    buildings,
    obstacleGrid,
    theaters,
    unitBox: unit,
    CELL: 300,
    FORWARD: new THREE.Vector3(0, 0, -1),
    groundTexture: new THREE.Texture(),
    seaMaterial: new THREE.MeshBasicMaterial(),
    terrainHeight: (x, z) => D.height(state.arena, x, z),
    standard: (color, roughness, metalness) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness }),
    box(parent, w, h, d, material, x = 0, y = 0, z = 0) {
      const m = new THREE.Mesh(unit, material);
      m.position.set(x, y, z);
      m.scale.set(w, h, d);
      parent.add(m);
      return m;
    }
  });
  vm.runInContext(
    extract('function registerBuilding(', 'for(let x=1600;') +
      extract('function batchAirframe(', 'const templates=') +
      extract('function buildTheater(', 'function setTheater(') +
      extract('function worldHit(', 'const gates=') +
      ';globalThis.api={buildTheater,advanceTheater,worldHit};',
    ctx
  );
  return { ctx, api: ctx.api, state, scene, buildings, theaters };
}
test('all seven new theaters build real geometry once, with isolated physical structures', () => {
  const h = worldHarness();
  for (const id of Object.keys(D.arenas).filter((id) => !['alpine', 'coastal'].includes(id))) {
    h.api.buildTheater(id);
    assert.ok(h.theaters.get(id).group.children.length > 1, id);
    assert.ok(
      h.buildings.some((b) => b.arena === id),
      id
    );
    const count = h.buildings.length;
    h.api.buildTheater(id);
    assert.equal(h.buildings.length, count);
  }
  assert.equal(h.theaters.size, 7);
  const airport = h.buildings.find((b) => b.arena === 'airport' && b.h > 40);
  const a = new THREE.Vector3(airport.x, airport.y + airport.h / 2, airport.z - 500),
    b = new THREE.Vector3(airport.x, airport.y + airport.h / 2, airport.z + 500);
  h.state.arena = 'airport';
  assert.notEqual(h.api.worldHit(a, b), null);
  h.state.arena = 'carrier';
  assert.equal(h.api.worldHit(a, b), null);
});
test('bridge collision leaves a genuine flight opening beneath the deck', () => {
  const h = worldHarness();
  h.api.buildTheater('airport');
  assert.equal(h.api.worldHit(new THREE.Vector3(0, 80, 1650), new THREE.Vector3(0, 80, 1850)), null);
  assert.notEqual(h.api.worldHit(new THREE.Vector3(704, 80, 1650), new THREE.Vector3(704, 80, 1850)), null);
  assert.notEqual(h.api.worldHit(new THREE.Vector3(0, 126, 1650), new THREE.Vector3(0, 126, 1850)), null);
});
test('rotating wind blades have matching moving hitboxes, not a solid disc', () => {
  const h = worldHarness();
  h.state.arena = 'windfarm';
  h.api.buildTheater('windfarm');
  const rotor = h.theaters.get('windfarm').rotors[0];
  rotor.angle = 0;
  h.api.advanceTheater(0);
  const at = (x, y, z) => rotor.center.clone().add(new THREE.Vector3(x, y, z));
  assert.notEqual(h.api.worldHit(at(0, 60, -20), at(0, 60, 20)), null);
  assert.equal(h.api.worldHit(at(35, 60, -20), at(35, 60, 20)), null);
  h.api.advanceTheater(1);
  near(rotor.hub.rotation.z, 0.37);
  assert.equal(h.api.worldHit(at(0, 60, -20), at(0, 60, 20)), null);
});
test('the delivered UI exposes the AI scope, fixed duel loadout, gear key and Last Stand mode', () => {
  assert.match(html, /YOU \/ AI RIVAL/);
  assert.match(html, /value="duel" selected/);
  assert.match(html, /value="laststand"/);
  assert.match(game, /if\(cannonMode\(\)\)\{stepDuel\(dt\);return;\}/);
  assert.match(game, /!cannonMode\(\)&&e.alive&&C.behindThreat/);
  assert.match(game, /if\(event.code==='KeyG'\)toggleGear\(\)/);
});
