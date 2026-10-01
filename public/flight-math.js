export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const damp=(a,b,s,dt)=>a+(b-a)*(1-Math.exp(-s*dt));
export function segmentDistanceSq(point,a,b){
 const x=b.x-a.x,y=b.y-a.y,z=b.z-a.z,den=x*x+y*y+z*z;
 const t=den?clamp(((point.x-a.x)*x+(point.y-a.y)*y+(point.z-a.z)*z)/den,0,1):0;
 return (point.x-a.x-x*t)**2+(point.y-a.y-y*t)**2+(point.z-a.z-z*t)**2;
}
export function lockStep(progress,eligible,dt,seconds=.75){return clamp(progress+(eligible?dt/seconds:-dt*2.2),0,1);}
export function steeringInput(value,deadzone=.045){return Math.abs(value)<deadzone?0:Math.sign(value)*(Math.abs(value)-deadzone)/(1-deadzone);}

// Rotate a unit heading toward another without snapping or exceeding its turn rate.
export function homingDirection(current,desired,rate,dt){
 const length=Math.hypot(desired.x,desired.y,desired.z);if(length<1e-9)return {...current};
 const b={x:desired.x/length,y:desired.y/length,z:desired.z/length};
 const angle=Math.acos(clamp(current.x*b.x+current.y*b.y+current.z*b.z,-1,1));
 const step=Math.max(0,rate*dt);if(angle<=step||angle<1e-8)return b;
 let axis={x:current.y*b.z-current.z*b.y,y:current.z*b.x-current.x*b.z,z:current.x*b.y-current.y*b.x};
 let norm=Math.hypot(axis.x,axis.y,axis.z);
 if(norm<1e-8){axis=Math.abs(current.y)<.9?{x:-current.z,y:0,z:current.x}:{x:0,y:current.z,z:-current.y};norm=Math.hypot(axis.x,axis.y,axis.z);}
 axis={x:axis.x/norm,y:axis.y/norm,z:axis.z/norm};
 const c=Math.cos(step),s=Math.sin(step);
 return {x:current.x*c+(axis.y*current.z-axis.z*current.y)*s,y:current.y*c+(axis.z*current.x-axis.x*current.z)*s,z:current.z*c+(axis.x*current.y-axis.y*current.x)*s};
}
