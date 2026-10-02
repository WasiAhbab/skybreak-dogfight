import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {compactJS} from './source.mjs';
import * as THREE from '../public/vendor/three.module.js';

const html=readFileSync(new URL('../public/skybreak.html',import.meta.url),'utf8');
const core=html.match(/<script id="flight-core">([\s\S]*?)<\/script>/)[1];
const game=compactJS(html.match(/<script type="module" id="game-code">([\s\S]*?)<\/script>/)[1]);
const context=vm.createContext({THREE});
vm.runInContext(core+'\nglobalThis.C=FlightCore;',context);
const C=context.C,near=(a,b,epsilon=1e-7)=>assert.ok(Math.abs(a-b)<epsilon,a+' != '+b);
const extract=(a,b)=>game.slice(game.indexOf(a),game.indexOf(b,game.indexOf(a)));

test('mountain physics uses the same triangles as the rendered height field',()=>{
 for(const [x,z] of [[37,44],[-389,887],[761,-1217],[-147,-7204]]){
  const gx=Math.floor(x/125)*125,gz=Math.floor(z/125)*125,u=(x-gx)/125,v=(z-gz)/125;
  const a=C.alpineHeight(gx,gz),b=C.alpineHeight(gx+125,gz),c=C.alpineHeight(gx,gz+125),d=C.alpineHeight(gx+125,gz+125);
  near(C.alpineTerrain(x,z),u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v));
 }
});
test('mountain heights are continuous, deterministic and leave room at the starting altitude',()=>{
 for(let x=-12000;x<=12000;x+=937)for(let z=-12000;z<=12000;z+=1301){
  const y=C.alpineTerrain(x,z);assert.ok(Number.isFinite(y)&&y>0&&y<4200);near(C.alpineTerrain(x,z),y);
 }
 for(let z=-1000;z<4000;z+=100)assert.ok(C.alpineTerrain(-150,z)<2900,'initial corridor must clear the mountain mesh');
 for(let x=-1500;x<1500;x+=125)near(C.alpineTerrain(x-1e-7,415),C.alpineTerrain(x+1e-7,415),1e-5);
});
test('camera damping is frame-rate independent and crosses the yaw seam by the shortest route',()=>{
 let a=0,b=0;
 for(let i=0;i<30;i++)a=C.dampAngle(a,1.1,1/30);
 for(let i=0;i<144;i++)b=C.dampAngle(b,1.1,1/144);
 near(a,b);near(C.dampAngle(.3,1,0),.3);
 const n=C.dampAngle(Math.PI-.01,-Math.PI+.01,1/60);
 assert.ok(n>Math.PI-.01&&n<Math.PI+.01);
});
test('aircraft-local mouse orbit remains finite and continuous throughout a vertical loop',()=>{
 const player={mesh:{quaternion:new THREE.Quaternion()}},smoothLook={yaw:.2,pitch:.1};
 const ctx=vm.createContext({THREE,player,smoothLook,chaseRig:{attitude:player.mesh.quaternion}});
 vm.runInContext(extract('function viewDirection(){','function updateCamera(')+'\nglobalThis.view=viewDirection;',ctx);
 let previous=null;
 for(let i=0;i<=720;i++){
  player.mesh.quaternion.setFromAxisAngle(new THREE.Vector3(1,0,0),i*Math.PI/360);
  const direction=ctx.view();near(direction.length(),1);
  if(previous)assert.ok(direction.dot(previous)>.999,'pole crossing must not flip the camera');
  previous=direction;
 }
});
test('mouse smoothing settles without overshoot; it never alters the aircraft rotation',()=>{
 const playerFunction=extract('function updatePlayer(','function obstacleHeight(');
 assert.doesNotMatch(playerFunction,/smoothLook|look\.yaw|look\.pitch/);
 let value=0;for(let i=0;i<180;i++){const next=C.dampAngle(value,.75,1/120,34);assert.ok(next>=value&&next<=.75);value=next;}near(value,.75);
 const mouseHandler=extract("document.addEventListener('mousemove'","document.addEventListener('pointerlockchange'");
 assert.match(mouseHandler,/document\.pointerLockElement===worldCanvas/);
 assert.doesNotMatch(mouseHandler,/clientX-mouseLast/,'compatibility mouse events must not apply the pointer delta twice');
});
test('static airframe batching preserves transforms and excludes live exhaust meshes',()=>{
 const ctx=vm.createContext({THREE});vm.runInContext(extract('function batchAirframe(','const templates=')+'\nglobalThis.batch=batchAirframe;',ctx);
 const root=new THREE.Group(),material=new THREE.MeshStandardMaterial();
 for(let i=0;i<4;i++){const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),material);mesh.position.x=i*2;root.add(mesh);}
 const plumes=new THREE.Group();plumes.name='plumes';const flame=new THREE.Mesh(new THREE.ConeGeometry(1,2),material);plumes.add(flame);root.add(plumes);
 ctx.batch(root);
 assert.equal(root.children.filter(x=>x.isMesh).length,1);assert.equal(plumes.children.length,1);
 const geometry=root.children.find(x=>x.isMesh).geometry;geometry.computeBoundingBox();
 near(geometry.boundingBox.min.x,-.5);near(geometry.boundingBox.max.x,6.5);assert.equal(geometry.attributes.position.count,144);
});
test('theaters are isolated: mountain flight cannot hit hidden coastal structures',()=>{
 assert.match(game,/state\.arena!==obstacle\.arena\|\|seen\.has\(obstacle\)/);
 assert.match(game,/for\(const g of activeGates\(\)\)if\(!g\.passed/);
 assert.match(game,/terrainHeight\(x,z\)\)\+padding/);
 assert.match(game,/const alpha=clamp\(accumulator\/FIXED,0,1\);player\.sync\(alpha\)/);
});
