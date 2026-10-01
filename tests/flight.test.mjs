import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clamp,damp,segmentDistanceSq,lockStep,steeringInput,homingDirection} from '../public/flight-math.js';

const near=(actual,expected,epsilon=1e-8)=>assert.ok(Math.abs(actual-expected)<epsilon,`${actual} ≠ ${expected}`);

test('swept collisions detect a jet between missile frames',()=>{
 near(segmentDistanceSq({x:5,y:2,z:0},{x:0,y:0,z:0},{x:10,y:0,z:0}),4);
});
test('swept collisions clamp to segment endpoints',()=>{
 near(segmentDistanceSq({x:15,y:3,z:0},{x:0,y:0,z:0},{x:10,y:0,z:0}),34);
});
test('stationary missile collision remains finite',()=>{
 near(segmentDistanceSq({x:1,y:2,z:2},{x:0,y:0,z:0},{x:0,y:0,z:0}),9);
});
test('lock requires sustained aim and cannot exceed one',()=>{
 let lock=0;for(let i=0;i<45;i++)lock=lockStep(lock,true,1/60);
 near(lock,1);near(lockStep(lock,true,1),1);
});
test('lost aim decays the lock and cannot become negative',()=>{
 near(lockStep(1,false,.25),.45);near(lockStep(.1,false,1),0);
});
test('smoothing is independent of frame subdivision',()=>{
 const one=damp(0,10,4,1);let sixty=0;for(let i=0;i<60;i++)sixty=damp(sixty,10,4,1/60);near(one,sixty);
});
test('steering dead zone prevents center drift',()=>{
 near(steeringInput(.03),0);near(steeringInput(-.03),0);near(steeringInput(1),1);near(steeringInput(-1),-1);
});
test('homing rotates toward target at a bounded rate',()=>{
 const dir=homingDirection({x:0,y:0,z:-1},{x:1,y:0,z:0},1,.1);
 near(Math.acos(-dir.z),.1);assert.ok(dir.x>0);near(Math.hypot(dir.x,dir.y,dir.z),1);
});
test('homing arrives without overshooting close headings',()=>{
 const dir=homingDirection({x:0,y:0,z:-1},{x:.1,y:0,z:-1},3,1);
 near(dir.x,.1/Math.hypot(.1,1));near(dir.z,-1/Math.hypot(.1,1));
});
test('opposite headings never produce NaN',()=>{
 const dir=homingDirection({x:0,y:0,z:-1},{x:0,y:0,z:1},1,.1);
 near(Math.hypot(dir.x,dir.y,dir.z),1);near(Math.acos(-dir.z),.1);
});
test('zero target distance keeps the current heading',()=>{
 assert.deepEqual(homingDirection({x:0,y:1,z:0},{x:0,y:0,z:0},3,.016),{x:0,y:1,z:0});
});
test('guided missile intercepts a moving target in a simulated chase',()=>{
 let p={x:0,y:700,z:0},heading={x:0,y:0,z:-1},enemy={x:150,y:740,z:-1200};let intercepted=false;
 for(let i=0;i<60*13;i++){
  const dt=1/60;enemy.z-=112*dt;enemy.x+=15*dt;
  heading=homingDirection(heading,{x:enemy.x-p.x,y:enemy.y-p.y,z:enemy.z-p.z},3,dt);
  const next={x:p.x+heading.x*390*dt,y:p.y+heading.y*390*dt,z:p.z+heading.z*390*dt};
  if(segmentDistanceSq(enemy,p,next)<16**2){intercepted=true;break;}p=next;
 }
 assert.ok(intercepted,'tracking missile should hit within its fuel lifetime');
});
test('resource meters remain within bounds',()=>{near(clamp(-12,0,100),0);near(clamp(130,0,100),100);});
