import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { clamp, L, B, D, T, FS, XMAX, XC, FRMAX, NX, NB, G, KEEL_HALF, STRAKE_W, LETTERS, WLS,
  deckZ, keelZ, HB, section, recordU, strakeName, ZONE_LABELS, zoneOf, regionOf, stX, stSec, KEEL_BLOCKS, BLOCK_SIZE } from './hull.js';
import { CRITERIA, LAYER_LABEL, LEVEL_LABEL, judge, formatValue } from './data/criteria.js';
import { HEAT, heatOf, heatRGB, heatAlpha, heatCss, buildIndex, addToIndex, idw, coverage, nearest } from './heatmap.js';
import { ROBOT_MARGIN } from './data/scanPath.js';
import { createUiState } from './uiState.js';
import { createKpiPanel } from './kpi.js';
import { createSideShell } from './sideShell.js';
import { createDetailPanel } from './detail.js';
import { setupReport } from './pdfReport.js';
import { SimulatorSource } from './data/simulator.js';
import { createStore } from './data/store.js';
import { findDefectPhotos } from './data/photos.js';
import { logDataSummary } from './data/report.js';

(function(){
"use strict";
const $=s=>document.querySelector(s);
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmt=(n,d=2)=>n.toFixed(d);

/* ---------- toast + placeholders ---------- */
const toastEl=$('#toast');let toastT;
function toast(m){toastEl.textContent=m;toastEl.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>{toastEl.hidden=true;},2400);}
$('#dockSel').addEventListener('change',()=>toast('도킹 이력 비교는 측정 데이터 연결 후 활성화됩니다'));

/* ---------- data layer: every panel draws from this store (SPEC 3) ---------- */
const storeReady=findDefectPhotos().then(photos=>{const store=createStore(new SimulatorSource({photos}));store.connect();logDataSummary(store);return store;});
/* selected layer + selected measurement, shared by all panels (SPEC 4.3, 4.5) */
const ui=createUiState();

/* ---------- shared state + cross-view hooks ---------- */
const state={selFR:170,hoverX:null,hoverSrc:null,mode:'real',cut:false};
const hooks={onSelect:[],onHover:[]};
function selectFR(fr){
  fr=clamp(Math.round(fr),0,FRMAX);state.selFR=fr;const X=fr*FS;const s=section(X);
  $('#secFr').textContent=fr;$('#secZone').textContent=regionOf(X);
  $('#secX').textContent=fmt(X)+' m';
  const hb=HB(X,T);$('#secHb').textContent=hb>0?fmt(hb)+' m':'—';
  const g=s.gs[G-1];$('#secG').textContent=fmt(g,1)+' m';
  const n=g<KEEL_HALF?0:Math.min(LETTERS.length-1,Math.floor((g-KEEL_HALF)/STRAKE_W));
  $('#secS').textContent=n>0?`K, A–${LETTERS[n]} (${n+2}열)`:'K';
  const sl=$('#secSlider');if(+sl.value!==fr)sl.value=fr;
  hooks.onSelect.forEach(f=>f(fr,X));
}
function setHover(X,src){state.hoverX=X;state.hoverSrc=X==null?null:src;hooks.onHover.forEach(f=>f(X,src));
  if(X==null&&src!=='3d')$('#stCursor').textContent='—';}
$('#secSlider').max=FRMAX;
$('#secSlider').addEventListener('input',e=>selectFR(+e.target.value));

/* =========================================================
   3D VIEWPORT (three.js)
   ========================================================= */
const host=$('#vp');
const V3=THREE.Vector3;
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.localClippingEnabled=true;
host.appendChild(renderer.domElement);
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x04070d);
scene.fog=new THREE.Fog(0x04070d,480,1250);
const camera=new THREE.PerspectiveCamera(32,1,1,5000);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=0.08;controls.minDistance=30;controls.maxDistance=1200;controls.rotateSpeed=0.7;
const PRESETS={iso:{p:[240,125,275],t:[0,8,0]},side:{p:[0,14,600],t:[0,12,0]},plan:{p:[0,640,0.5],t:[0,0,0]},front:{p:[560,18,0.5],t:[0,14,0]},bottom:{p:[150,-340,170],t:[0,4,0]}};
// each preset keeps its direction; the distance is fitted so the whole ship shows in the pane (SPEC 4.1)
const FIT=0.9,SHIP_BOX=[];for(const x of [-XC,XC])for(const y of [-1.8,D+30])for(const z of [-B/2,B/2])SHIP_BOX.push(new V3(x,y,z));
function fitPreset(k){
  const pr=PRESETS[k],t=new V3(...pr.t),dir=new V3(...pr.p).sub(t).normalize();
  const ax=new V3(),ay=new V3(),az=new V3();new THREE.Matrix4().lookAt(dir,new V3(),camera.up).extractBasis(ax,ay,az);
  const tv=Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*FIT,th=tv*camera.aspect,c=new V3();let d=0;
  for(const b of SHIP_BOX){c.copy(b).sub(t);const z=c.dot(az);d=Math.max(d,z+Math.abs(c.dot(ax))/th,z+Math.abs(c.dot(ay))/tv);}
  return {p:t.clone().addScaledVector(dir,d),t};
}
let curView='iso';

scene.add(new THREE.HemisphereLight(0xb8c7e6,0x5a6478,0.62));   // lit ground colour so the bottom and its heatmap stay readable
const key=new THREE.DirectionalLight(0xffffff,0.85);key.position.set(220,320,260);scene.add(key);
const rim=new THREE.DirectionalLight(0xC9D3E6,0.38);rim.position.set(-320,140,-220);scene.add(rim);
const fill=new THREE.DirectionalLight(0xd5dcea,0.45);fill.position.set(-80,-200,120);scene.add(fill);

const clipPlane=new THREE.Plane(new V3(-1,0,0),0);
const clipMats=[];
function cm(m){clipMats.push(m);return m;}

