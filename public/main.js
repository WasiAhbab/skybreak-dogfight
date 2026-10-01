import * as THREE from 'three';
import {makeJet,makeMissile,createWorld} from './world.js';
import {clamp,damp,segmentDistanceSq,lockStep,steeringInput,homingDirection} from './flight-math.js';
import {collisionHeight,worldSegmentHit} from './arena-layout.js';
import {integrateFlight} from './flight-controller.js';
import {drawCombatHUD,scopeRadius} from './combat-hud.js';
import {createSmoke} from './smoke.js';

const $=id=>document.getElementById(id);
const canvas=$('world'),hud=$('hud'),ctx=hud.getContext('2d');
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}
catch(error){$('error-panel').hidden=false;$('error-text').textContent='WebGL 2 could not start. Enable graphics acceleration in your browser and try again.';throw error;}
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,1,70000);
const world=createWorld(scene),player=makeJet();scene.add(player);
const FORWARD=new THREE.Vector3(0,0,-1),UP=new THREE.Vector3(0,1,0);
const flightOrientation=new THREE.Quaternion(),cameraUp=new THREE.Vector3(0,1,0),smoke=createSmoke(scene);
const state={mode:'menu',yaw:0,pitch:0,bank:0,speed:135,hp:100,boost:100,flares:4,flareRecharge:0,flareCooldown:0,ammo:12,reload:0,cooldown:0,kills:0,shots:0,hits:0,time:0,lock:0,target:null,noticeTime:0,damage:0,boosting:false,rollTime:0,rollCooldown:0,view:0,difficulty:'ace',muted:false};
const aim=new THREE.Vector2(),keys=new Set();
let sensitivity=1,inverted=false,touchBoost=false,touchMode=matchMedia('(pointer:coarse)').matches;
const reducedMotion=matchMedia('(prefers-reduced-motion:reduce)').matches;
let width=innerWidth,height=innerHeight,frameCount=0,fps=60,lastFps=performance.now(),last=performance.now(),clock=0,enemyId=0,nextEnemy=0,beepTimer=0;
let enemies=[],missiles=[],particles=[];
let audio=null,master=null,engine=null,engineGain=null;
const particleCount=1800,particlePositions=new Float32Array(particleCount*3),particleColors=new Float32Array(particleCount*3);
const particleGeo=new THREE.BufferGeometry();particleGeo.setAttribute('position',new THREE.BufferAttribute(particlePositions,3));particleGeo.setAttribute('color',new THREE.BufferAttribute(particleColors,3));
const particleMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,vertexColors:true,blending:THREE.AdditiveBlending,uniforms:{pixelRatio:{value:Math.min(devicePixelRatio,1.7)}},vertexShader:'varying vec3 c;uniform float pixelRatio;void main(){c=color;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(2400./max(1.,-mv.z),1.,40.)*pixelRatio;gl_Position=projectionMatrix*mv;}',fragmentShader:'varying vec3 c;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;gl_FragColor=vec4(c,(1.-d)*(1.-d)*.85);}'});
const sparks=new THREE.Points(particleGeo,particleMat);sparks.frustumCulled=false;scene.add(sparks);
const lookMatrix=new THREE.Matrix4(),tempQ=new THREE.Quaternion();

