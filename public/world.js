import * as THREE from 'three';
import {terrainHeight, buildings, roads, runways} from './arena-layout.js';
export {terrainHeight} from './arena-layout.js';
const mat=(color,metalness=.4,roughness=.5)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
const skin=mat(0x858a77,.35,.6),dark=mat(0x323c39,.4,.52),belly=mat(0xa2aaa0,.3,.65),glass=mat(0x1b3443,.72,.18),black=mat(0x14222c,.3,.7);
const orange=new THREE.MeshBasicMaterial({color:0xff8e39}),blue=new THREE.MeshBasicMaterial({color:0x84e6ff});
const exhaustGeo=new THREE.ConeGeometry(.73,6,12);
function exhaustMaterial(color){return new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{tint:{value:new THREE.Color(color)}},vertexShader:'varying float heat;void main(){heat=1.-(position.y+3.)/6.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying float heat;uniform vec3 tint;void main(){gl_FragColor=vec4(tint,pow(max(heat,0.),.8)*.8);}'});}
const hotExhaust=exhaustMaterial(0x806cff),coreExhaust=exhaustMaterial(0xa3e7ff);
const jetTemplates=new Map(),missileTemplates=new Map();
function cloneJet(template){const copy=template.clone(true);copy.userData.body=copy.children[0];copy.userData.flames=copy.children[0].children.filter(x=>x.userData.flame);return copy;}
function mesh(g,m,p,scale){const o=new THREE.Mesh(g,m);if(p)o.position.set(...p);if(scale)o.scale.set(...scale);return o;}
function plate(points,depth,material){const shape=new THREE.Shape();points.forEach(([x,z],i)=>i?shape.lineTo(x,z):shape.moveTo(x,z));shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.06,bevelThickness:.05});g.rotateX(Math.PI/2);return mesh(g,material);}
export function makeJet(enemy=false){
 if(jetTemplates.has(enemy))return cloneJet(jetTemplates.get(enemy));
 const group=new THREE.Group(),body=new THREE.Group();group.add(body);
 const fuselage=mesh(new THREE.CylinderGeometry(.75,1.4,11.5,12,1),skin,[0,0,-.3]);fuselage.rotation.x=Math.PI/2;body.add(fuselage);
 const nose=mesh(new THREE.ConeGeometry(.77,5,12),dark,[0,0,-8.5]);nose.rotation.x=-Math.PI/2;body.add(nose);
 const lower=mesh(new THREE.SphereGeometry(1,16,10),belly,[0,-.55,-.7],[1.15,.75,5]);body.add(lower);
 for(const sign of [-1,1]){
  const wing=plate([[sign*.65,-2.4],[sign*8.6,1.1],[sign*8.1,3.4],[sign*1.1,2.3]],.2,skin);wing.position.y=.4;body.add(wing);
  const tail=plate([[sign*.5,3.5],[sign*4.5,5.8],[sign*3.8,7],[sign*.5,5.8]],.15,skin);tail.position.y=.25;body.add(tail);
  const engine=mesh(new THREE.CylinderGeometry(.7,.82,6.5,14),dark,[sign*.93,-.2,3]);engine.rotation.x=Math.PI/2;body.add(engine);
  const nozzle=mesh(new THREE.CylinderGeometry(.76,.67,1.15,16,1,true),black,[sign*.93,-.2,6.65]);nozzle.rotation.x=Math.PI/2;body.add(nozzle);
  const flame=mesh(exhaustGeo,hotExhaust,[sign*.93,-.2,9.4]);flame.rotation.x=Math.PI/2;body.add(flame);
  const core=mesh(exhaustGeo,coreExhaust,[sign*.93,-.2,8.1],[.5,.7,.5]);core.rotation.x=Math.PI/2;body.add(core);
  flame.userData.flame=true;core.userData.flame=true;
  const stripe=plate([[sign*3.2,-1.05],[sign*4.3,-.6],[sign*4.3,2.75],[sign*3.2,2.5]],.04,mat(enemy?0x754f40:0xc0c1a6,.2,.7));stripe.position.y=.7;body.add(stripe);
  const intake=mesh(new THREE.BoxGeometry(.9,.8,2.8),black,[sign*1.15,-.3,-3]);body.add(intake);
  for(const x of [3.4,5.8]){const rocket=makeMissile(enemy);rocket.scale.setScalar(.72);rocket.position.set(sign*x,-.55,.9);body.add(rocket);}
  const light=mesh(new THREE.SphereGeometry(.12,6,6),new THREE.MeshBasicMaterial({color:sign<0?0xf64343:0x6dffc6}),[sign*8.5,.7,1.4]);body.add(light);
 }
 const fin=plate([[0,1.7],[0,6.7],[3.8,5.7],[3.4,3.9]],.19,skin);fin.rotation.z=Math.PI/2;fin.position.set(.1,.8,0);body.add(fin);
 const rudder=plate([[.4,6.2],[3.4,5.4],[3.1,4.8],[.4,5.8]],.2,dark);rudder.rotation.z=Math.PI/2;rudder.position.set(.13,.8,0);body.add(rudder);
 const cockpit=mesh(new THREE.SphereGeometry(1,20,12),glass,[0,1.02,-3.8],[.75,.63,2.3]);body.add(cockpit);
 const frame=mesh(new THREE.TorusGeometry(.74,.045,5,20,Math.PI),skin,[0,1,-3.5]);body.add(frame);
 const spine=mesh(new THREE.BoxGeometry(.4,.5,5),skin,[0,1,1]);body.add(spine);
 jetTemplates.set(enemy,group);return cloneJet(group);
}
export function makeMissile(hostile=false){
 if(missileTemplates.has(hostile))return missileTemplates.get(hostile).clone(true);
 const g=new THREE.Group();const m=mat(hostile?0xbcb9aa:0xe3e7dd,.3,.5);
 const tube=mesh(new THREE.CylinderGeometry(.16,.21,2.9,8),m);tube.rotation.x=Math.PI/2;g.add(tube);
 const head=mesh(new THREE.ConeGeometry(.16,.9,8),dark,[0,0,-1.85]);head.rotation.x=-Math.PI/2;g.add(head);
 const fins=mesh(new THREE.BoxGeometry(1.4,.06,.6),m,[0,0,1]);g.add(fins);const f2=fins.clone();f2.rotation.z=Math.PI/2;g.add(f2);
 const glow=mesh(new THREE.SphereGeometry(.26,8,8),orange,[0,0,1.6],[1,1,2]);g.add(glow);missileTemplates.set(hostile,g);return g.clone(true);
}
function noise(x,z){return Math.sin(x*1.1+Math.cos(z*1.31))*Math.sin(z*.81-x*.18)+.5*Math.sin(x*2.8+z*2.1)+.2*Math.cos(x*5.3-z*4.2);}

