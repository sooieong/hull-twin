/* =========================================================
   선미 부가물 형상 (단순 형상, 치수는 data/baseline.js STERN_GEAR): 프로펠러(허브·축·날개) · 러더
   스케그는 선체 외판의 일부라 여기 없다 (hull.js, HULL_FORM.skeg). 모두 수동 측정 구역(x −5 … 10 m)이라 히트맵·측정 경로가 없다.
   3D 화면이 재질·빗금·윤곽선을 입히고 (main.js), 보고서 3D 그림도 같은 형상을 선체 색으로 그린다 (report/render3d.js).
   three.js 좌표: x = X − XC, y = Z, z = −Y (중심선 위라 0). 돌린 형상은 기하에 직접 굳혀(applyMatrix4) 빗금 UV를 세계 좌표로 줄 수 있게 한다.
   ========================================================= */
import * as THREE from 'three';
import { XC, keelZ, skegAftX } from './hull.js';
import { STERN_GEAR as SG } from './data/baseline.js';

/* a centreline plate: polygon in (X, Z), thickness t across the ship */
function plate(pts,t){
  const sh=new THREE.Shape(pts.map(([x,z])=>new THREE.Vector2(x-XC,z)));
  const g=new THREE.ExtrudeGeometry(sh,{depth:t,bevelEnabled:false});g.translate(0,0,-t/2);return g;
}
/* the hull bottom along the centreline from x0 to x1 (the top edge of a plate hung under the hull) */
const bottom=(x0,x1,n=12)=>Array.from({length:n+1},(_,i)=>{const x=x0+(x1-x0)*i/n;return [x,keelZ(x)];});
const SINK=0.3;   // m: the rudder top and the shaft's fore end run this far into the hull, so no gap shows at the joint

export function sternGearGeometry(){
  const {prop,rudder}=SG;
  // rudder: z0 up into the counter
  const rudderG=plate([[rudder.x1,rudder.z0],[rudder.x0,rudder.z0],...bottom(rudder.x0,rudder.x1).map(p=>[p[0],p[1]+SINK])].reverse(),rudder.thick);
  // propeller: shaft from inside the skeg's aft edge to the hub, hub with a rounded cap, blades in the disc plane (pitched 22°)
  const ax=new THREE.Matrix4().makeRotationZ(Math.PI/2);   // cylinder axis y → x
  const shaftLen=Math.max(0.05,skegAftX(prop.z)+SINK-(prop.x+prop.hubLen/2));
  const shaft=new THREE.CylinderGeometry(prop.shaftR,prop.shaftR,shaftLen,16).applyMatrix4(ax).translate(prop.x+prop.hubLen/2+shaftLen/2-XC,prop.z,0);
  const hub=new THREE.CylinderGeometry(prop.hubR*0.85,prop.hubR,prop.hubLen,24).applyMatrix4(ax).translate(prop.x-XC,prop.z,0);
  const cap=new THREE.SphereGeometry(prop.hubR*0.85,20,10,0,Math.PI*2,0,Math.PI/2).applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.PI/2))
    .translate(prop.x-prop.hubLen/2-XC,prop.z,0);
  const R=prop.d/2,len=R-prop.hubR*0.6,blades=[];
  for(let b=0;b<prop.blades;b++){
    const g=new THREE.CircleGeometry(0.5,24);g.scale(prop.bladeW,len,1);g.translate(0,prop.hubR*0.6+len/2,0);   // a flat ellipse along +y
    g.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.PI/2));                          // into the disc plane (y, z), facing x
    g.applyMatrix4(new THREE.Matrix4().makeRotationY(0.38));                               // pitch
    g.applyMatrix4(new THREE.Matrix4().makeRotationX(b*2*Math.PI/prop.blades));           // around the shaft
    g.translate(prop.x-XC,prop.z,0);blades.push(g);
  }
  return {rudder:rudderG,prop:[shaft,hub,cap,...blades]};
}

/* hatch UVs in world metres: each vertex projected along its main normal axis (1 tile = 1.2 m, as on the shell) */
export function worldUV(g,tile=1.2){
  g=g.index?g.toNonIndexed():g;g.computeVertexNormals();
  const P=g.attributes.position,N=g.attributes.normal,uv=new Float32Array(P.count*2);
  for(let i=0;i<P.count;i++){const nx=Math.abs(N.getX(i)),ny=Math.abs(N.getY(i)),nz=Math.abs(N.getZ(i)),x=P.getX(i),y=P.getY(i),z=P.getZ(i);
    const [u,v]=nx>=ny&&nx>=nz?[z,y]:ny>=nz?[x,z]:[x,y];uv[i*2]=u/tile;uv[i*2+1]=v/tile;}
  g.setAttribute('uv',new THREE.BufferAttribute(uv,2));return g;
}
