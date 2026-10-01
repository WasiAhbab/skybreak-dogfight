import * as THREE from 'three';
import {buildings, roads, runways, collisionHeight} from './arena-layout.js';
import {clamp} from './flight-math.js';

export const scopeRadius=(width,height)=>clamp(Math.min(width,height)*.16,60,125);
const pilotColors=['#e4c957','#79c6e2','#d39aca','#8dce9d','#e99a83'];
const callsigns=['RAVEN','VIPER','NOMAD','GHOST','FALCON'];
export const pilotName=id=>callsigns[(id-1)%callsigns.length]+' · BOT';
export function drawCombatHUD(ctx,{state,player,camera,aim,enemies,missiles,width,height,clock,fps,touchMode}) {
 ctx.clearRect(0,0,width,height);if(state.mode==='menu'||state.mode==='ended')return;
 const small=width<650,cx=width/2,cy=height/2;
 const text=(s,x,y,size=12,color='#f1f1e6',align='center')=>{
  ctx.font=`600 ${size}px Arial, sans-serif`;ctx.textAlign=align;ctx.fillStyle=color;ctx.shadowColor='#050c19';ctx.shadowBlur=3;ctx.shadowOffsetY=1;ctx.fillText(s,x,y);ctx.shadowBlur=0;ctx.shadowOffsetY=0;
 };
 const line=(x,y,x2,y2,color)=>{ctx.strokeStyle=color;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();};
 const ax=(aim.x*.5+.5)*width,ay=(-aim.y*.5+.5)*height,r=scopeRadius(width,height);
 const locked=state.lock>=1,lockColor=locked?'#ff4844':state.target?'#f5d558':'#f4f3ea';
 ctx.lineWidth=small?2:2.8;ctx.strokeStyle=lockColor;
 // Four separated arcs, deliberately open at the cardinal directions.
 for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(ax,ay,r,i*Math.PI/2+.19,(i+1)*Math.PI/2-.19);ctx.stroke();}
 ctx.lineWidth=1;ctx.strokeStyle=lockColor+'80';
 for(let i=0;i<32;i++){const a=i*Math.PI/16;line(ax+Math.cos(a)*18,ay+Math.sin(a)*18,ax+Math.cos(a)*20,ay+Math.sin(a)*20,lockColor+'60');}
 ctx.fillStyle=lockColor;ctx.fillRect(ax-1.5,ay-1.5,3,3);
 if(state.target)text(locked?'LOCKED — FIRE':'ACQUIRING '+Math.floor(state.lock*100)+'%',ax,ay+r+24,10,lockColor);
 if(Math.hypot(ax-cx,ay-cy)>40){ctx.lineWidth=1;line(cx-6,cy,cx+6,cy,'#ffffff50');line(cx,cy-6,cx,cy+6,'#ffffff50');}
 for(const e of enemies){
  const projected=e.mesh.position.clone().project(camera),range=e.mesh.position.distanceTo(player.position);
  const x=(projected.x*.5+.5)*width,y=(-projected.y*.5+.5)*height;
  const color=e===state.target?lockColor:pilotColors[(e.id-1)%pilotColors.length];
  if(projected.z>0&&projected.z<1&&x>24&&x<width-24&&y>70&&y<height-65){
   const radius=e===state.target?25:18;ctx.strokeStyle=color;ctx.lineWidth=e===state.target?1.8:1.2;ctx.beginPath();
   for(let i=0;i<=6;i++){const a=i*Math.PI/3;const px=x+Math.cos(a)*radius,py=y+Math.sin(a)*radius;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.stroke();
   text(Math.round(range)+' m',x,y-radius-8,10,color);text(pilotName(e.id),x,y+radius+15,10,color);
  }else{
   const local=e.mesh.position.clone().sub(camera.position).applyQuaternion(camera.quaternion.clone().invert());
   let dx=local.x,dy=-local.y;if(Math.abs(dx)+Math.abs(dy)<.01){dx=1;dy=1;}const angle=Math.atan2(dy,dx);
   const scale=Math.min((width*.46)/Math.max(Math.abs(Math.cos(angle)),.001),(height*.36)/Math.max(Math.abs(Math.sin(angle)),.001));
   const x=cx+Math.cos(angle)*scale,y=cy+Math.sin(angle)*scale;
   ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-7,-5);ctx.lineTo(2,0);ctx.lineTo(-7,5);ctx.stroke();ctx.restore();
  }
 }
 // Actual world geometry on the round radar, not a decorative scanner.
 const rr=small?66:87,rx=small?91:123,ry=height-(touchMode?270:130),mapScale=rr/3200;
 const map=(x,z)=>{const dx=x-player.position.x,dz=z-player.position.z;return {x:rx+(dx*Math.cos(state.yaw)+dz*Math.sin(state.yaw))*mapScale,y:ry+(-dx*Math.sin(state.yaw)+dz*Math.cos(state.yaw))*mapScale};};
 ctx.save();ctx.beginPath();ctx.arc(rx,ry,rr,0,Math.PI*2);ctx.clip();ctx.fillStyle='#285a70';ctx.fillRect(rx-rr,ry-rr,rr*2,rr*2);
 ctx.save();ctx.translate(rx,ry);ctx.rotate(-state.yaw);ctx.scale(mapScale,mapScale);ctx.translate(-player.position.x,-player.position.z);
 ctx.fillStyle='#8a9770';ctx.beginPath();ctx.ellipse(0,-1400,6600,8100,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#d4c9ad';ctx.strokeStyle='#d4c9ad';ctx.lineWidth=40;for(const road of roads)ctx.fillRect(road.x-road.w/2,road.z-road.d/2,road.w,road.d);
 ctx.fillStyle='#525d60';for(const runway of runways)ctx.fillRect(runway.x-runway.w/2,runway.z-runway.d/2,runway.w,runway.d);
 ctx.fillStyle='#aaa591';for(const b of buildings)ctx.fillRect(b.x-b.w/2,b.z-b.d/2,b.w,b.d);ctx.restore();
 for(const e of enemies){const p=map(e.mesh.position.x,e.mesh.position.z);ctx.fillStyle=e===state.target?lockColor:pilotColors[(e.id-1)%pilotColors.length];ctx.strokeStyle='#111b25';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p.x,p.y-5);ctx.lineTo(p.x-4,p.y+4);ctx.lineTo(p.x+4,p.y+4);ctx.closePath();ctx.fill();ctx.stroke();}
 for(const m of missiles){if(m.owner!=='enemy')continue;const p=map(m.mesh.position.x,m.mesh.position.z);ctx.fillStyle='#f2443d';ctx.fillRect(p.x-2,p.y-2,4,4);}
 ctx.restore();ctx.lineWidth=5;ctx.strokeStyle='#0b111bd9';ctx.beginPath();ctx.arc(rx,ry,rr+1,0,Math.PI*2);ctx.stroke();ctx.lineWidth=1;ctx.strokeStyle='#d8d7c978';ctx.stroke();
 ctx.fillStyle='#faf9e9';ctx.strokeStyle='#111822';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(rx,ry-8);ctx.lineTo(rx-5,ry+6);ctx.lineTo(rx,ry+3);ctx.lineTo(rx+5,ry+6);ctx.closePath();ctx.fill();ctx.stroke();
 text('NORTH POINT',rx,ry+rr+22,10);text('N',rx-Math.sin(state.yaw)*(rr-11),ry-Math.cos(state.yaw)*(rr-11)+4,10,'#fff');
 const bx=width-(small?174:242),by=height-(touchMode?320:144),bw=small?144:206;
 ctx.fillStyle='#0b121cb8';ctx.fillRect(bx-12,by-24,bw+24,114);
 text(Math.round(state.speed*3.6)+'',bx,by,25,'#fff','left');text('KM/H',bx+63,by-1,10,'#c4c6ca','left');text(Math.round(player.position.y)+' M',bx+bw,by,11,'#f2efdf','right');
 ctx.fillStyle='#ffffff23';ctx.fillRect(bx,by+12,bw,8);ctx.fillStyle=state.hp<=35?'#ff733c':'#d93e39';ctx.fillRect(bx,by+12,bw*state.hp/100,8);
 ctx.fillStyle='#ffffff23';ctx.fillRect(bx,by+24,bw,3);ctx.fillStyle=state.boosting?'#aeb6ff':'#8fb1d0';ctx.fillRect(bx,by+24,bw*state.boost/100,3);
 text(state.reload>0?'REARMING '+state.reload.toFixed(1)+'s':'MISSILES '+String(state.ammo).padStart(2,'0')+' / 12',bx,by+49,10,'#edeedf','left');
 text('FLARES '+state.flares+' / 4',bx,by+71,10,'#edeedf','left');text(Math.ceil(state.hp)+'% HP',bx+bw,by+71,10,'#edeedf','right');
 const incoming=missiles.filter(m=>m.owner==='enemy'&&!m.decoy&&m.mesh.position.distanceTo(player.position)<1900).length;
 if(incoming&&Math.sin(clock*8)>.05){text('— WARNING —',cx,Math.max(92,height*.22),12,'#ff6659');text('Incoming missiles · F to deploy flares',cx,Math.max(114,height*.22+22),small?11:14,'#ff6659');}
 if(player.position.y<collisionHeight(player.position.x,player.position.z)+100&&Math.sin(clock*7)>0)text('PULL UP',cx,cy+r+60,22,'#ffc268');
 if(state.boosting)text('AFTERBURNER',cx,height-77,11,'#b6c7ff');
 text(Math.round(fps)+' FPS',width-25,height-19,9,'#bec9d080','right');
}