/* hull shell */
const nV=(NX+1)*G;const pos=new Float32Array(nV*3),girth=new Float32Array(nV);
const colReal=new Float32Array(nV*3),colZone=new Float32Array(nV*3),colBp=new Float32Array(nV*3);
const ZC=[0xF37321,0xF89B6C,0xFBB584,0x000000,0x3C4E70,0xB5531A,0x8F3F13].map(h=>new THREE.Color(h));
const cHull=new THREE.Color(0xD3D8DF),cBp=new THREE.Color(0x0c1528);   // real mode: light achromatic hull (SPEC 4.4)
for(let i=0;i<=NX;i++){const s=stSec[i],X=stX[i];for(let j=0;j<G;j++){const k=i*G+j;const Z=s.Zs[j];
  pos[k*3]=X-XC;pos[k*3+1]=Z;pos[k*3+2]=s.Ys[j];girth[k]=s.gs[j];
  cHull.toArray(colReal,k*3);ZC[zoneOf(X,Z)].toArray(colZone,k*3);cBp.toArray(colBp,k*3);}}
const idx=[];for(let i=0;i<NX;i++)for(let j=0;j<G-1;j++){const a=i*G+j,b=(i+1)*G+j,c=a+1,d=b+1;idx.push(a,b,c,b,d,c);}
const hullGeo=new THREE.BufferGeometry();
hullGeo.setAttribute('position',new THREE.BufferAttribute(pos,3));
hullGeo.setIndex(idx);hullGeo.computeVertexNormals();hullGeo.computeBoundingSphere();
// each side shares position/normal/index but has its own colours (the heatmap differs port vs starboard)
function sideGeo(){const g=new THREE.BufferGeometry();g.setAttribute('position',hullGeo.attributes.position);g.setAttribute('normal',hullGeo.attributes.normal);
  g.setIndex(hullGeo.index);g.setAttribute('color',new THREE.BufferAttribute(colReal.slice(),3));g.boundingSphere=hullGeo.boundingSphere;return g;}
const geoS=sideGeo(),geoP=sideGeo();
const hullMat=cm(new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.7,metalness:0.05,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1}));
const backMat=cm(new THREE.MeshBasicMaterial({color:0x0a1222,side:THREE.BackSide}));
const hullS=new THREE.Mesh(geoS,hullMat),hullP=new THREE.Mesh(geoP,hullMat);hullP.scale.z=-1;
hullS.userData.side='S';hullP.userData.side='P';
const backS=new THREE.Mesh(hullGeo,backMat),backP=new THREE.Mesh(hullGeo,backMat);backP.scale.z=-1;
const hullGroup=new THREE.Group();hullGroup.add(hullS,hullP,backS,backP);scene.add(hullGroup);
const toThree=(X,Y,Z,out=new V3())=>out.set(X-XC,Z,-Y);
/* outward shell normal (three coords) at ship point (X, Y, Z), from the nearest shell vertex; port mesh is mirrored */
function shellNormal(X,Y,Z,out=new V3()){
  const i=clamp(Math.round(X/XMAX*NX),0,NX),s=stSec[i];let j=0,bd=1e9;
  for(let q=0;q<G;q++){const d=(s.Ys[q]-Math.abs(Y))**2+(s.Zs[q]-Z)**2;if(d<bd){bd=d;j=q;}}
  const n=hullGeo.attributes.normal,k=i*G+j;
  return out.set(n.getX(k),n.getY(k),n.getZ(k)*(Y<0?1:-1)).normalize();
}

/* keel / side block contact areas cannot be measured (SPEC 4.2): hatched on the bottom shell */
{const cv=document.createElement('canvas');cv.width=cv.height=16;const c=cv.getContext('2d');
  c.fillStyle='#3A4558';c.fillRect(0,0,16,16);c.strokeStyle='#8A96AA';c.lineWidth=2;
  c.beginPath();c.moveTo(-4,4);c.lineTo(4,-4);c.moveTo(0,16);c.lineTo(16,0);c.moveTo(12,20);c.lineTo(20,12);c.stroke();
  const tex=new THREE.CanvasTexture(cv);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  const mat=cm(new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
  KEEL_BLOCKS.forEach(b=>{const w=BLOCK_SIZE.dx+2*ROBOT_MARGIN,h=BLOCK_SIZE.dy+2*ROBOT_MARGIN,g=new THREE.PlaneGeometry(w,h),uv=g.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*w/1.2,uv.getY(i)*h/1.2);
    const m=new THREE.Mesh(g,mat);m.rotation.x=Math.PI/2;m.position.set(b.X-XC,keelZ(b.X)-0.04,-b.Y);hullGroup.add(m);});}

/* deck + transom */
const deckPos=[],deckIdx=[];
for(let i=0;i<=NX;i++){const s=stSec[i],X=stX[i];const Y=s.Ys[G-1],Z=s.Zs[G-1];deckPos.push(X-XC,Z,-Y,X-XC,Z,Y);
  if(i<NX){const a=i*2;deckIdx.push(a,a+2,a+1,a+1,a+2,a+3);}}
const deckGeo=new THREE.BufferGeometry();deckGeo.setAttribute('position',new THREE.Float32BufferAttribute(deckPos,3));deckGeo.setIndex(deckIdx);deckGeo.computeVertexNormals();
const deckMat=cm(new THREE.MeshStandardMaterial({color:0x252e40,roughness:0.85,metalness:0.1,side:THREE.DoubleSide}));
const deck=new THREE.Mesh(deckGeo,deckMat);hullGroup.add(deck);
const trPos=[],trIdx=[];{const s=stSec[0];for(let j=0;j<G;j++){trPos.push(-XC,s.Zs[j],-s.Ys[j],-XC,s.Zs[j],s.Ys[j]);if(j<G-1){const a=j*2;trIdx.push(a,a+1,a+2,a+1,a+3,a+2);}}}
const trGeo=new THREE.BufferGeometry();trGeo.setAttribute('position',new THREE.Float32BufferAttribute(trPos,3));trGeo.setIndex(trIdx);trGeo.computeVertexNormals();
const trMat=cm(new THREE.MeshStandardMaterial({color:0x1d2638,roughness:0.6,metalness:0.18,side:THREE.DoubleSide}));
hullGroup.add(new THREE.Mesh(trGeo,trMat));