function resize(){width=innerWidth;height=innerHeight;const ratio=Math.min(devicePixelRatio,$('quality').value==='performance'?1:1.7);renderer.setPixelRatio(ratio);renderer.setSize(width,height);hud.width=width*ratio;hud.height=height*ratio;hud.style.width=width+'px';hud.style.height=height+'px';ctx.setTransform(ratio,0,0,ratio,0,0);camera.aspect=width/height;camera.updateProjectionMatrix();particleMat.uniforms.pixelRatio.value=ratio;}
function orient(object,direction,bank=0){lookMatrix.lookAt(object.position,object.position.clone().add(direction),UP);object.quaternion.setFromRotationMatrix(lookMatrix);if(bank)object.rotateZ(bank);}
function direction(){return FORWARD.clone().applyQuaternion(flightOrientation);}
function rightVector(){return new THREE.Vector3(1,0,0).applyQuaternion(flightOrientation);}
function announce(message,seconds=3){$('notice').textContent=message;$('notice').style.opacity='1';state.noticeTime=seconds;}
function initAudio(){
 if(audio){audio.resume();return;}
 try{audio=new (window.AudioContext||window.webkitAudioContext)();master=audio.createGain();master.gain.value=state.muted?0:.22;master.connect(audio.destination);
 engine=audio.createOscillator();engine.type='sawtooth';engine.frequency.value=48;const low=audio.createBiquadFilter();low.type='lowpass';low.frequency.value=220;engineGain=audio.createGain();engineGain.gain.value=.06;engine.connect(low);low.connect(engineGain);engineGain.connect(master);engine.start();}catch{}
}
function tone(freq,length=.12,vol=.2,type='sine'){if(!audio||!master||state.muted)return;const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,audio.currentTime);g.gain.setValueAtTime(vol,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+length);o.connect(g);g.connect(master);o.start();o.stop(audio.currentTime+length);}
function boom(){if(!audio||state.muted)return;const buffer=audio.createBuffer(1,audio.sampleRate*.6,audio.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,2);const src=audio.createBufferSource(),filter=audio.createBiquadFilter(),g=audio.createGain();src.buffer=buffer;filter.type='lowpass';filter.frequency.value=700;g.gain.value=.65;src.connect(filter);filter.connect(g);g.connect(master);src.start();}
function addParticle(pos,velocity,life,color){if(particles.length>=particleCount)return;particles.push({p:pos.clone(),v:velocity.clone(),life,max:life,c:new THREE.Color(color)});}
function explosion(pos,big=false){for(let i=0;i<(big?12:4);i++)smoke.emit(pos.clone().add(new THREE.Vector3((Math.random()-.5)*12,(Math.random()-.5)*12,(Math.random()-.5)*12)),true,big?3:1.5);for(let i=0;i<(big?100:36);i++){const v=new THREE.Vector3(Math.random()-.5,Math.random()-.3,Math.random()-.5).normalize().multiplyScalar(15+Math.random()*100);addParticle(pos,v,.4+Math.random()*1.1,i%3===0?0xffe4a3:0xff6c20);}boom();}
function clearMissile(m){scene.remove(m.mesh,m.trail);m.trail.geometry.dispose();m.trail.material.dispose();}
function resetEntities(){for(const e of enemies)scene.remove(e.mesh);for(const m of missiles)clearMissile(m);enemies=[];missiles=[];particles=[];smoke.clear();}
function spawnEnemy(ahead=true){
 const mesh=makeJet(true);scene.add(mesh);
 const id=++enemyId,index=enemies.length;
 if(ahead){mesh.position.copy(player.position).addScaledVector(direction(),480+index*160).addScaledVector(rightVector(),(index-1)*150);mesh.position.y+=index*35-35;}
 else{const angle=Math.random()*Math.PI*2;mesh.position.copy(player.position).add(new THREE.Vector3(Math.sin(angle)*1300,80+Math.random()*180,Math.cos(angle)*1300));}
 mesh.position.y=Math.max(mesh.position.y,collisionHeight(mesh.position.x,mesh.position.z)+190);
 const dir=ahead?direction():player.position.clone().sub(mesh.position).normalize();orient(mesh,dir);
 enemies.push({id,mesh,dir,velocity:dir.clone().multiplyScalar(115),hp:100,age:0,fire:12+index*5,evade:0,flareAt:0,phase:Math.random()*6.28,bank:0});
}
function launch(){
 initAudio();resetEntities();Object.assign(state,{mode:'playing',yaw:0,pitch:0,bank:0,speed:135,hp:100,boost:100,flares:4,flareRecharge:0,flareCooldown:0,ammo:12,reload:0,cooldown:0,kills:0,shots:0,hits:0,time:0,lock:0,target:null,damage:0,boosting:false,rollTime:0,rollCooldown:0,view:0,difficulty:$('difficulty').value});
 keys.clear();aim.set(0,0);player.visible=true;player.position.set(-200,440,2400);player.quaternion.identity();flightOrientation.identity();cameraUp.copy(UP);enemyId=0;player.userData.body.rotation.z=0;
 camera.position.set(-200,451,2435);camera.up.copy(UP);camera.lookAt(-200,440,2000);camera.fov=65;camera.updateProjectionMatrix();
 $('menu').hidden=true;$('pause-panel').hidden=true;$('end-panel').hidden=true;$('flight-ui').hidden=false;$('pause').hidden=false;$('touch-controls').hidden=!touchMode;document.body.classList.add('playing');$('kills').textContent='00';$('wave').textContent='SORTIE 01';nextEnemy=7;
 spawnEnemy();spawnEnemy();spawnEnemy();announce('HOLD A TARGET IN THE RING · RED MEANS LOCKED',6);canvas.focus();resize();
}
function pause(){if(state.mode!=='playing')return;state.mode='paused';keys.clear();touchBoost=false;$('pause-panel').hidden=false;$('resume').focus();}
function resume(){if(state.mode!=='paused')return;state.mode='playing';$('pause-panel').hidden=true;aim.set(0,0);last=performance.now();canvas.focus();}
function hangar(){resetEntities();state.mode='menu';state.target=null;state.lock=0;player.visible=true;$('menu').hidden=false;$('pause-panel').hidden=true;$('end-panel').hidden=true;$('flight-ui').hidden=true;$('pause').hidden=true;$('touch-controls').hidden=true;document.body.classList.remove('playing');keys.clear();state.damage=0;$('damage').style.opacity=0;state.noticeTime=0;$('notice').style.opacity=0;player.userData.body.rotation.z=0;$('launch').focus();}
function finish(reason){
 if(state.mode!=='playing')return;state.mode='ended';explosion(player.position,true);player.visible=false;keys.clear();$('end-panel').hidden=false;$('touch-controls').hidden=true;$('pause').hidden=true;
 $('end-reason').textContent=reason;$('end-kills').textContent=state.kills;$('end-time').textContent=Math.floor(state.time/60)+':'+String(Math.floor(state.time%60)).padStart(2,'0');
 let best=state.kills;try{best=Math.max(best,Number(localStorage.getItem('skybreak-best')||0));localStorage.setItem('skybreak-best',String(best));}catch{}$('best').textContent=best;$('retry').focus();
}
function missile(owner,pos,dir,target=null){
 const mesh=makeMissile(owner==='enemy');mesh.position.copy(pos);orient(mesh,dir);scene.add(mesh);
 const trailPos=new Float32Array(50*3);for(let i=0;i<50;i++)pos.toArray(trailPos,i*3);
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(trailPos,3));
 const trail=new THREE.Line(geo,new THREE.LineBasicMaterial({color:owner==='enemy'?0xffca90:0xe7fff6,transparent:true,opacity:.63,depthWrite:false}));trail.frustumCulled=false;scene.add(trail);
 missiles.push({owner,mesh,dir:dir.clone(),target,age:0,speed:owner==='player'?390:285,trail,decoy:null,smokeTime:0});
}
function fire(){
 if(state.mode!=='playing'||state.cooldown>0||state.ammo<2)return;
 state.cooldown=.48;state.ammo-=2;state.shots+=2;if(state.ammo===0)state.reload=3.2;
 const dir=direction(),down=new THREE.Vector3(0,-1,0).applyQuaternion(flightOrientation);
 const target=state.lock>=1&&state.target?state.target:null;
 for(const side of [-1,1]){
  const pos=player.position.clone().addScaledVector(dir,5).addScaledVector(rightVector(),side*4).add(down);
  missile('player',pos,dir,target);
 }
 tone(130,.3,.3,'sawtooth');
 announce(target?'DUAL MISSILES AWAY · TRACKING':'NO LOCK · ROCKETS FLY STRAIGHT',1.3);
}
function flares(){
 if(state.mode!=='playing'||state.flares<=0||state.flareCooldown>0)return;
 state.flares--;state.flareCooldown=2.5;tone(280,.16,.18,'triangle');
 const decoy=player.position.clone();let diverted=0;for(const m of missiles)if(m.owner==='enemy'&&!m.decoy&&m.mesh.position.distanceTo(player.position)<2500){m.decoy=decoy.clone();m.target=null;diverted++;}
 for(let i=0;i<44;i++){const v=direction().multiplyScalar(-30).add(new THREE.Vector3((Math.random()-.5)*150,(Math.random()-.6)*70,(Math.random()-.5)*110));addParticle(player.position,v,2+Math.random()*2,0xffedab);}
 announce(diverted?'COUNTERMEASURES · '+diverted+' SEEKER'+(diverted===1?'':'S')+' DECOYED':'FLARES DEPLOYED · NO SEEKERS IN RANGE',2);
}
function damage(amount){state.hp=Math.max(0,state.hp-amount);state.damage=1;if(state.hp<=0)finish('An enemy missile destroyed your aircraft. Use F to deploy flares when the incoming warning appears.');}
function killEnemy(e){const index=enemies.indexOf(e);if(index<0)return;explosion(e.mesh.position,true);scene.remove(e.mesh);enemies.splice(index,1);if(state.target===e){state.target=null;state.lock=0;}state.kills++;$('kills').textContent=String(state.kills).padStart(2,'0');$('wave').textContent='SORTIE '+String(1+Math.floor(state.kills/3)).padStart(2,'0');announce('SPLASH ONE · TARGET DESTROYED',3);tone(880,.15,.25);nextEnemy=3.5;}
function updateLock(dt){
 const aimPoint=new THREE.Vector2((aim.x*.5+.5)*width,(-aim.y*.5+.5)*height);let candidate=null,best=Infinity;
 for(const e of enemies){const p=e.mesh.position.clone().project(camera),distance=e.mesh.position.distanceTo(player.position);if(p.z>1||p.z<0||distance>4200)continue;const d=Math.hypot((p.x*.5+.5)*width-aimPoint.x,(-p.y*.5+.5)*height-aimPoint.y);const radius=scopeRadius(width,height);if(d<radius&&d<best&&!worldSegmentHit(player.position,e.mesh.position)){best=d;candidate=e;}}
 if(candidate!==state.target){state.target=candidate;state.lock=0;}
 state.lock=lockStep(state.lock,Boolean(candidate),dt);
 beepTimer-=dt;if(candidate&&beepTimer<=0){tone(state.lock>=1?1100:600,.05,.095);beepTimer=state.lock>=1?.65:.18;}
}
function updatePlayer(dt){
 const yawInput=steeringInput(aim.x)*sensitivity+(keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0)+(keys.has('KeyE')?1:0)-(keys.has('KeyQ')?1:0);
 const pitchInput=steeringInput(aim.y)*sensitivity*(inverted?-1:1)+(keys.has('ArrowUp')?1:0)-(keys.has('ArrowDown')?1:0);
 let rollInput=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0);
 state.boosting=(keys.has('ShiftLeft')||keys.has('ShiftRight')||touchBoost)&&state.boost>2;
 const targetSpeed=state.boosting?275:keys.has('KeyS')?105:keys.has('KeyW')?185:135;
 state.speed=damp(state.speed,targetSpeed,1.8,dt);state.boost=clamp(state.boost+(state.boosting?-24:13)*dt,0,100);
 if(state.rollTime>0&&dt>0){const step=Math.min(dt,state.rollTime);rollInput+=Math.PI*2/(1.1*2.35)*step/dt;state.rollTime=Math.max(0,state.rollTime-dt);}
 integrateFlight(flightOrientation,{pitch:pitchInput,yaw:yawInput,roll:rollInput},state.speed,dt);
 const dir=direction(),previous=player.position.clone();
 state.yaw=Math.atan2(dir.x,-dir.z);state.pitch=Math.asin(clamp(dir.y,-1,1));
 state.bank=damp(state.bank,-yawInput*.78,9,dt);
 player.quaternion.copy(flightOrientation);player.userData.body.rotation.z=state.bank;
 player.position.addScaledVector(dir,state.speed*dt);
 for(const flame of player.userData.flames)flame.scale.y=(state.boosting?2:1)*(.9+Math.random()*.2);
 state.cooldown=Math.max(0,state.cooldown-dt);state.flareCooldown=Math.max(0,state.flareCooldown-dt);state.rollCooldown=Math.max(0,state.rollCooldown-dt);
 if(state.reload>0){state.reload-=dt;if(state.reload<=0){state.ammo=12;announce('MISSILE RACK REARMED',1.4);}}
 if(state.flares<4){state.flareRecharge+=dt;if(state.flareRecharge>=9){state.flares++;state.flareRecharge=0;}}
 if(worldSegmentHit(previous,player.position,5)){finish('Terrain collision. Watch your altitude and pull up before the ground warning.');return;}
 if(player.position.y>4200||Math.hypot(player.position.x,player.position.z)>12500){
  const home=new THREE.Vector3(0,850,0).sub(player.position).normalize();
  lookMatrix.lookAt(player.position,player.position.clone().add(home),UP);tempQ.setFromRotationMatrix(lookMatrix);flightOrientation.rotateTowards(tempQ,dt*.6);
  announce('FLIGHT LIMIT · RETURNING TO COMBAT',.5);
 }
 if(state.hp<35&&Math.random()<dt*18)smoke.emit(player.position,true,1.2);
 if(Math.abs(yawInput)>.6&&Math.random()<dt*24)for(const s of [-1,1])smoke.emit(player.position.clone().addScaledVector(rightVector(),8*s),false,.22);
}
function updateEnemies(dt){
 for(const e of [...enemies]){
  e.age+=dt;e.fire-=dt;e.flareAt-=dt;
  const pos=e.mesh.position,delta=player.position.clone().sub(pos),dist=delta.length();
  let desired;
  if(e.age<16){desired=new THREE.Vector3(Math.sin(e.age*.11+e.phase)*.3,Math.sin(e.age*.3+e.phase)*.09,-1).normalize();}
  else if(dist<260){desired=pos.clone().sub(player.position).add(new THREE.Vector3(Math.sin(e.phase)*350,160,Math.cos(e.phase)*350)).normalize();}
  else{desired=delta.addScaledVector(direction(),state.speed*.9).add(new THREE.Vector3(Math.sin(clock*.4+e.phase)*180,Math.sin(clock*.3+e.phase)*150,Math.cos(clock*.3+e.phase)*160)).normalize();}
  const ahead=pos.clone().addScaledVector(e.dir,300);const safeY=Math.max(collisionHeight(pos.x,pos.z),collisionHeight(ahead.x,ahead.z))+160;if(pos.y<safeY)desired.y=Math.max(desired.y,.6);if(pos.y>3000)desired.y=-.5;desired.normalize();
  const old=e.dir.clone();const turn=state.difficulty==='veteran'?1.5:state.difficulty==='rookie'?.6:1;
  lookMatrix.lookAt(pos,pos.clone().add(desired),UP);tempQ.setFromRotationMatrix(lookMatrix);e.mesh.quaternion.rotateTowards(tempQ,dt*turn);
  e.dir.copy(FORWARD).applyQuaternion(e.mesh.quaternion);e.velocity.copy(e.dir).multiplyScalar(112+Math.sin(e.phase)*10+Math.min(state.kills,12)*1.5);pos.addScaledVector(e.velocity,dt);
  e.bank=damp(e.bank,clamp(old.clone().cross(e.dir).y/dt*1.2,-1.1,1.1),3,dt);e.mesh.userData.body.rotation.z=e.bank;
  if(e.age>10&&e.fire<=0&&dist<2500&&dist>250&&e.dir.dot(player.position.clone().sub(pos).normalize())>.65){const shot=player.position.clone().sub(pos).normalize();missile('enemy',pos.clone().addScaledVector(shot,12),shot,player);e.fire=state.difficulty==='veteran'?6:state.difficulty==='rookie'?22:13;tone(190,.18,.25,'square');announce('MISSILE INBOUND · F TO DEPLOY FLARES',2);}
  if(state.difficulty==='veteran'&&e.flareAt<=0){const incoming=missiles.find(m=>m.owner==='player'&&m.target===e&&m.mesh.position.distanceTo(pos)<230);if(incoming){incoming.decoy=pos.clone().add(new THREE.Vector3(90,-40,30));incoming.target=null;e.flareAt=16;for(let i=0;i<12;i++)addParticle(pos,new THREE.Vector3((Math.random()-.5)*90,-20,(Math.random()-.5)*90),1.5,0xffedab);}}
  if(dist<15){killEnemy(e);damage(65);}if(dist>18000){pos.copy(player.position).add(new THREE.Vector3(800,300,-2100));}
 }
 nextEnemy-=dt;if(enemies.length<3&&nextEnemy<=0){spawnEnemy(false);nextEnemy=5;}
}
function updateMissiles(dt){
 for(let i=missiles.length-1;i>=0;i--){
  const m=missiles[i];m.age+=dt;const pos=m.mesh.position,previous=pos.clone();let targetPos=null;
  if(m.decoy)targetPos=m.decoy.clone();
  else if(m.owner==='enemy')targetPos=player.position.clone().addScaledVector(direction(),state.speed*.23);
  else if(m.target&&enemies.includes(m.target))targetPos=m.target.mesh.position.clone().addScaledVector(m.target.velocity,.18);
  else if(m.target){m.target=null;}
  // Unlocked launches stay unguided. A destroyed target cannot retarget magically.
  if(targetPos){const desired=targetPos.sub(pos).normalize();m.dir.copy(homingDirection(m.dir,desired,m.owner==='player'?3:1.05,dt));}
  pos.addScaledVector(m.dir,m.speed*dt);orient(m.mesh,m.dir);
  m.smokeTime+=dt;if(m.smokeTime>.035){smoke.emit(pos,false,.52);m.smokeTime=0;}
  const array=m.trail.geometry.attributes.position.array;array.copyWithin(3,0,array.length-3);pos.toArray(array,0);m.trail.geometry.attributes.position.needsUpdate=true;
  let hit=false;const blocked=worldSegmentHit(previous,pos);
  if(!blocked&&m.owner==='player'){for(const e of [...enemies])if(segmentDistanceSq(e.mesh.position,previous,pos)<16*16){e.hp-=100;state.hits++;killEnemy(e);hit=true;break;}}
  else if(!blocked&&m.owner==='enemy'&&state.mode==='playing'&&segmentDistanceSq(player.position,previous,pos)<12*12){explosion(pos);damage(state.difficulty==='rookie'?20:35);hit=true;}
  if(m.decoy&&pos.distanceTo(m.decoy)<25)hit=true;
  if(hit||m.age>13||blocked){if(!hit&&m.age<=13)explosion(pos);clearMissile(m);missiles.splice(i,1);}
 }
}
function updateParticles(dt){
 for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;if(p.life<=0){particles.splice(i,1);continue;}p.v.multiplyScalar(Math.exp(-dt*.7));p.v.y-=dt*8;p.p.addScaledVector(p.v,dt);}
 particles.forEach((p,i)=>{p.p.toArray(particlePositions,i*3);const fade=p.life/p.max;particleColors[i*3]=p.c.r*fade;particleColors[i*3+1]=p.c.g*fade;particleColors[i*3+2]=p.c.b*fade;});
 particleGeo.setDrawRange(0,particles.length);particleGeo.attributes.position.needsUpdate=true;particleGeo.attributes.color.needsUpdate=true;
}
function updateCamera(dt){
 const dir=direction(),up=UP.clone().applyQuaternion(flightOrientation);
 const desired=player.position.clone().addScaledVector(dir,state.view===1?-72:-35).addScaledVector(up,state.view===1?22:11);
 // Predict the translational step so speed does not stretch the chase distance.
 camera.position.addScaledVector(dir,state.speed*dt).lerp(desired,1-Math.exp(-10*dt));
 cameraUp.lerp(up,1-Math.exp(-(reducedMotion?12:4)*dt)).normalize();camera.up.copy(cameraUp);
 camera.lookAt(player.position.clone().addScaledVector(dir,230));
 camera.fov=damp(camera.fov,state.boosting&&!reducedMotion?73:65,3,dt);camera.updateProjectionMatrix();
}
function menuScene(dt){
 player.position.set(0,780,0);player.rotation.set(.03,(reducedMotion?0:clock*.055)+.65,-.12);player.userData.body.rotation.z=0;
 camera.up.copy(UP);camera.position.set(30,796,38);camera.lookAt(-5,779,-4);camera.fov=48;camera.updateProjectionMatrix();
 for(const f of player.userData.flames)f.scale.y=.8+Math.sin(clock*14)*.1;
}
function drawHUD(){
 drawCombatHUD(ctx,{state,player,camera,aim,enemies,missiles,width,height,clock,fps,touchMode});
}
function tick(now){
 requestAnimationFrame(tick);const dt=clamp((now-last)/1000,0,.035);last=now;clock+=dt;
 if(state.mode==='menu')menuScene(dt);
 else if(state.mode==='playing'){
  state.time+=dt;updatePlayer(dt);if(state.mode==='playing'){updateEnemies(dt);updateMissiles(dt);updateCamera(dt);updateLock(dt);}
  if(keys.has('Space'))fire();
  if(state.noticeTime>0){state.noticeTime-=dt;if(state.noticeTime<=0)$('notice').style.opacity='0';}
  state.damage=Math.max(0,state.damage-dt*1.2);$('damage').style.opacity=state.damage*.8;
 }
 if(state.mode!=='paused'){updateParticles(dt);smoke.update(dt,hud.height);}
 world.sky.position.copy(camera.position);world.seaMat.uniforms.time.value=clock;world.seaMat.uniforms.eye.value.copy(camera.position);
 if(engine&&audio){engine.frequency.setTargetAtTime(state.mode==='playing'?40+state.speed*.15:40,audio.currentTime,.2);engineGain.gain.setTargetAtTime(state.mode==='playing'?.11:.035,audio.currentTime,.2);}
 renderer.render(scene,camera);drawHUD();frameCount++;if(now-lastFps>500){fps=frameCount*1000/(now-lastFps);frameCount=0;lastFps=now;
  $('flight-telemetry').textContent=state.mode==='menu'?'In the hangar. Choose opposition and launch a sortie.':`Seeker: ${state.lock>=1?'locked':state.target?'acquiring':'searching'}. Airframe: ${state.hp}%. Missiles: ${state.ammo}. Flares: ${state.flares}. Speed: ${Math.round(state.speed*3.6)} km/h. Altitude: ${Math.round(player.position.y)} m. Flight time: ${Math.floor(state.time)} seconds.`;
 }
}
window.addEventListener('resize',resize);
window.addEventListener('keydown',e=>{
 if(e.code==='Escape'){if(state.mode==='playing')pause();else if(state.mode==='paused')resume();return;}
 if(['INPUT','SELECT','TEXTAREA','BUTTON','A'].includes(e.target.tagName))return;
 if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)&&state.mode==='playing')e.preventDefault();
 if(e.repeat)return;keys.add(e.code);if(e.code==='Space')fire();if(e.code==='KeyF')flares();if(e.code==='KeyC'&&state.mode==='playing'){state.view=1-state.view;announce(state.view?'WIDE CHASE CAMERA':'CLOSE CHASE CAMERA',1.2);}if(e.code==='KeyR'&&state.mode==='playing'&&state.rollCooldown<=0){state.rollTime=1.1;state.rollCooldown=3;}
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();touchBoost=false;pause();});
canvas.addEventListener('pointermove',e=>{if(state.mode!=='playing'||e.pointerType==='touch')return;aim.set(clamp((e.clientX/width-.5)*2,-.92,.92),clamp((.5-e.clientY/height)*2,-.85,.85));});
canvas.addEventListener('pointerleave',()=>{if(state.mode==='playing')aim.set(0,0);});
canvas.addEventListener('pointerdown',e=>{canvas.focus();if(e.button===0&&e.pointerType!=='touch')fire();});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
$('launch').onclick=launch;$('pause').onclick=pause;$('resume').onclick=resume;$('restart').onclick=launch;$('retry').onclick=launch;$('return-menu').onclick=hangar;$('hangar').onclick=hangar;
$('quality').onchange=()=>{resize();$('quality-label').textContent=$('quality').value==='high'?'HIGH FIDELITY':'PERFORMANCE';};
$('invert').onchange=e=>inverted=e.target.checked;$('sensitivity').oninput=e=>sensitivity=Number(e.target.value);
$('sound').onclick=()=>{state.muted=!state.muted;if(master)master.gain.value=state.muted?0:.22;$('sound').textContent=state.muted?'SOUND OFF':'SOUND ON';};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{announce('USE YOUR BROWSER FULLSCREEN CONTROL',3);}};
const stick=$('joystick');function stickMove(e){const r=stick.getBoundingClientRect();aim.set(clamp((e.clientX-r.left-55)/50,-1,1),clamp((55-e.clientY+r.top)/50,-1,1));stick.firstElementChild.style.transform='translate('+aim.x*30+'px,'+(-aim.y*30)+'px)';}
stick.onpointerdown=e=>{stick.setPointerCapture(e.pointerId);stickMove(e);};stick.onpointermove=e=>{if(stick.hasPointerCapture(e.pointerId))stickMove(e);};const release=()=>{aim.set(0,0);stick.firstElementChild.style.transform='none';};stick.onpointerup=release;stick.onpointercancel=release;
$('touch-fire').onpointerdown=e=>{e.preventDefault();fire();};$('touch-flare').onpointerdown=e=>{e.preventDefault();flares();};$('touch-boost').onpointerdown=e=>{e.preventDefault();e.target.setPointerCapture(e.pointerId);touchBoost=true;};$('touch-boost').onpointerup=()=>touchBoost=false;$('touch-boost').onpointercancel=()=>touchBoost=false;
canvas.tabIndex=-1;canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();pause();$('error-panel').hidden=false;$('error-text').textContent='The graphics context was interrupted. Reload to restart the flight system.';});
resize();menuScene(0);renderer.compile(scene,camera);$('launch').disabled=false;$('launch-text').textContent='LAUNCH SORTIE';$('start-note').textContent=touchMode?'Touch controls appear when you launch. Landscape recommended.':'Mouse + keyboard recommended · R for a barrel roll · Esc to pause';
requestAnimationFrame(tick);
