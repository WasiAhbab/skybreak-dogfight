import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../public/vendor/three.module.js';
import { compactJS } from './source.mjs';
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const core = html.match(/<script id="expedition-core">([\s\S]*?)<\/script>/)[1];
const context = vm.createContext({});
vm.runInContext(core + '\nglobalThis.X=ExpeditionCore', context);
const X = context.X;
const game = compactJS(html.match(/<script type="module" id="game-code">([\s\S]*?)<\/script>/)[1]);
const extract = (a, b) => game.slice(game.indexOf(a), game.indexOf(b, game.indexOf(a)));
test('career validates corrupted saves, clamps unlocks and resets the UTC daily counter', () => {
  const p = X.profile(
    {
      xp: Infinity,
      kills: -5,
      skin: 88,
      campaign: 99,
      daily: 5,
      day: 'yesterday',
      dailyClaimed: true
    },
    'today'
  );
  assert.equal(p.xp, 0);
  assert.equal(p.kills, 0);
  assert.equal(p.skin, 2);
  assert.equal(p.campaign, 6);
  assert.equal(p.daily, 0);
  assert.equal(p.dailyClaimed, false);
});
test('five kills award daily bonus exactly once; wins grant XP independently', () => {
  const p = X.profile(null);
  for (let i = 0; i < 5; i++) X.award(p, 'kill');
  assert.equal(p.xp, 800);
  X.award(p, 'kill');
  assert.equal(p.xp, 900);
  X.award(p, 'win');
  assert.equal(p.xp, 1100);
  assert.equal(p.wins, 1);
});
test('airframe and livery thresholds gate progression', () => {
  assert.equal(X.unlocked(599, 'airframe', 1), false);
  assert.equal(X.unlocked(600, 'airframe', 1), true);
  assert.equal(X.unlocked(999, 'skin', 2), false);
  assert.equal(X.unlocked(1000, 'skin', 2), true);
  assert.equal(X.unlocked(1800, 'airframe', 2), true);
});
test('six campaign missions include interception, escort, bombing and a boss with finite limits', () => {
  assert.equal(X.missions.length, 6);
  for (const type of ['intercept', 'escort', 'strike', 'boss'])
    assert.ok(X.missions.some((m) => m.type === type));
  for (const m of X.missions) {
    assert.ok(m.duration >= 90);
    assert.ok(m.count > 0 && m.count <= 7);
    assert.ok(m.text.length > 50);
  }
});
test('missile alarm measures relative closure and accelerates for urgent threats', () => {
  const zero = { x: 0, y: 0, z: 0 },
    p = { x: 0, y: 0, z: -600 },
    v = { x: 0, y: 0, z: 600 };
  const closing = X.missileThreat(zero, zero, p, v);
  assert.equal(closing.eta, 1);
  assert.equal(closing.interval, 0.16);
  assert.equal(X.missileThreat(zero, zero, p, { ...v, z: -600 }).eta, Infinity);
  assert.equal(X.missileThreat(zero, zero, { ...p, z: -40 }, v).interval, 0.12);
});
test('boost and bomb controls reject paused, cannon or inappropriate mission states', () => {
  const ctx = vm.createContext({
    state: { mode: 'paused', grounded: false },
    boostCooldown: 0,
    boostTime: 0,
    bombCooldown: 0,
    campaign: { type: 'strike' },
    cannonMode: () => false,
    notice: () => {}
  });
  vm.runInContext(
    extract('function useBoost()', 'function expeditionStep(') + ';globalThis.api={useBoost,releaseBomb}',
    ctx
  );
  ctx.api.useBoost();
  ctx.api.releaseBomb();
  assert.equal(ctx.boostTime, 0);
  assert.equal(ctx.bombCooldown, 0);
  ctx.state.mode = 'playing';
  ctx.api.useBoost();
  assert.equal(ctx.boostTime, 3);
  assert.equal(ctx.boostCooldown, 12);
  ctx.boostTime = 1;
  ctx.api.useBoost();
  assert.equal(ctx.boostTime, 1);
});
test('runtime rejects a ground bomb outside the strike objective', () => {
  const ctx = vm.createContext({
    state: { mode: 'playing' },
    campaign: { type: 'escort' },
    bombCooldown: 0
  });
  vm.runInContext(extract('function releaseBomb()', 'function expeditionStep(') + ';releaseBomb();', ctx);
  assert.equal(ctx.bombCooldown, 0);
});
test('warnings run only in active combat and kills cannot trigger a slow-motion replay', () => {
  assert.match(game, /const active=state.mode==='playing'/);
  assert.doesNotMatch(game, /replayPending|startReplay|replayFrame|recorder\.push/);
  assert.doesNotMatch(html, /id="kill-replay"|id="replay-label"/);
  assert.match(game, /if\(state.mode==='playing'\)expeditionStep\(FIXED\)/);
});
test('bomb launch inherits aircraft velocity and starts a two-second rearm', () => {
  const ctx = vm.createContext({
    THREE,
    state: { mode: 'playing' },
    campaign: { type: 'strike' },
    bombCooldown: 0,
    bombs: [],
    bombGeometry: new THREE.SphereGeometry(1),
    bombMaterial: new THREE.MeshBasicMaterial(),
    scene: new THREE.Scene(),
    player: {
      p: new THREE.Vector3(1, 100, 4),
      v: new THREE.Vector3(0, 2, -100)
    },
    notice: () => {}
  });
  vm.runInContext(
    extract('function releaseBomb()', 'function expeditionStep(') + ';releaseBomb();releaseBomb();',
    ctx
  );
  assert.equal(ctx.bombs.length, 1);
  assert.equal(ctx.bombCooldown, 2);
  assert.equal(ctx.bombs[0].v.z, -100);
  assert.equal(ctx.bombs[0].mesh.position.y, 97);
});
function campaignHarness(type = 'intercept') {
  const player = {
    p: new THREE.Vector3(0, 100, 0),
    q: new THREE.Quaternion(),
    v: new THREE.Vector3(0, 0, -100),
    alive: true,
    speed: 100,
    forward: () => new THREE.Vector3(0, 0, -1)
  };
  const outcomes = [],
    scene = new THREE.Scene(),
    state = { mode: 'playing', kills: 0 };
  const c = vm.createContext({
    THREE,
    player,
    state,
    scene,
    campaign: {
      name: 'TEST',
      type,
      elapsed: 0,
      duration: 180,
      goal: 3,
      destroyed: 0
    },
    escort: null,
    boostTime: 0,
    boostCooldown: 0,
    bombCooldown: 0,
    pickups: [],
    debris: [],
    bombs: [],
    groundTargets: [],
    shots: [],
    shockTime: 0,
    wasSupersonic: false,
    shockRing: { visible: false, scale: { setScalar() {} }, material: {} },
    camera: {
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion()
    },
    enemies: [],
    cannonMode: () => false,
    notice: () => {},
    ping: () => {},
    spatialTone: () => {},
    worldHit: () => null,
    explosion: () => {},
    endMatch: (reason, result) => {
      outcomes.push({ reason, result });
      state.mode = 'ended';
    },
    C: { segmentBox: () => null },
    FORWARD: new THREE.Vector3(0, 0, -1)
  });
  vm.runInContext(
    extract('function expeditionStep(', 'function spatialTone(') + ';globalThis.tick=expeditionStep;',
    c
  );
  return { c, outcomes, scene, state, player };
}
test('campaign intercept completes only at its configured kill objective', () => {
  const h = campaignHarness();
  h.state.kills = 2;
  h.c.tick(0.01);
  assert.equal(h.outcomes.length, 0);
  h.state.kills = 3;
  h.c.tick(0.01);
  assert.equal(h.outcomes[0].result, 'victory');
});
test('escort survival and loss have distinct outcomes', () => {
  const h = campaignHarness('escort');
  h.c.escort = { alive: false };
  h.c.tick(0.01);
  assert.equal(h.outcomes[0].result, 'defeat');
  const w = campaignHarness('escort');
  w.c.campaign.elapsed = 89.99;
  w.c.escort = {
    alive: true,
    p: new THREE.Vector3(),
    q: new THREE.Quaternion(),
    v: new THREE.Vector3(),
    snapshot() {},
    sync() {}
  };
  w.c.tick(0.02);
  assert.equal(w.outcomes[0].result, 'victory');
});
test('strike victory requires relay destruction, not aircraft kills', () => {
  const h = campaignHarness('strike');
  h.state.kills = 100;
  h.c.tick(0.01);
  assert.equal(h.outcomes.length, 0);
  h.c.campaign.destroyed = 3;
  h.c.tick(0.01);
  assert.equal(h.outcomes[0].result, 'victory');
});
test('campaign timeout fails and repair/resupply pickups enforce a respawn cooldown', () => {
  const h = campaignHarness();
  const mesh = new THREE.Mesh();
  mesh.position.copy(h.player.p);
  h.player.hp = 10;
  h.c.pickups.push({ mesh, kind: 0, cooldown: 0 });
  h.c.tick(0.01);
  assert.equal(h.player.hp, 45);
  h.c.tick(0.01);
  assert.equal(h.player.hp, 45);
  h.c.campaign.elapsed = 180;
  h.c.tick(0.01);
  assert.equal(h.outcomes[0].result, 'defeat');
});