/* line helpers */
function lineSeg(arr,mat){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));return new THREE.LineSegments(g,mat);}
function sectionSegs(X,out,off=0.06){
  const s=section(X);const valid=j=>j<=NB?s.yb>0.02:s.Ys[j]>0.02;
  for(let j=0;j<G-1;j++){if(!valid(j)||!valid(j+1))continue;
    const z1=s.Zs[j]-(j<=NB?off:0),z2=s.Zs[j+1]-(j+1<=NB?off:0),y1=s.Ys[j]+(j>NB?off:0),y2=s.Ys[j+1]+(j+1>NB?off:0);
    out.push(X-XC,z1,y1,X-XC,z2,y2, X-XC,z1,-y1,X-XC,z2,-y2);}
}
const frameMat=cm(new THREE.LineBasicMaterial({color:0xFBB584,transparent:true,opacity:0.22}));
const frameMajMat=cm(new THREE.LineBasicMaterial({color:0xF89B6C,transparent:true,opacity:0.7}));
const fA=[],fB=[];for(let n=10;n<=FRMAX;n+=10)sectionSegs(n*FS,n%50===0?fB:fA);
const frames=new THREE.Group();frames.add(lineSeg(fA,frameMat),lineSeg(fB,frameMajMat));
// sheer line (deck edge)
const sheer=[];for(let i=0;i<NX;i++){const a=stSec[i],b=stSec[i+1];const ya=a.Ys[G-1],yb=b.Ys[G-1];if(ya<0.02&&yb<0.02)continue;sheer.push(stX[i]-XC,a.Zs[G-1],ya,stX[i+1]-XC,b.Zs[G-1],yb,stX[i]-XC,a.Zs[G-1],-ya,stX[i+1]-XC,b.Zs[G-1],-yb);}
const sheerMat=cm(new THREE.LineBasicMaterial({color:0xFBB584,transparent:true,opacity:0.55}));
hullGroup.add(lineSeg(sheer,sheerMat));
// strake seams
const seamMat=cm(new THREE.LineBasicMaterial({color:0xFBB584,transparent:true,opacity:0.16}));
const seamArr=[];
function seamPt(s,g){if(g>s.gs[G-1])return null;let j=0;while(j<G-2&&s.gs[j+1]<g)j++;const valid=k=>k<=NB?s.yb>0.02:s.Ys[k]>0.02;if(!valid(j)||!valid(j+1))return null;
  const t=(g-s.gs[j])/((s.gs[j+1]-s.gs[j])||1);const Y=s.Ys[j]+(s.Ys[j+1]-s.Ys[j])*t,Z=s.Zs[j]+(s.Zs[j+1]-s.Zs[j])*t;const onB=j<NB;return [onB?Y:Y+0.06,onB?Z-0.06:Z];}
for(let k=0;k<LETTERS.length;k++){const g=KEEL_HALF+STRAKE_W*k;let prev=null;
  for(let i=0;i<=NX;i++){const p=seamPt(stSec[i],g);if(p&&prev){seamArr.push(stX[i-1]-XC,prev[1],prev[0],stX[i]-XC,p[1],p[0],stX[i-1]-XC,prev[1],-prev[0],stX[i]-XC,p[1],-p[0]);}prev=p;}}
const seams=lineSeg(seamArr,seamMat);
// DWL
const dwlArr=[];for(let X=0;X<XMAX;X+=0.5){const y1=HB(X,T),y2=HB(X+0.5,T);if(y1<0.02||y2<0.02)continue;dwlArr.push(X-XC,T,y1+0.1,X+0.5-XC,T,y2+0.1,X-XC,T,-y1-0.1,X+0.5-XC,T,-y2-0.1);}
const dwlMat=cm(new THREE.LineBasicMaterial({color:0xF37321}));
const dwl=lineSeg(dwlArr,dwlMat);
// blueprint lines (WL + stations)
const bpMat=cm(new THREE.LineBasicMaterial({color:0xFBB584,transparent:true,opacity:0.32}));
const bpArr=[];WLS.forEach(Z=>{for(let X=0;X<XMAX;X+=0.6){const y1=HB(X,Z),y2=HB(X+0.6,Z);if(y1<0.02||y2<0.02)continue;bpArr.push(X-XC,Z,y1+0.06,X+0.6-XC,Z,y2+0.06,X-XC,Z,-y1-0.06,X+0.6-XC,Z,-y2-0.06);}});
for(let i=0;i<=20;i++)sectionSegs(i*L/20,bpArr,0.07);
const bpLines=lineSeg(bpArr,bpMat);bpLines.visible=false;
hullGroup.add(frames,seams,dwl,bpLines);

/* superstructure */
const superGroup=new THREE.Group();
const supMat=cm(new THREE.MeshStandardMaterial({color:0x1a2333,roughness:0.75,metalness:0.15}));
const supEdgeMat=cm(new THREE.LineBasicMaterial({color:0x3e5070,transparent:true,opacity:0.9}));
const bandMat=cm(new THREE.MeshStandardMaterial({color:0x0b0b0b,roughness:0.5}));   // K100: orange is reserved for UI accents
const supSolids=[];
function box(x0,x1,z0,z1,w,mat=supMat,yc=0){const g=new THREE.BoxGeometry(x1-x0,z1-z0,w);const m=new THREE.Mesh(g,mat);m.position.set((x0+x1)/2-XC,(z0+z1)/2,yc);superGroup.add(m);supSolids.push(m);
  const e=new THREE.LineSegments(new THREE.EdgesGeometry(g),supEdgeMat);e.position.copy(m.position);superGroup.add(e);return m;}
box(40,245,D,D+2.4,34);box(6,24,D,D+20,36);box(18,24,D+17.8,D+20,46);box(2,9,D+20,D+30,9);box(2,9,D+27.4,D+29,9.2,bandMat);
box(120,135,D+2.4,D+6.4,14);box(278,279.4,deckZ(279),deckZ(279)+11,1.4);
[60,100,150,200].forEach(x=>box(x,x+9,D+2.4,D+4.4,6));
scene.add(superGroup);