function createAirfield(scene) {
 const groundMat=mat(0x666c66,.02,.96),asphalt=mat(0x343c42,.02,.95),paint=mat(0xd2d2bc,0,1);
 const box=new THREE.BoxGeometry(1,1,1),plane=new THREE.PlaneGeometry(1,1),unit=new THREE.Object3D();
 const surfaces=[];
 const rect=(x,z,w,d,material,y=42.4)=>{const m=mesh(plane,material,[x,y,z],[w,d,1]);m.rotation.x=-Math.PI/2;scene.add(m);};
 rect(-1160,-250,650,4300,groundMat);
 for(const r of roads)rect(r.x,r.z,r.w,r.d,asphalt);
 const lights=[];
 for(const r of runways){
  rect(r.x,r.z,r.w+35,r.d+55,groundMat);rect(r.x,r.z,r.w,r.d,asphalt,42.6);
  for(let z=r.z-r.d/2+90;z<r.z+r.d/2-70;z+=110){surfaces.push([r.x,z,3,47]);for(const s of [-1,1])lights.push([r.x+s*(r.w/2+3),43,z]);}
  for(const end of [-1,1])for(let i=-3;i<=3;i++)surfaces.push([r.x+i*9,r.z+end*(r.d/2-80),4,80]);
  for(const s of [-1,1])rect(r.x+s*(r.w/2-5),r.z,1.8,r.d-40,paint,42.75);
 }
 for(let z=-1900;z<=1700;z+=550)rect(-1040,z,700,38,asphalt);
 const marks=new THREE.InstancedMesh(plane,paint,surfaces.length);
 surfaces.forEach(([x,z,w,d],i)=>{unit.position.set(x,42.8,z);unit.rotation.set(-Math.PI/2,0,0);unit.scale.set(w,d,1);unit.updateMatrix();marks.setMatrixAt(i,unit.matrix);});scene.add(marks);
 const edgeLights=new THREE.InstancedMesh(box,new THREE.MeshBasicMaterial({color:0x9cc7ff}),lights.length);
 lights.forEach(([x,y,z],i)=>{unit.position.set(x,y,z);unit.rotation.set(0,0,0);unit.scale.set(2,1.6,2);unit.updateMatrix();edgeLights.setMatrixAt(i,unit.matrix);});scene.add(edgeLights);

 const wallCanvas=document.createElement('canvas');wallCanvas.width=64;wallCanvas.height=128;const c=wallCanvas.getContext('2d');
 c.fillStyle='#85908e';c.fillRect(0,0,64,128);
 for(let y=6;y<128;y+=14)for(let x=5;x<64;x+=14){c.fillStyle=(x+y)%3===0?'#c4b78c':'#394d57';c.fillRect(x,y,8,7);c.fillStyle='#a5aaa2';c.fillRect(x,y+8,8,1);}
 const windows=new THREE.CanvasTexture(wallCanvas);windows.colorSpace=THREE.SRGBColorSpace;
 const buildingMat=new THREE.MeshStandardMaterial({map:windows,roughness:.86,metalness:.1});
 const blocks=new THREE.InstancedMesh(box,buildingMat,buildings.length),roofs=new THREE.InstancedMesh(box,mat(0x647071,.1,.8),buildings.length);
 buildings.forEach((b,i)=>{
  unit.position.set(b.x,b.y+b.h/2,b.z);unit.rotation.set(0,0,0);unit.scale.set(b.w,b.h,b.d);unit.updateMatrix();blocks.setMatrixAt(i,unit.matrix);
  blocks.setColorAt(i,new THREE.Color().setHSL(.12+b.shade*.07,.04+b.shade*.08,.55+b.shade*.3));
  unit.position.y=b.y+b.h+1;unit.scale.set(b.w+3,2,b.d+3);unit.updateMatrix();roofs.setMatrixAt(i,unit.matrix);
  if(b.kind==='hangar'){rect(b.x,b.z+b.d/2+55,b.w,110,groundMat);const door=mesh(box,asphalt,[b.x,b.y+26,b.z+b.d/2+.3],[b.w*.88,51,1]);scene.add(door);}
 });scene.add(blocks,roofs);
 const trunkMat=mat(0x59574a,0,1),treeMat=mat(0x3e5143,0,1),treeGeometry=new THREE.ConeGeometry(1,1,6);
 const trees=new THREE.InstancedMesh(treeGeometry,treeMat,150),trunks=new THREE.InstancedMesh(box,trunkMat,150);
 for(let i=0;i<150;i++){const x=1350+(i%5)*590+Math.sin(i*43)*95,z=-3400+Math.floor(i/5)*190,y=terrainHeight(x,z);unit.position.set(x,y+12,z);unit.scale.set(10,23,10);unit.updateMatrix();trees.setMatrixAt(i,unit.matrix);unit.position.y=y+4;unit.scale.set(2,10,2);unit.updateMatrix();trunks.setMatrixAt(i,unit.matrix);}
 scene.add(trees,trunks);
}
export function createWorld(scene){
 const sky=new THREE.Mesh(new THREE.SphereGeometry(40000,32,20),new THREE.ShaderMaterial({
  side:THREE.BackSide,depthWrite:false,uniforms:{sunDir:{value:new THREE.Vector3(-.65,.32,-.55).normalize()}},
  vertexShader:'varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`precision highp float;varying vec3 v;uniform vec3 sunDir;
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
   void main(){vec3 d=normalize(v);float h=max(d.y,0.);vec3 color=mix(vec3(.65,.54,.57),vec3(.035,.11,.26),pow(h,.36));float s=max(0.,dot(d,sunDir));color+=vec3(1.,.52,.26)*pow(s,24.)*.2+vec3(1.,.8,.6)*pow(s,1600.)*2.;vec2 uv=d.xz/(max(d.y,.03))*2.3;float cloud=noise(uv*.9)*.55+noise(uv*2.)*.28+noise(uv*4.)*.12+noise(uv*8.)*.05;float c=smoothstep(.55,.76,cloud)*smoothstep(.025,.14,d.y);color=mix(color,vec3(.59,.58,.66),c*.5);gl_FragColor=vec4(color,1.);}`
 }));scene.add(sky);
 scene.fog=new THREE.FogExp2(0x827e91,.000047);
 scene.add(new THREE.HemisphereLight(0xa9c8ee,0x4e4540,2.3));
 const sun=new THREE.DirectionalLight(0xffd4aa,2.6);sun.position.set(-4000,5000,-4000);scene.add(sun);
 const seaMat=new THREE.ShaderMaterial({uniforms:{time:{value:0},eye:{value:new THREE.Vector3()},fogColor:{value:new THREE.Color(0x827e91)}},
 vertexShader:`varying vec3 world;void main(){world=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}`,
 fragmentShader:`precision highp float;varying vec3 world;uniform float time;uniform vec3 eye;uniform vec3 fogColor;void main(){vec2 p=world.xz;float n=sin(p.x*.028+time*.9)*cos(p.y*.021-time*.5);float n2=sin(p.x*.11+p.y*.09+time*1.5);vec3 normal=normalize(vec3(n*.09+n2*.028,1.,cos(p.x*.035-p.y*.024+time)*.12));vec3 view=normalize(eye-world);vec3 light=normalize(vec3(-.65,.32,-.55));float spec=pow(max(dot(normal,normalize(view+light)),0.),100.);float fres=pow(1.-max(view.y,0.),3.);vec3 color=mix(vec3(.022,.19,.245),vec3(.36,.55,.65),fres);color+=vec3(1.,.85,.58)*spec*.95;color+=n*.008;float mist=1.-exp(-length(eye-world)*.000082);color=mix(color,fogColor,mist);gl_FragColor=vec4(color,1.);}`});
 const sea=new THREE.Mesh(new THREE.PlaneGeometry(90000,90000),seaMat);sea.rotation.x=-Math.PI/2;sea.position.y=-2;scene.add(sea);
 const g=new THREE.PlaneGeometry(16000,19500,176,196);g.rotateX(-Math.PI/2);const pos=g.attributes.position,colors=[];
 for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i)-1400,y=terrainHeight(x,z);pos.setXYZ(i,x,y,z);const c=new THREE.Color(y<25?0xa29376:y>120?0x716c57:0x707659);c.multiplyScalar(.91+noise(x*.003,z*.003)*.08+noise(x*.035,z*.035)*.025);colors.push(c.r,c.g,c.b);}
 g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();scene.add(new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.98,metalness:0})));
 createAirfield(scene);
 return {sky,seaMat,sun};
}
