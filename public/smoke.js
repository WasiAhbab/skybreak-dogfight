import * as THREE from 'three';

export function createSmoke(scene) {
  const capacity=700, pool=[];
  const positions=new Float32Array(capacity*3), colors=new Float32Array(capacity*3);
  const sizes=new Float32Array(capacity), alphas=new Float32Array(capacity);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  geometry.setAttribute('size',new THREE.BufferAttribute(sizes,1));
  geometry.setAttribute('alpha',new THREE.BufferAttribute(alphas,1));
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,vertexColors:true,
    uniforms:{resolution:{value:innerHeight}},
    vertexShader:`attribute float size;attribute float alpha;uniform float resolution;varying vec3 tint;varying float opacity;
      void main(){tint=color;opacity=alpha;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(size*resolution/max(-mv.z,1.),1.,170.);}`,
    fragmentShader:`varying vec3 tint;varying float opacity;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;gl_FragColor=vec4(tint,opacity*pow(1.-r,1.7));}`});
  const points=new THREE.Points(geometry,material);points.frustumCulled=false;points.renderOrder=2;scene.add(points);
  return {
    emit(position,dark=false,scale=1){if(pool.length>=capacity)return;pool.push({p:position.clone(),age:0,life:dark?3.6:2.1,scale,dark,drift:(Math.random()-.5)*4});},
    clear(){pool.length=0;geometry.setDrawRange(0,0);},
    update(dt,pixelHeight){
      material.uniforms.resolution.value=pixelHeight;
      for(let i=pool.length-1;i>=0;i--){const p=pool[i];p.age+=dt;if(p.age>=p.life){pool.splice(i,1);continue;}p.p.y+=dt*(p.dark?7:1.5);p.p.x+=dt*p.drift;}
      pool.forEach((p,i)=>{p.p.toArray(positions,i*3);const age=p.age/p.life,c=p.dark?.11:.73;colors[i*3]=c;colors[i*3+1]=c;colors[i*3+2]=c+(p.dark?.025:.055);sizes[i]=(2+p.age*11)*p.scale;alphas[i]=(1-age)*(p.dark?.8:.4);});
      geometry.setDrawRange(0,pool.length);for(const a of Object.values(geometry.attributes))a.needsUpdate=true;
    },
  };
}