/* dock: floor, grid, walls, keel blocks */
const dockGroup=new THREE.Group();
const FLOOR=-1.8;
const floor=new THREE.Mesh(new THREE.PlaneGeometry(380,120),new THREE.MeshBasicMaterial({color:0x060b15}));floor.rotation.x=-Math.PI/2;floor.position.y=FLOOR-0.02;dockGroup.add(floor);
const gMin=[],gMaj=[];
for(let x=-300;x<=300;x+=5){const a=x%25===0?gMaj:gMin;a.push(x,FLOOR,-170,x,FLOOR,170);}
for(let z=-170;z<=170;z+=5){const a=z%25===0?gMaj:gMin;a.push(-300,FLOOR,z,300,FLOOR,z);}
scene.add(lineSeg(gMin,new THREE.LineBasicMaterial({color:0x0c1527})));
scene.add(lineSeg(gMaj,new THREE.LineBasicMaterial({color:0x172540})));
const dw=[];const DX0=-190,DX1=190,DZ=60,DH=18;
[[FLOOR],[DH]].forEach(([y])=>{dw.push(DX0,y,-DZ,DX1,y,-DZ,DX0,y,DZ,DX1,y,DZ,DX0,y,-DZ,DX0,y,DZ);});
for(let x=DX0;x<=DX1;x+=20){dw.push(x,FLOOR,-DZ,x,DH,-DZ,x,FLOOR,DZ,x,DH,DZ);}
dockGroup.add(lineSeg(dw,new THREE.LineBasicMaterial({color:0x22355a,transparent:true,opacity:0.7})));
const blkMat=new THREE.MeshStandardMaterial({color:0x2a303c,roughness:0.9});
const capMat=new THREE.MeshStandardMaterial({color:0x5a3a22,roughness:0.9});
const blkG=new THREE.BoxGeometry(BLOCK_SIZE.dx,1.5,BLOCK_SIZE.dy),capG=new THREE.BoxGeometry(BLOCK_SIZE.dx,0.3,BLOCK_SIZE.dy);
KEEL_BLOCKS.forEach(k=>{const b=new THREE.Mesh(blkG,blkMat);b.position.set(k.X-XC,FLOOR+0.75,-k.Y);const c=new THREE.Mesh(capG,capMat);c.position.set(k.X-XC,-0.15,-k.Y);dockGroup.add(b,c);});
scene.add(dockGroup);

/* robot (SPEC 4.2, 4.4): K100 body, bright outline and pulse ring, 1.5x the former size. Shown only while mapping.
   Local axes: x = heading, y = across, z = shell normal. */
const RB=1.5;
const robotGroup=new THREE.Group();
{const bodyG=new THREE.BoxGeometry(1.9*RB,1.2*RB,0.6*RB);
  const body=new THREE.Mesh(bodyG,new THREE.MeshStandardMaterial({color:0x050505,roughness:0.5,metalness:0.3}));body.position.z=0.3*RB;
  const edge=new THREE.LineSegments(new THREE.EdgesGeometry(bodyG),new THREE.LineBasicMaterial({color:0xffffff}));edge.position.copy(body.position);
  const top=new THREE.Mesh(new THREE.BoxGeometry(1.1*RB,0.7*RB,0.25*RB),new THREE.MeshStandardMaterial({color:0x1a1f2a,roughness:0.6}));top.position.z=0.72*RB;
  const eye=new THREE.Mesh(new THREE.SphereGeometry(0.16*RB,12,8),new THREE.MeshBasicMaterial({color:0xffffff}));eye.position.set(0.95*RB,0,0.4*RB);
  const wheelG=new THREE.CylinderGeometry(0.26*RB,0.26*RB,0.2*RB,14),wheelM=new THREE.MeshStandardMaterial({color:0x111622,roughness:0.8});
  [[-0.7,0.65],[0.7,0.65],[-0.7,-0.65],[0.7,-0.65]].forEach(([x,y])=>{const w=new THREE.Mesh(wheelG,wheelM);w.position.set(x*RB,y*RB,0.26*RB);robotGroup.add(w);});
  robotGroup.add(body,edge,top,eye);}
// locator rings lying on the shell; scaled with distance so the robot stays findable on the whole-ship view
const rbLocator=new THREE.Group();
const ringOnShell=(r0,r1,opacity)=>new THREE.Mesh(new THREE.RingGeometry(r0,r1,48),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity,side:THREE.DoubleSide,depthWrite:false}));
const rbHalo=ringOnShell(2.1*RB,2.35*RB,0.95),rbPulse=ringOnShell(2.35*RB,2.6*RB,0.6);
rbHalo.position.z=rbPulse.position.z=0.05;rbLocator.add(rbHalo,rbPulse);robotGroup.add(rbLocator);
const robotWrap=new THREE.Group();robotWrap.add(robotGroup);robotWrap.visible=false;scene.add(robotWrap);
const rbTarget={p:new V3(),q:new THREE.Quaternion()},rbBasis=new THREE.Matrix4();
function setRobotTarget(pose,snap){
  const n=shellNormal(pose.X,pose.Y,pose.Z),h=new V3(pose.heading.X,pose.heading.Z,-pose.heading.Y);
  toThree(pose.X,pose.Y,pose.Z,rbTarget.p);
  h.addScaledVector(n,-h.dot(n));
  if(h.lengthSq()>1e-8){h.normalize();rbBasis.makeBasis(h,new V3().crossVectors(n,h),n);rbTarget.q.setFromRotationMatrix(rbBasis);}
  if(snap){robotGroup.position.copy(rbTarget.p);robotGroup.quaternion.copy(rbTarget.q);}
}

