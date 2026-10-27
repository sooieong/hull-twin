/* =========================================================
   보고서용 3D 선체 그림 (SPEC 6.1): 화면의 3D 뷰와 별개인 오프스크린 렌더러로 고정 시점을 그려 이미지로 넣는다.
   배경 흰색, 선체 연회색, 히트맵은 판정색. 시점: 우현 ISO, 선저.
   ========================================================= */
import * as THREE from 'three';
import { XC, NX, G, D, B, FS, FRMAX, stX, stSec, recordU, section, NB } from '../hull.js';
import { LAYERS } from '../data/criteria.js';
import { nV, pos, girth, index, normal, bowCap, SUPER_BOXES } from '../hullMesh.js';
import { heatOf, heatRGB, heatAlpha, buildIndex, idw } from '../heatmap.js';

/* 장면 전용 색 (보고서 3D 그림): 흰 배경·조명·선체 회색·굴뚝 띠·프레임선. 히트맵 판정색은 heatmap.js(styles/tokens.js)를 쓴다. */
const SCENE={bg:0xffffff,hemiSky:0xffffff,hemiGround:0x8a94a6,key:0xffffff,under:0xffffff,hull:0xcfd4db,band:0x222222,frame:0x7d8798};
const VIEWS={iso:{p:[240,125,275],t:[0,8,0]},bottom:{p:[150,-340,170],t:[0,4,0]}};
const BASE=[0.89,0.9,0.92];   // light grey hull

/* heat per vertex for one layer, or 'all' = the worst of the three layers */
function vertexColors(records,key){
  const h=r=>key==='all'?Math.max(...LAYERS.map(l=>heatOf(r,l))):heatOf(r,key);
  const ix=buildIndex(records.map(r=>({X:r.X,u:recordU(r),h:h(r)})));
  const S=new Float32Array(nV*3),P=new Float32Array(nV*3);
  for(let i=0;i<=NX;i++){const X=stX[i];for(let j=0;j<G;j++){const k=i*G+j,g=girth[k];
    [[S,idw(ix,X,-g)],[P,idw(ix,X,g)]].forEach(([c,hv])=>{const a=heatAlpha(hv),o=k*3;let col=BASE;
      if(a>0){const hc=heatRGB(hv);col=BASE.map((v,n)=>v+(hc[n]/255-v)*a);}c[o]=col[0];c[o+1]=col[1];c[o+2]=col[2];});}}
  return {S,P};
}

function fitCamera(camera,view){
  const t=new THREE.Vector3(...view.t),dir=new THREE.Vector3(...view.p).sub(t).normalize();
  const ax=new THREE.Vector3(),ay=new THREE.Vector3(),az=new THREE.Vector3();new THREE.Matrix4().lookAt(dir,new THREE.Vector3(),camera.up).extractBasis(ax,ay,az);
  const tv=Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*0.94,th=tv*camera.aspect,c=new THREE.Vector3();let d=0;
  for(const x of [-XC,XC])for(const y of [-1.5,D+30])for(const z of [-B/2,B/2]){c.set(x,y,z).sub(t);const zz=c.dot(az);d=Math.max(d,zz+Math.abs(c.dot(ax))/th,zz+Math.abs(c.dot(ay))/tv);}
  camera.position.copy(t).addScaledVector(dir,d);camera.lookAt(t);
}

/* jobs: [{key:'all'|'dft'|'plate'|'defect', view:'iso'|'bottom', w, h}] → {`${key}_${view}`: dataURL} */
export function renderHullViews(records,jobs){
  const out={},canvas=document.createElement('canvas');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(2);
  const scene=new THREE.Scene();scene.background=new THREE.Color(SCENE.bg);
  scene.add(new THREE.HemisphereLight(SCENE.hemiSky,SCENE.hemiGround,0.75));
  const key=new THREE.DirectionalLight(SCENE.key,0.6);key.position.set(220,320,260);scene.add(key);
  const under=new THREE.DirectionalLight(SCENE.under,0.45);under.position.set(80,-300,140);scene.add(under);
  const geo=()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('normal',new THREE.BufferAttribute(normal,3));g.setIndex(index);
    g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(nV*3),3));return g;};
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.8,metalness:0,side:THREE.DoubleSide});
  const gS=geo(),gP=geo(),mS=new THREE.Mesh(gS,mat),mP=new THREE.Mesh(gP,mat);mP.scale.z=-1;scene.add(mS,mP);
  // the rounded bulb tip (not measured: the plain hull colour)
  {const cg=new THREE.BufferGeometry();cg.setAttribute('position',new THREE.Float32BufferAttribute(bowCap.pos,3));cg.setAttribute('normal',new THREE.BufferAttribute(bowCap.normal,3));cg.setIndex(bowCap.index);
    const cm=new THREE.MeshStandardMaterial({color:new THREE.Color(...BASE),roughness:0.8,side:THREE.DoubleSide});[1,-1].forEach(sd=>{const m=new THREE.Mesh(cg,cm);m.scale.z=sd;scene.add(m);});}
  // deck, superstructure and every-50-frame lines for orientation
  const deckPos=[],deckIdx=[];for(let i=0;i<=NX;i++){const s=stSec[i],X=stX[i];deckPos.push(X-XC,s.Zs[G-1],-s.Ys[G-1],X-XC,s.Zs[G-1],s.Ys[G-1]);if(i<NX){const a=i*2;deckIdx.push(a,a+2,a+1,a+1,a+2,a+3);}}
  const dg=new THREE.BufferGeometry();dg.setAttribute('position',new THREE.Float32BufferAttribute(deckPos,3));dg.setIndex(deckIdx);dg.computeVertexNormals();
  const grey=new THREE.MeshStandardMaterial({color:SCENE.hull,roughness:0.85,side:THREE.DoubleSide});scene.add(new THREE.Mesh(dg,grey));
  SUPER_BOXES.forEach(([x0,x1,z0,z1,w,band])=>{const m=new THREE.Mesh(new THREE.BoxGeometry(x1-x0,z1-z0,w),band?new THREE.MeshStandardMaterial({color:SCENE.band}):grey);m.position.set((x0+x1)/2-XC,(z0+z1)/2,0);scene.add(m);});
  const lines=[];for(let n=50;n<=FRMAX;n+=50){const s=section(n*FS);for(let j=0;j<G-1;j++){const ok=k=>k<=NB?s.yb>0.02:s.Ys[k]>0.02;if(!ok(j)||!ok(j+1))continue;
    [1,-1].forEach(sd=>lines.push(n*FS-XC,s.Zs[j],sd*(s.Ys[j]+0.08),n*FS-XC,s.Zs[j+1],sd*(s.Ys[j+1]+0.08)));}}
  const lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));
  scene.add(new THREE.LineSegments(lg,new THREE.LineBasicMaterial({color:SCENE.frame,transparent:true,opacity:0.6})));
  const camera=new THREE.PerspectiveCamera(30,1,1,5000);
  const cache={};
  for(const j of jobs){
    if(!cache[j.key])cache[j.key]=vertexColors(records,j.key);
    gS.attributes.color.array.set(cache[j.key].S);gS.attributes.color.needsUpdate=true;
    gP.attributes.color.array.set(cache[j.key].P);gP.attributes.color.needsUpdate=true;
    renderer.setSize(j.w,j.h,false);camera.aspect=j.w/j.h;camera.updateProjectionMatrix();fitCamera(camera,VIEWS[j.view]);
    renderer.render(scene,camera);out[`${j.key}_${j.view}`]=canvas.toDataURL('image/png');
  }
  renderer.dispose();renderer.forceContextLoss();
  return out;
}
