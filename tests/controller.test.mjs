import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Quaternion, Vector3} from '../public/vendor/three.module.js';
import {integrateFlight, turnAuthority} from '../public/flight-controller.js';
import {terrainHeight,collisionHeight,worldSegmentHit,buildings} from '../public/arena-layout.js';

const near=(a,b,eps=1e-7)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);

test('released controls stop rotation immediately',()=>{
 const q=integrateFlight(new Quaternion(),{pitch:.7,roll:.5,yaw:.2},135,.25),before=q.clone();
 for(let i=0;i<120;i++)integrateFlight(q,{},135,1/60);
 assert.deepEqual(q.toArray(),before.toArray());
});
test('pitch can complete a full loop without Euler clamping',()=>{
 const q=new Quaternion(),time=2*Math.PI/1.18;
 for(let i=0;i<360;i++)integrateFlight(q,{pitch:1},135,time/360);
 near(q.angleTo(new Quaternion()),0);
});
test('local roll remains continuous through inverted flight',()=>{
 const q=new Quaternion(),time=Math.PI/2.35;
 integrateFlight(q,{roll:1},135,time);
 const up=new Vector3(0,1,0).applyQuaternion(q);
 near(up.y,-1);
 integrateFlight(q,{roll:1},135,time);near(q.angleTo(new Quaternion()),0);
});
test('mixed-axis rotation is independent of frame subdivision',()=>{
 const input={pitch:.8,yaw:.3,roll:-.4},a=new Quaternion(),b=new Quaternion();
 for(let i=0;i<30;i++)integrateFlight(a,input,145,1/30);
 for(let i=0;i<120;i++)integrateFlight(b,input,145,1/120);
 near(a.angleTo(b),0);
});
test('boost increases turn radius, corner speed tightens it',()=>{
 assert.ok(275/turnAuthority(275)>135/turnAuthority(135));
 assert.ok(turnAuthority(0)<=1.22);assert.ok(turnAuthority(10000)>=.48);
});
test('long mixed-axis flight preserves finite normalized attitude',()=>{
 const q=new Quaternion();
 for(let i=0;i<20000;i++)integrateFlight(q,{pitch:Math.sin(i),yaw:Math.cos(i*.3),roll:Math.sin(i*.2)},180,1/60);
 near(q.length(),1);assert.ok(q.toArray().every(Number.isFinite));
});
test('airfield is flat and ocean has a collision surface',()=>{
 near(terrainHeight(-650,0),42);near(terrainHeight(400,1800),42);
 near(collisionHeight(17000,0),0);
});
test('building geometry and collision height share the same bounds',()=>{
 const b=buildings.find(b=>b.kind==='tower');
 near(collisionHeight(b.x,b.z),b.y+b.h);
 assert.ok(worldSegmentHit({x:b.x-180,y:b.y+30,z:b.z},{x:b.x+180,y:b.y+30,z:b.z}));
 assert.ok(!worldSegmentHit({x:b.x-180,y:b.y+b.h+20,z:b.z},{x:b.x+180,y:b.y+b.h+20,z:b.z}));
});
test('terrain blocks line of sight and swept ground intersections',()=>{
 assert.ok(worldSegmentHit({x:-650,y:500,z:0},{x:-650,y:20,z:0}));
 assert.ok(!worldSegmentHit({x:-650,y:500,z:0},{x:-650,y:100,z:0}));
});