/* scan path: travelled (faint, current strake solid) and the next part — rest of the current strake + the next strake (dashed) */
const pathGroup=new THREE.Group();pathGroup.visible=false;scene.add(pathGroup);
let plan=null,trailLine=null,rowLine=null,nextLine=null,lyRobotOn=true;
function buildPath(P){
  plan=P;const arr=new Float32Array(P.points.length*3),v=new V3(),n=new V3();
  P.points.forEach((p,i)=>{shellNormal(p.X,p.Y,p.Z,n);toThree(p.X,p.Y,p.Z,v).addScaledVector(n,0.15).toArray(arr,i*3);});
  const geo=()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(arr,3));g.setDrawRange(0,0);return g;};
  trailLine=new THREE.Line(geo(),new THREE.LineBasicMaterial({color:0x1F2D4A,transparent:true,opacity:0.18}));
  rowLine=new THREE.Line(geo(),new THREE.LineBasicMaterial({color:0x000000}));
  nextLine=new THREE.Line(geo(),new THREE.LineDashedMaterial({color:0x1F2D4A,dashSize:1.2,gapSize:0.9}));nextLine.computeLineDistances();
  pathGroup.add(trailLine,rowLine,nextLine);
}
function showPathAt(k){
  if(!plan)return;const pts=plan.points;let r=-1;
  for(let i=k;i<pts.length&&r<0;i++)r=pts[i].row;
  const end=r<0?pts.length-1:plan.rows[Math.min(r+1,plan.rows.length-1)].end,start=r<0?k:Math.min(k,plan.rows[r].start);
  trailLine.geometry.setDrawRange(0,k+1);rowLine.geometry.setDrawRange(start,k-start+1);nextLine.geometry.setDrawRange(k,Math.max(0,end-k+1));
}

/* selection ring, hover ring, labels */
const ringMat=new THREE.MeshBasicMaterial({color:0xF37321});
let ringMesh=null;
const hoverRing=(()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(G*2*3),3));const l=new THREE.Line(g,new THREE.LineBasicMaterial({color:0xF89B6C,transparent:true,opacity:0.9,depthTest:false}));l.renderOrder=5;l.visible=false;scene.add(l);return l;})();
const hoverDot=new THREE.Mesh(new THREE.SphereGeometry(0.45,14,10),new THREE.MeshBasicMaterial({color:0x000000,depthTest:false}));hoverDot.renderOrder=6;hoverDot.visible=false;scene.add(hoverDot);
function ringPoints(X,off){const s=section(X);const pts=[];
  for(let j=G-1;j>=0;j--)pts.push(new V3(X-XC,s.Zs[j],-(s.Ys[j]+off)));
  for(let j=1;j<G;j++)pts.push(new V3(X-XC,s.Zs[j],s.Ys[j]+off));
  return pts.filter((p,i,a)=>i===0||p.distanceTo(a[i-1])>1e-3);}
const labelsEl=$('#labels');const frLabels=[];
for(let n=0;n<=FRMAX;n+=50){const el=document.createElement('div');el.className='lbl3d';el.textContent='FR '+n;labelsEl.appendChild(el);const X=n*FS;const Z=deckZ(X);frLabels.push({el,p:new V3(X-XC,Z+2.2,HB(X,Z)+0.5)});}
const selLabel=document.createElement('div');selLabel.className='lbl3d sel';labelsEl.appendChild(selLabel);let selLabelPos=new V3();

hooks.onSelect.push((fr,X)=>{
  if(ringMesh){hullGroup.remove(ringMesh);ringMesh.geometry.dispose();}
  const pts=ringPoints(X,0.12);const curve=new THREE.CatmullRomCurve3(pts,false,'centripetal');
  ringMesh=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(60,pts.length*3),0.24,6,false),ringMat);hullGroup.add(ringMesh);
  clipPlane.constant=X-XC+0.02;
  selLabel.textContent='FR '+fr;const Z=deckZ(X);selLabelPos.set(X-XC,Z+5.5,HB(X,Z));
});
hooks.onHover.push((X,src)=>{
  if(X==null){hoverRing.visible=false;if(src!=='3d')hoverDot.visible=false;return;}
  const pts=ringPoints(X,0.18);const arr=hoverRing.geometry.attributes.position;
  pts.forEach((p,i)=>arr.setXYZ(i,p.x,p.y,p.z));arr.needsUpdate=true;hoverRing.geometry.setDrawRange(0,pts.length);hoverRing.visible=true;
  if(src!=='3d')hoverDot.visible=false;
});

/* modes, layers, cut */
function setMode(m){state.mode=m;
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===m)));
  const xr=m==='xray',bp=m==='bp'||xr,real=m==='real';
  hullMat.transparent=xr;hullMat.opacity=xr?0.13:1;hullMat.depthWrite=!xr;hullMat.roughness=bp?0.95:0.7;hullMat.needsUpdate=true;
  backS.visible=backP.visible=!xr;
  deckMat.color.setHex(bp?0x0c1528:real?0xAAB2BD:0x252e40);deckMat.transparent=xr;deckMat.opacity=xr?0.1:1;deckMat.depthWrite=!xr;
  trMat.color.setHex(bp?0x0c1528:real?0xC4CAD2:0x3C4E70);trMat.transparent=xr;trMat.opacity=xr?0.12:1;trMat.depthWrite=!xr;
  supMat.color.setHex(real?0xC9CED6:0x1a2333);supEdgeMat.color.setHex(real?0x5F6A7C:0x3e5070);
  bpLines.visible=bp;
  // lines: dark slate on the light hull, peach on the dark modes
  frameMat.color.setHex(real?0x5C687D:0xFBB584);frameMat.opacity=real?0.3:m==='zone'?0.32:0.5;
  frameMajMat.color.setHex(real?0x34415A:0xF89B6C);
  seamMat.color.setHex(real?0x5C687D:0xFBB584);seamMat.opacity=real?0.26:m==='zone'?0.2:0.35;
  sheerMat.color.setHex(real?0x34415A:0xFBB584);sheerMat.opacity=real?0.7:0.55;
  dwlMat.color.setHex(real?0x2F5597:0x7FA6E8);
  supSolids.forEach(s=>s.visible=!bp);
  $('#legend').hidden=m!=='zone';$('#heatLegend').hidden=m==='zone';
  paintHull();
}
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));

/* heatmap: IDW of the current layer's judgement over the shell, abnormal areas only (SPEC 4.4).
   Not shown in 'zone' mode, which colours the hull by measurement zone instead. */
