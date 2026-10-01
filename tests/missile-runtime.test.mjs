import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {compactJS} from './source.mjs';
import * as THREE from '../public/vendor/three.module.js';

const html=readFileSync(new URL('../public/skybreak.html',import.meta.url),'utf8');
const core=html.match(/<script id="flight-core">([\s\S]*?)<\/script>/)[1];
const game=compactJS(html.match(/<script type="module" id="game-code">([\s\S]*?)<\/script>/)[1]);
const extract=(from,to)=>game.slice(game.indexOf(from),game.indexOf(to,game.indexOf(from)));
const actor=(z=0)=>({
 p:new THREE.Vector3(0,270,z),q:new THREE.Quaternion(),v:new THREE.Vector3(0,0,-140),
 previous:{p:new THREE.Vector3(0,270,z),q:new THREE.Quaternion()},
 current:{p:new THREE.Vector3(0,270,z),q:new THREE.Quaternion()},
 forward:()=>new THREE.Vector3(0,0,-1),alive:true,hp:100,name:'TEST',eligible:true,shotSide:1,flareCooldown:0,
 launcher:{reload:0}
});
const projectile=()=>({p:new THREE.Vector3(),last:new THREE.Vector3(),v:new THREE.Vector3(),owner:null,target:null,age:0,smokeTime:0,born:false});
function harness(){
 const player=actor(),target=actor(-500),state={mode:'playing',time:0,shots:0,flares:0,shake:0};
 const notices=[],radioEvents=[],hits=[],seeker={locked:true,target},shots=[],enemies=[target],freeShots=Array.from({length:12},projectile);
 const context=vm.createContext({THREE,player,target,state,seeker,shots,enemies,freeShots,
  RIGHT:new THREE.Vector3(1,0,0),UP:new THREE.Vector3(0,1,0),zero:new THREE.Vector3(),
  eligibleTarget:t=>t.alive&&t.eligible,lastLockNotice:-10,noiseSound:()=>{},notice:text=>notices.push(text),radioCue:key=>radioEvents.push(key),
  worldHit:()=>null,explosion:()=>{},random:()=>.5,sparks:{emit:()=>{}},smoke:{emit:()=>{}},
  damage:(jet,amount)=>{hits.push(jet);jet.hp-=amount;if(jet.hp<=0)jet.alive=false;}
 });
 vm.runInContext(core+'\nconst C=FlightCore;\n'+
  extract('const boxDefinitions=','const plumeGeometry=')+
  extract('function releaseShot(','function clearShots(')+
  extract('function fireMissile(','function feed(')+
  extract('function deployFlares(','function updateProjectiles(')+
  extract('function updateProjectiles(','function renderProjectiles(')+
  '\nfunction tickFlares(dt){'+game.match(/player\.flareCooldown=Math\.max\(0,player\.flareCooldown-dt\);/)[0]+'}\n'+
  'globalThis.api={fireMissile,deployFlares,tickFlares,updateProjectiles,C};',context);
 return {context,api:context.api,player,target,state,seeker,shots,enemies,freeShots,notices,radioEvents,hits};
}
test('real launch routine spends the reload only after a valid live lock',()=>{
 const h=harness();h.seeker.locked=false;
 assert.equal(h.api.fireMissile(h.player),false);assert.equal(h.player.launcher.reload,0);assert.equal(h.shots.length,0);
 h.seeker.locked=true;h.target.eligible=false;assert.equal(h.api.fireMissile(h.player),false);
 h.target.eligible=true;assert.equal(h.api.fireMissile(h.player),true);
 assert.equal(h.shots.length,1);assert.equal(h.shots[0].target,h.target);assert.equal(h.player.launcher.reload,1);
 assert.deepEqual(h.radioEvents,['launch']);
 for(let i=0;i<10;i++)assert.equal(h.api.fireMissile(h.player),false);
 assert.equal(h.state.shots,1);
 h.api.C.updateLauncher(h.player.launcher,.999);assert.equal(h.api.fireMissile(h.player),false);
 h.api.C.updateLauncher(h.player.launcher,.001);assert.equal(h.api.fireMissile(h.player),true);assert.equal(h.state.shots,2);
});
test('an in-flight missile retains its original target after the aiming circle selects someone else',()=>{
 const h=harness();h.api.fireMissile(h.player);const original=h.shots[0].target;
 h.seeker.target=actor(-650);h.api.updateProjectiles(1/120);h.api.updateProjectiles(1/120);
 assert.equal(h.shots[0].target,original);
 original.alive=false;h.api.updateProjectiles(1/120);assert.equal(h.shots[0].target,null);
});
test('swept multi-aircraft collision hits the nearest jet, not whichever was selected',()=>{
 const h=harness(),near=actor(-60),far=actor(-140);h.enemies.splice(0,h.enemies.length,far,near);
 const shot=projectile();shot.owner=h.player;shot.p.copy(h.player.p);shot.v.set(0,0,-900);h.shots.push(shot);
 h.api.updateProjectiles(.2);assert.equal(h.hits.length,1);assert.equal(h.hits[0],near);assert.equal(h.shots.length,0);
 assert.equal(h.freeShots.at(-1).target,null);
});
test('a world obstacle before the target absorbs the missile without damaging the aircraft',()=>{
 const h=harness();h.context.worldHit=()=>.02;
 const shot=projectile();shot.owner=h.player;shot.p.copy(h.player.p);shot.v.set(0,0,-900);h.target.previous.p.z=-60;h.target.current.p.z=-60;h.shots.push(shot);
 h.api.updateProjectiles(.2);assert.equal(h.hits.length,0);assert.equal(h.shots.length,0);
});
test('flares divert only nearby hostile seekers and cannot bypass their 2.5-second cooldown',()=>{
 const h=harness(),near=projectile(),far=projectile();
 near.target=h.player;near.p.set(0,270,-600);far.target=h.player;far.p.set(0,270,-900);h.shots.push(near,far);
 h.api.deployFlares();assert.equal(near.target,null);assert.equal(far.target,h.player);assert.equal(h.player.flareCooldown,2.5);
 assert.equal(h.state.flares,1);h.api.deployFlares();assert.equal(h.state.flares,1);
 assert.match(h.notices.at(-1),/1 SEEKER DIVERTED/);
 assert.deepEqual(h.radioEvents,['defeated']);
 h.api.tickFlares(2.49);h.api.deployFlares();assert.equal(h.state.flares,1);
 h.api.tickFlares(.01);h.api.deployFlares();assert.equal(h.state.flares,2);assert.equal(h.player.flareCooldown,2.5);
 assert.deepEqual(h.radioEvents,['defeated','flares']);
 h.api.tickFlares(10);assert.equal(h.player.flareCooldown,0);
});
test('paused or ended combat cannot launch missiles or deploy flares',()=>{
 const h=harness();
 for(const mode of ['paused','ended','menu']){h.state.mode=mode;assert.equal(h.api.fireMissile(h.player),false);h.api.deployFlares();}
 assert.equal(h.state.shots,0);assert.equal(h.state.flares,0);assert.equal(h.shots.length,0);
});
test('burned-out missile stops homing and descends ballistically until cleanup',()=>{
 const h=harness(),shot=projectile();shot.owner=h.player;shot.target=h.target;shot.age=3.5;
 shot.p.copy(h.player.p);shot.v.set(0,0,-900);h.shots.push(shot);
 h.api.updateProjectiles(.01);assert.equal(shot.target,null);assert.ok(shot.v.y<0);assert.equal(shot.v.x,0);assert.ok(Math.abs(shot.v.z)<900);
 shot.age=12;h.api.updateProjectiles(.01);assert.equal(h.shots.length,0);
});
test('five-metre swept proximity fuse catches a near pass outside all physical aircraft boxes',()=>{
 const h=harness(),shot=projectile();shot.owner=h.player;shot.p.set(0,274.5,-400);shot.v.set(0,0,-900);h.shots.push(shot);
 h.api.updateProjectiles(.2);assert.equal(h.hits.length,1);assert.equal(h.target.alive,false);assert.equal(h.shots.length,0);
});
test('fatal damage may clear the pool during respawn without double-releasing a projectile',()=>{
 const h=harness(),shot=projectile();shot.owner=h.target;shot.p.set(0,270,-60);shot.v.set(0,0,900);h.shots.push(shot);
 h.context.damage=()=>{h.state.mode='respawning';h.shots.length=0;};
 assert.doesNotThrow(()=>h.api.updateProjectiles(.1));assert.equal(h.state.mode,'respawning');
 assert.equal(h.shots.length,0);assert.equal(h.freeShots.filter(s=>s===shot).length,1);
});