const heatS=new Float32Array(nV),heatP=new Float32Array(nV),covS=new Float32Array(nV),covP=new Float32Array(nV);
let store=null,heatIx=buildIndex([]),heatT=null,heatArr=null,heatLen=0;
const hw={w:0};
function heatVertex(k,X,g){heatS[k]=idw(heatIx,X,-g,hw);covS[k]=coverage(hw.w);heatP[k]=idw(heatIx,X,g,hw);covP[k]=coverage(hw.w);}
function rebuildHeat(){
  const layer=ui.layer;
  heatArr=store?store.records:[];heatLen=heatArr.length;
  heatIx=buildIndex(heatArr.map(r=>({X:r.X,u:recordU(r),h:heatOf(r,layer),r})));
  for(let i=0;i<=NX;i++){const X=stX[i];for(let j=0;j<G;j++){const k=i*G+j;heatVertex(k,X,girth[k]);}}
  paintHull();
}
/* records appended while mapping: only the shell around the new points is recomputed */
function updateHeat(){
  const R=store.records;
  if(R!==heatArr||R.length<heatLen){rebuildHeat();return;}
  if(R.length===heatLen)return;
  const layer=ui.layer,rad=HEAT.radius,fresh=R.slice(heatLen);heatLen=R.length;
  fresh.forEach(r=>addToIndex(heatIx,{X:r.X,u:recordU(r),h:heatOf(r,layer),r}));
  fresh.forEach(r=>{const u=Math.abs(recordU(r)),i0=Math.max(0,Math.floor((r.X-rad)/XMAX*NX)),i1=Math.min(NX,Math.ceil((r.X+rad)/XMAX*NX));
    for(let i=i0;i<=i1;i++)for(let j=0;j<G;j++){const k=i*G+j;if(Math.abs(girth[k]-u)<rad||girth[k]<rad)heatVertex(k,stX[i],girth[k]);}});
  paintHull();
}
function scheduleHeat(){if(heatT)return;heatT=setTimeout(()=>{heatT=null;updateHeat();},100);}
const DIM=[0.3,0.33,0.39];   // not-yet-measured shell while mapping (the map "appears" behind the robot)
function paintHull(){
  const m=state.mode,base=m==='zone'?colZone:(m==='bp'||m==='xray')?colBp:colReal,show=m!=='zone';
  const dimOn=show&&store&&store.mapState==='mapping';
  [[geoS,heatS,covS],[geoP,heatP,covP]].forEach(([g,h,cov])=>{const attr=g.attributes.color,c=attr.array;
    for(let k=0;k<nV;k++){const o=k*3;let r=base[o],gr=base[o+1],b=base[o+2];
      if(dimOn){const d=(1-cov[k])*0.7;r+=(DIM[0]-r)*d;gr+=(DIM[1]-gr)*d;b+=(DIM[2]-b)*d;}
      const a=show?heatAlpha(h[k]):0;
      if(a>0){const hc=heatRGB(h[k]);r+=(hc[0]/255-r)*a;gr+=(hc[1]/255-gr)*a;b+=(hc[2]/255-b)*a;}
      c[o]=r;c[o+1]=gr;c[o+2]=b;}
    attr.needsUpdate=true;});
}
const LEGEND={
  dft:{t:'도막 두께 · 현재 / 설계',w:`주의 · ${CRITERIA.dft.warn*100}% 미만`,c:`심각 · ${CRITERIA.dft.crit*100}% 미만`},
  plate:{t:'강판 두께 · 원두께 대비 감소율',w:`주의 · ${CRITERIA.plate.warn*100}% 이상`,c:`심각 · ${CRITERIA.plate.crit*100}% 이상`},
  defect:{t:'도막 손상 · 종류 / 면적',w:'주의 · 스크래치',c:`심각 · 떨어짐, ${CRITERIA.defect.critArea} m² 이상`}
};
$('#heatRamp').style.background=`linear-gradient(90deg,${heatCss()})`;
function syncLayer(){const l=ui.layer;
  document.querySelectorAll('[data-layer]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.layer===l)));
  $('#heatTtl').textContent=LEGEND[l].t;$('#heatWarn').textContent=LEGEND[l].w;$('#heatCrit').textContent=LEGEND[l].c;}
document.querySelectorAll('[data-layer]').forEach(b=>b.addEventListener('click',()=>ui.setLayer(b.dataset.layer)));

/* selected measurement: K100 / white bullseye on the shell, distinct from the heatmap and the UI orange */
const selMarker=new THREE.Group();
{const mat=c=>new THREE.MeshBasicMaterial({color:c,side:THREE.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4});
  const ring=(r0,r1,c)=>{const m=new THREE.Mesh(new THREE.RingGeometry(r0,r1,40),mat(c));m.renderOrder=4;return m;};
  const dot=new THREE.Mesh(new THREE.CircleGeometry(0.4,24),mat(0xffffff));dot.renderOrder=4;
  selMarker.add(ring(1.2,1.65,0xffffff),ring(0.65,1.2,0x000000),dot);}
selMarker.visible=false;scene.add(selMarker);
function placeMarker(r){
  if(!r){selMarker.visible=false;return;}
  const nv=shellNormal(r.X,r.Y,r.Z);
  toThree(r.X,r.Y,r.Z,selMarker.position).addScaledVector(nv,0.2);
  selMarker.quaternion.setFromUnitVectors(new V3(0,0,1),nv);selMarker.visible=true;
}
ui.subscribe(k=>{
  if(k==='layer'){syncLayer();rebuildHeat();tip.hidden=true;}
  if(k==='select'){const r=store&&store.get(ui.selId);placeMarker(r);if(r)selectFR(r.fr);}
});
/* mapping state (SPEC 2, 4.1): done = whole ship + all results, robot and path hidden;
   mapping = heatmap restarts empty and fills in behind the robot */
const fmtTime=ts=>{const d=new Date(ts),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}.${p(d.getMonth()+1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;};
let mapOn=null,robotSeen=false;
function syncMap(){
  const on=store.mapState==='mapping';
  $('#mapState').classList.toggle('on',on);$('#mapBtn').textContent=on?'매핑 종료':'매핑 시작';
  $('#stRobotWrap').classList.toggle('idle',!on);
  if(on)$('#mapStateTxt').textContent=`매핑 중 ${Math.floor(store.progress*100)}%`;
  else{$('#mapStateTxt').textContent='매핑 완료';
    $('#stRobot').textContent=`매핑 완료 · 측정점 ${store.records.length.toLocaleString()}개 · 마지막 측정 ${store.lastTs?fmtTime(store.lastTs):'—'}`;}
  if(on!==mapOn){mapOn=on;robotSeen=false;robotWrap.visible=false;pathGroup.visible=on&&lyRobotOn;paintHull();}
}
function onPose(p){
  setRobotTarget(p,!robotSeen);robotSeen=true;robotWrap.visible=true;showPathAt(p.k);
  const pct=Math.floor(p.progress*100);
  $('#mapStateTxt').textContent=`매핑 중 ${pct}%`;
  $('#stRobot').textContent=`RBT-01 매핑 중 · FR ${p.fr} · 외판열 ${p.strake} · ${p.side==='P'?'좌현':'우현'} · X ${fmt(p.X)}  Y ${fmt(p.Y)}  Z ${fmt(p.Z)} m · 진행 ${pct}%`;
}
$('#mapBtn').addEventListener('click',()=>{if(!store)return;if(store.mapState==='mapping')store.stop();else store.start();});
/* report (SPEC 6): the 3D canvas is captured right after a render instead of keeping preserveDrawingBuffer on */
setupReport({button:$('#reportBtn'),store:()=>store,ui,toast,
  snapshot3D:()=>{renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png');},
  ship:()=>({name:$('.crumbs b').textContent,dock:$('#dockSel').value})});
function setSpeed(k){if(store)store.setSpeed(k);document.querySelectorAll('[data-speed]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.speed===k)));}
document.querySelectorAll('[data-speed]').forEach(b=>b.addEventListener('click',()=>setSpeed(+b.dataset.speed)));
storeReady.then(s=>{store=s;buildPath(s.plan);setSpeed(10);
  createKpiPanel($('#paneKpi .pane-body'),s,ui);createSideShell($('#paneShell .pane-body'),s,ui);
  createDetailPanel($('#paneDetail .pane-body'),s,ui,$('#paneDetail .pane-title'));
  s.subscribe(k=>{
    if(k.has('records')){scheduleHeat();placeMarker(ui.selId!=null?s.get(ui.selId):null);}
    if(k.has('state')||k.has('records'))syncMap();
    if(k.has('pose')&&s.mapState==='mapping'&&s.pose)onPose(s.pose);
  });
  rebuildHeat();syncMap();
});
const lay=(id,fn)=>{const el=$(id);el.addEventListener('change',()=>fn(el.checked));fn(el.checked);};
lay('#lyFrames',on=>{frames.visible=on;frLabels.forEach(l=>l.el.hidden=!on);});
lay('#lySeams',on=>seams.visible=on);
lay('#lyDwl',on=>dwl.visible=on);
lay('#lySuper',on=>superGroup.visible=on);
lay('#lyBlocks',on=>dockGroup.visible=on);
lay('#lyRobot',on=>{lyRobotOn=on;pathGroup.visible=on&&mapOn===true;});
$('#cutTog').addEventListener('change',e=>{state.cut=e.target.checked;const planes=state.cut?[clipPlane]:[];clipMats.forEach(m=>{m.clippingPlanes=planes;m.needsUpdate=true;});});

/* camera presets */
let tween=null;
function goView(k){document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===k)));
  curView=k;const to=fitPreset(k);
  if(reduce){camera.position.copy(to.p);controls.target.copy(to.t);controls.update();return;}
  tween={from:{p:camera.position.clone(),t:controls.target.clone()},to,t0:performance.now(),dur:800};}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>goView(b.dataset.view)));
$('#btnReset').addEventListener('click',()=>goView('iso'));
controls.addEventListener('start',()=>{tween=null;curView=null;document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed','false'));});
$('#btnFull').addEventListener('click',()=>{const el=$('#pane3d');try{if(document.fullscreenElement)document.exitFullscreen();else{const r=el.requestFullscreen&&el.requestFullscreen();if(r&&r.catch)r.catch(()=>toast('이 화면에서는 전체 화면을 지원하지 않습니다'));}}catch(_){toast('이 화면에서는 전체 화면을 지원하지 않습니다');}});

/* picking */
const ray=new THREE.Raycaster();const ndc=new THREE.Vector2();let pendingMove=null,lastHit=null,downAt=null;
const tri=new THREE.Triangle(),bary=new V3(),vA=new V3(),vB=new V3(),vC=new V3();
const NEAR_D=3.0;   // m: a hover/click within this surface distance of a measurement point refers to it
const tip=$('#tip');
function pick(e){
  const r=renderer.domElement.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1);
  ray.setFromCamera(ndc,camera);
  const hits=ray.intersectObjects([hullS,hullP],false).filter(h=>!state.cut||h.point.x<=clipPlane.constant);
  if(!hits.length){lastHit=null;tip.hidden=true;hoverDot.visible=false;if(state.hoverSrc==='3d')setHover(null,'3d');$('#stCursor').textContent='—';return;}
  const h=hits[0],p=h.point;const loc=h.object.worldToLocal(p.clone());
  const f=h.face;tri.set(vA.fromArray(pos,f.a*3),vB.fromArray(pos,f.b*3),vC.fromArray(pos,f.c*3)).getBarycoord(loc,bary);
  const g=bary.x*girth[f.a]+bary.y*girth[f.b]+bary.z*girth[f.c];
  const X=p.x+XC,Z=p.y,Y=-p.z,fr=Math.round(X/FS),side=h.object.userData.side,u=side==='P'?g:-g;
  const st=strakeName(g),near=nearest(heatIx,X,u,NEAR_D),rec=near?near.r:null;
  lastHit={fr,X,rec};
  let val='<div class="none">측정값 없음</div>';
  if(rec){const lv=judge(rec,ui.layer).level;
    val=`<div class="tv"><b>${formatValue(rec,ui.layer)}</b><span class="lv lv${lv}">${LEVEL_LABEL[lv]}</span></div>`;}
  tip.innerHTML=`<div class="t1">FR ${fr} <em>· 외판열 ${st}(${side})</em></div><div class="t2">${ZONE_LABELS[zoneOf(X,Z)]} · ${LAYER_LABEL[ui.layer]}</div>${val}<div class="t3">X ${fmt(X)}  Y ${fmt(Y)}  Z ${fmt(Z)} m</div>`;
  tip.hidden=false;const pw=r.width;tip.style.left=(e.clientX-r.left)+'px';tip.style.top=(e.clientY-r.top)+'px';
  tip.style.transform=(e.clientX-r.left)>pw-260?'translate(calc(-100% - 14px),14px)':'translate(14px,14px)';
  hoverDot.position.copy(p);hoverDot.visible=true;
  setHover(X,'3d');
  $('#stCursor').textContent=`FR ${fr} · 외판열 ${st}(${side}) · X ${fmt(X)}  Y ${fmt(Y)}  Z ${fmt(Z)} m`;
}
const cvs=renderer.domElement;
cvs.addEventListener('pointermove',e=>{pendingMove=e;});
cvs.addEventListener('pointerleave',()=>{pendingMove=null;tip.hidden=true;hoverDot.visible=false;lastHit=null;if(state.hoverSrc==='3d')setHover(null,'3d');});
cvs.addEventListener('pointerdown',e=>{downAt={x:e.clientX,y:e.clientY};tip.hidden=true;});
cvs.addEventListener('pointerup',e=>{if(downAt&&Math.hypot(e.clientX-downAt.x,e.clientY-downAt.y)<4){pick(e);if(lastHit){if(lastHit.rec)ui.select(lastHit.rec.id);else selectFR(lastHit.fr);}}downAt=null;});

/* gizmo */
const gz=$('#gizmo'),gctx=gz.getContext('2d');
function drawGizmo(){
  const r=gz.getBoundingClientRect(),d=Math.min(window.devicePixelRatio||1,2);
  if(gz.width!==Math.round(r.width*d)){gz.width=Math.round(r.width*d);gz.height=Math.round(r.height*d);}
  const w=gz.width/d,c=w/2,len=w*0.32;gctx.setTransform(d,0,0,d,0,0);gctx.clearRect(0,0,w,w);
  const q=camera.quaternion.clone().invert();
  const ax=[{v:new V3(1,0,0),c:'#F37321',l:'X'},{v:new V3(0,0,-1),c:'#F89B6C',l:'Y'},{v:new V3(0,1,0),c:'#FBB584',l:'Z'}]
    .map(a=>{const p=a.v.clone().applyQuaternion(q);return {...a,x:p.x,y:p.y,z:p.z};}).sort((a,b)=>a.z-b.z);
  gctx.beginPath();gctx.arc(c,c,2,0,Math.PI*2);gctx.fillStyle='#6F7C93';gctx.fill();
  ax.forEach(a=>{const ex=c+a.x*len,ey=c-a.y*len;gctx.globalAlpha=a.z<-0.2?0.45:1;
    gctx.strokeStyle=a.c;gctx.lineWidth=2;gctx.beginPath();gctx.moveTo(c,c);gctx.lineTo(ex,ey);gctx.stroke();
    gctx.fillStyle=a.c;gctx.beginPath();gctx.arc(c+a.x*(len+9),c-a.y*(len+9),8,0,Math.PI*2);gctx.fill();
    gctx.fillStyle='#000';gctx.font='600 11px "Barlow Condensed",sans-serif';gctx.textAlign='center';gctx.textBaseline='middle';gctx.fillText(a.l,c+a.x*(len+9),c-a.y*(len+9)+0.5);});
  gctx.globalAlpha=1;
}

/* resize + loop */
function resize3D(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();
  if(curView&&!tween){const f=fitPreset(curView);camera.position.copy(f.p);controls.target.copy(f.t);controls.update();}}
new ResizeObserver(resize3D).observe(host);resize3D();
const tmp=new V3();
function place(el,p){tmp.copy(p).project(camera);if(tmp.z>1||tmp.z<-1){el.style.display='none';return;}
  el.style.display='';el.style.left=((tmp.x+1)/2*host.clientWidth)+'px';el.style.top=((1-tmp.y)/2*host.clientHeight)+'px';}
let last=performance.now(),frame=0;
function loop(now){
  const dt=Math.min(0.05,(now-last)/1000);last=now;frame++;
  if(tween){const k=Math.min(1,(now-tween.t0)/tween.dur);const e=k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;
    camera.position.lerpVectors(tween.from.p,tween.to.p,e);controls.target.lerpVectors(tween.from.t,tween.to.t,e);if(k>=1)tween=null;}
  controls.update();
  if(robotWrap.visible){const e=1-Math.exp(-dt*14);robotGroup.position.lerp(rbTarget.p,e);robotGroup.quaternion.slerp(rbTarget.q,e);
    rbLocator.scale.setScalar(clamp(camera.position.distanceTo(robotGroup.position)/120,1,3.5));
    if(!reduce){const ph=(now/1000)%1.4/1.4;rbPulse.scale.setScalar(1+ph*0.8);rbPulse.material.opacity=0.6*(1-ph);}}
  if(pendingMove){pick(pendingMove);pendingMove=null;}
  if(selMarker.visible)selMarker.scale.setScalar(clamp(camera.position.distanceTo(selMarker.position)/110,1,4));
  frLabels.forEach(l=>{if(!l.el.hidden)place(l.el,l.p);});place(selLabel,selLabelPos);
  renderer.render(scene,camera);drawGizmo();
  requestAnimationFrame(loop);
}
syncLayer();setMode('real');selectFR(state.selFR);
if(window.innerWidth<=1100)$('#layers').open=false;   // narrow main pane: keep the hull visible
requestAnimationFrame(loop);
})();
