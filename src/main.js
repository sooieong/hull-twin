import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { clamp, smooth, L, B, D, T, R, FS, XMAX, XC, FRMAX, NX, NB, G, KEEL_HALF, STRAKE_W, LETTERS, WLS,
  deckZ, keelZ, HB, section, atGirth, strakeLower, recordU, strakeName, ZONES, zoneOf, regionOf, stX, stSec, KEEL_BLOCKS, BLOCK_SIZE } from './hull.js';
import { CRITERIA, TOP_RULE, judge, isTop, gradeOf } from './data/criteria.js';
import { LAYER_LABEL, gradeLabel, DEFECT_LABEL, value, loc, coords, metres, num, progress, dateTime } from './format.js';
import { HEAT, heatOf, heatRGB, heatAlpha, heatCss, buildIndex, addToIndex, idw, coverage, nearest } from './heatmap.js';
import { ROBOT_MARGIN } from './data/scanPath.js';
import { createUiState } from './uiState.js';
import { createKpiPanel } from './kpi.js';
import { createSideShell } from './sideShell.js';
import { createDetailPanel } from './detail.js';
import { setupPanels } from './panels.js';
import { nV, pos, girth, index as hullIndex, SUPER_BOXES } from './hullMesh.js';
import { SimulatorSource } from './data/simulator.js';
import { createStore } from './data/store.js';
import { findDefectPhotos } from './data/photos.js';
import { logDataSummary } from './data/report.js';

(function(){
"use strict";
const $=s=>document.querySelector(s);
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const lsGet=k=>{try{return localStorage.getItem(k);}catch(_){return null;}},lsSet=(k,v)=>{try{localStorage.setItem(k,v);}catch(_){}};

/* ---------- toast + placeholders ---------- */
const toastEl=$('#toast');let toastT;
function toast(m,ms=2400){toastEl.textContent=m;toastEl.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>{toastEl.hidden=true;},ms);}
$('#dockSel').addEventListener('change',()=>toast('도킹 이력 비교는 측정 데이터 연결 후 활성화됩니다'));

/* ---------- data layer: every panel draws from this store (SPEC 3) ---------- */
const storeReady=findDefectPhotos().then(photos=>{const store=createStore(new SimulatorSource({photos}));store.connect();logDataSummary(store);return store;});
/* selected layer + selected measurement, shared by all panels (SPEC 4.3, 4.5) */
const ui=createUiState();

/* ---------- shared state + cross-view hooks ---------- */
const state={selFR:170,hoverX:null,hoverSrc:null,cut:false};
const hooks={onSelect:[],onHover:[]};
function selectFR(fr){
  fr=clamp(Math.round(fr),0,FRMAX);state.selFR=fr;const X=fr*FS;const s=section(X);
  const fi=$('#secFr');if(document.activeElement!==fi)fi.value=fr;$('#secMiniFr').textContent=fr;$('#secZone').textContent=regionOf(X);
  $('#secX').textContent=metres(X);
  const hb=HB(X,T);$('#secHb').textContent=hb>0?metres(hb):'—';
  const g=s.gs[G-1];$('#secG').textContent=metres(g,1);
  const n=g<KEEL_HALF?0:Math.min(LETTERS.length-1,Math.floor((g-KEEL_HALF)/STRAKE_W));
  $('#secS').textContent=n>0?`K, A–${LETTERS[n]} (${n+2}열)`:'K';
  const sl=$('#secSlider');if(+sl.value!==fr)sl.value=fr;
  hooks.onSelect.forEach(f=>f(fr,X));
}
function setHover(X,src){state.hoverX=X;state.hoverSrc=X==null?null:src;hooks.onHover.forEach(f=>f(X,src));
  if(X==null&&src!=='3d')$('#stCursor').textContent='—';}
$('#secSlider').max=FRMAX;
$('#secSlider').addEventListener('input',e=>selectFR(+e.target.value));
/* frame number typed into the card: Enter moves there (clamped to 0–FRMAX), Esc or leaving the field restores it */
{const fi=$('#secFr');
  fi.addEventListener('focus',()=>fi.select());
  fi.addEventListener('keydown',e=>{
    if(e.key==='Enter'){const n=parseInt(fi.value,10);fi.blur();if(Number.isFinite(n))selectFR(n);e.preventDefault();}
    else if(e.key==='Escape'){fi.blur();e.preventDefault();}});
  fi.addEventListener('blur',()=>{fi.value=state.selFR;});}

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
controls.enableDamping=true;controls.dampingFactor=0.08;controls.minDistance=8;controls.maxDistance=1200;controls.rotateSpeed=0.7;
const PRESETS={iso:{p:[240,125,275],t:[0,8,0]},side:{p:[0,14,600],t:[0,12,0]},plan:{p:[0,640,0.5],t:[0,0,0]},front:{p:[560,18,0.5],t:[0,14,0]},bottom:{p:[150,-340,170],t:[0,4,0]}};
// each preset keeps its direction; the distance is fitted so the whole ship shows in the pane (SPEC 4.1)
const FIT=0.9,SHIP_BOX=[];for(const x of [-XC,XC])for(const y of [-1.8,D+30])for(const z of [-B/2,B/2])SHIP_BOX.push(new V3(x,y,z));
function fitPreset(k){const pr=PRESETS[k],t=new V3(...pr.t);return fitDir(new V3(...pr.p).sub(t).normalize(),t);}
function fitDir(dir,t){
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
const colReal=new Float32Array(nV*3),colBp=new Float32Array(nV*3);
const cHull=new THREE.Color(0xD3D8DF),cBp=new THREE.Color(0x0c1528);   // 실선: light achromatic hull (SPEC 4.4) · 도면: dark navy
for(let k=0;k<nV;k++){cHull.toArray(colReal,k*3);cBp.toArray(colBp,k*3);}
const hullGeo=new THREE.BufferGeometry();
hullGeo.setAttribute('position',new THREE.BufferAttribute(pos,3));
hullGeo.setIndex(hullIndex);hullGeo.computeVertexNormals();hullGeo.computeBoundingSphere();
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
const deckMat=cm(new THREE.MeshStandardMaterial({color:0xAAB2BD,roughness:0.85,metalness:0.1,side:THREE.DoubleSide}));
const deck=new THREE.Mesh(deckGeo,deckMat);hullGroup.add(deck);
const trPos=[],trIdx=[];{const s=stSec[0];for(let j=0;j<G;j++){trPos.push(-XC,s.Zs[j],-s.Ys[j],-XC,s.Zs[j],s.Ys[j]);if(j<G-1){const a=j*2;trIdx.push(a,a+1,a+2,a+1,a+3,a+2);}}}
const trGeo=new THREE.BufferGeometry();trGeo.setAttribute('position',new THREE.Float32BufferAttribute(trPos,3));trGeo.setIndex(trIdx);trGeo.computeVertexNormals();
const trMat=cm(new THREE.MeshStandardMaterial({color:0xC4CAD2,roughness:0.6,metalness:0.18,side:THREE.DoubleSide}));
hullGroup.add(new THREE.Mesh(trGeo,trMat));

/* line helpers */
function lineSeg(arr,mat){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));return new THREE.LineSegments(g,mat);}
function sectionSegs(X,out,off=0.06){
  const s=section(X);const valid=j=>j<=NB?s.yb>0.02:s.Ys[j]>0.02;
  for(let j=0;j<G-1;j++){if(!valid(j)||!valid(j+1))continue;
    const z1=s.Zs[j]-(j<=NB?off:0),z2=s.Zs[j+1]-(j+1<=NB?off:0),y1=s.Ys[j]+(j>NB?off:0),y2=s.Ys[j+1]+(j+1>NB?off:0);
    out.push(X-XC,z1,y1,X-XC,z2,y2, X-XC,z1,-y1,X-XC,z2,-y2);}
}
// lines: dark slate so they read on the light hull
const frameMat=cm(new THREE.LineBasicMaterial({color:0x5C687D,transparent:true,opacity:0.3}));
const frameMajMat=cm(new THREE.LineBasicMaterial({color:0x34415A,transparent:true,opacity:0.7}));
const fA=[],fB=[];for(let n=10;n<=FRMAX;n+=10)sectionSegs(n*FS,n%50===0?fB:fA);
const frames=new THREE.Group();frames.add(lineSeg(fA,frameMat),lineSeg(fB,frameMajMat));
// sheer line (deck edge)
const sheer=[];for(let i=0;i<NX;i++){const a=stSec[i],b=stSec[i+1];const ya=a.Ys[G-1],yb=b.Ys[G-1];if(ya<0.02&&yb<0.02)continue;sheer.push(stX[i]-XC,a.Zs[G-1],ya,stX[i+1]-XC,b.Zs[G-1],yb,stX[i]-XC,a.Zs[G-1],-ya,stX[i+1]-XC,b.Zs[G-1],-yb);}
const sheerMat=cm(new THREE.LineBasicMaterial({color:0x34415A,transparent:true,opacity:0.7}));
hullGroup.add(lineSeg(sheer,sheerMat));
// strake seams
const seamMat=cm(new THREE.LineBasicMaterial({color:0x5C687D,transparent:true,opacity:0.26}));
const seamArr=[];
function seamPt(s,g){if(g>s.gs[G-1])return null;let j=0;while(j<G-2&&s.gs[j+1]<g)j++;const valid=k=>k<=NB?s.yb>0.02:s.Ys[k]>0.02;if(!valid(j)||!valid(j+1))return null;
  const t=(g-s.gs[j])/((s.gs[j+1]-s.gs[j])||1);const Y=s.Ys[j]+(s.Ys[j+1]-s.Ys[j])*t,Z=s.Zs[j]+(s.Zs[j+1]-s.Zs[j])*t;const onB=j<NB;return [onB?Y:Y+0.06,onB?Z-0.06:Z];}
for(let k=0;k<LETTERS.length;k++){const g=KEEL_HALF+STRAKE_W*k;let prev=null;
  for(let i=0;i<=NX;i++){const p=seamPt(stSec[i],g);if(p&&prev){seamArr.push(stX[i-1]-XC,prev[1],prev[0],stX[i]-XC,p[1],p[0],stX[i-1]-XC,prev[1],-prev[0],stX[i]-XC,p[1],-p[0]);}prev=p;}}
const seams=lineSeg(seamArr,seamMat);
// DWL
const dwlArr=[];for(let X=0;X<XMAX;X+=0.5){const y1=HB(X,T),y2=HB(X+0.5,T);if(y1<0.02||y2<0.02)continue;dwlArr.push(X-XC,T,y1+0.1,X+0.5-XC,T,y2+0.1,X-XC,T,-y1-0.1,X+0.5-XC,T,-y2-0.1);}
const dwlMat=cm(new THREE.LineBasicMaterial({color:0x2F5597}));
const dwl=lineSeg(dwlArr,dwlMat);
// design lines (waterlines + stations): shown in the 도면 look only
const bpMat=cm(new THREE.LineBasicMaterial({color:0xFBB584,transparent:true,opacity:0.4}));
const bpArr=[];WLS.forEach(Z=>{for(let X=0;X<XMAX;X+=0.6){const y1=HB(X,Z),y2=HB(X+0.6,Z);if(y1<0.02||y2<0.02)continue;bpArr.push(X-XC,Z,y1+0.06,X+0.6-XC,Z,y2+0.06,X-XC,Z,-y1-0.06,X+0.6-XC,Z,-y2-0.06);}});
for(let i=0;i<=20;i++)sectionSegs(i*L/20,bpArr,0.07);
const bpLines=lineSeg(bpArr,bpMat);bpLines.visible=false;
hullGroup.add(frames,seams,dwl,bpLines);
// measurement zone boundaries (hull.zoneOf limits) + names: LAYERS "구역 경계", off by default, lines and text only
const zoneArr=[],ZX0=0.08*L,ZX1=0.9*L;
[0.15,R+0.6,T-1.2,T+1.6].forEach(Z=>{for(let X=ZX0;X<ZX1;X+=0.5){const y1=HB(X,Z),y2=HB(X+0.5,Z);if(y1<0.02||y2<0.02)continue;
  zoneArr.push(X-XC,Z,y1+0.12,X+0.5-XC,Z,y2+0.12,X-XC,Z,-y1-0.12,X+0.5-XC,Z,-y2-0.12);}});
[ZX0,ZX1].forEach(X=>sectionSegs(X,zoneArr,0.12));
const zoneMat=cm(new THREE.LineDashedMaterial({color:0x1F2D4A,dashSize:1.6,gapSize:1.1}));
const zoneLines=lineSeg(zoneArr,zoneMat);zoneLines.computeLineDistances();zoneLines.visible=false;
hullGroup.add(zoneLines);

/* superstructure */
const superGroup=new THREE.Group();
const supMat=cm(new THREE.MeshStandardMaterial({color:0xC9CED6,roughness:0.75,metalness:0.15}));
const supEdgeMat=cm(new THREE.LineBasicMaterial({color:0x5F6A7C,transparent:true,opacity:0.9}));
const bandMat=cm(new THREE.MeshStandardMaterial({color:0x0b0b0b,roughness:0.5}));   // K100: orange is reserved for UI accents
function box(x0,x1,z0,z1,w,mat=supMat,yc=0){const g=new THREE.BoxGeometry(x1-x0,z1-z0,w);const m=new THREE.Mesh(g,mat);m.position.set((x0+x1)/2-XC,(z0+z1)/2,yc);superGroup.add(m);
  const e=new THREE.LineSegments(new THREE.EdgesGeometry(g),supEdgeMat);e.position.copy(m.position);superGroup.add(e);return m;}
SUPER_BOXES.forEach(([x0,x1,z0,z1,w,band])=>box(x0,x1,z0,z1,w,band?bandMat:supMat));
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
for(let n=0;n<=FRMAX;n+=50){const el=document.createElement('div');el.className='lbl3d';el.textContent='FR'+n;labelsEl.appendChild(el);const X=n*FS;const Z=deckZ(X);frLabels.push({el,p:new V3(X-XC,Z+2.2,HB(X,Z)+0.5)});}
const selLabel=document.createElement('div');selLabel.className='lbl3d sel';labelsEl.appendChild(selLabel);let selLabelPos=new V3();
// staggered along the ship so the stacked bands do not overlap in the side view
const zoneLabels=[[0.3*L,0,B/4],[0.34*L,1.2],[0.42*L,(R+0.6+T-1.2)/2],[0.52*L,T+0.2],[0.6*L,(T+1.6+D)/2],[0.95*L,T],[0.04*L,T+4]].map(([X,Z,Y],i)=>{
  const t=ZONES[i];   // same order as hull.ZONES
  const el=document.createElement('div');el.className='lbl3d zl';el.textContent=t;el.hidden=true;labelsEl.appendChild(el);
  return {el,p:new V3(X-XC,Z,Y!=null?Y:HB(X,Z)+0.4)};});

hooks.onSelect.push((fr,X)=>{
  if(ringMesh){hullGroup.remove(ringMesh);ringMesh.geometry.dispose();}
  const pts=ringPoints(X,0.12);const curve=new THREE.CatmullRomCurve3(pts,false,'centripetal');
  ringMesh=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(60,pts.length*3),0.24,6,false),ringMat);hullGroup.add(ringMesh);
  clipPlane.constant=X-XC+0.02;
  selLabel.textContent='FR'+fr;const Z=deckZ(X);selLabelPos.set(X-XC,Z+5.5,HB(X,Z));
});
hooks.onHover.push((X,src)=>{
  if(X==null){hoverRing.visible=false;if(src!=='3d')hoverDot.visible=false;return;}
  const pts=ringPoints(X,0.18);const arr=hoverRing.geometry.attributes.position;
  pts.forEach((p,i)=>arr.setXYZ(i,p.x,p.y,p.z));arr.needsUpdate=true;hoverRing.geometry.setDrawRange(0,pts.length);hoverRing.visible=true;
  if(src!=='3d')hoverDot.visible=false;
});

/* heatmap: IDW of the current layer's judgement over the shell, abnormal areas only (SPEC 4.4) — always shown (SPEC 10.8) */
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
// not-yet-measured shell while mapping or paused (the map "appears" behind the robot)
const DIM={real:[0.3,0.33,0.39],bp:[0.02,0.035,0.07]};
let look='real';
function paintHull(){
  const base=look==='bp'?colBp:colReal,show=true,DIMC=DIM[look];
  const dimOn=!!store&&(store.mapState==='mapping'||store.mapState==='paused');
  [[geoS,heatS,covS],[geoP,heatP,covP]].forEach(([g,h,cov])=>{const attr=g.attributes.color,c=attr.array;
    for(let k=0;k<nV;k++){const o=k*3;let r=base[o],gr=base[o+1],b=base[o+2];
      if(dimOn){const d=(1-cov[k])*0.7;r+=(DIMC[0]-r)*d;gr+=(DIMC[1]-gr)*d;b+=(DIMC[2]-b)*d;}
      const a=show?heatAlpha(h[k]):0;
      if(a>0){const hc=heatRGB(h[k]);r+=(hc[0]/255-r)*a;gr+=(hc[1]/255-gr)*a;b+=(hc[2]/255-b)*a;}
      c[o]=r;c[o+1]=gr;c[o+2]=b;}
    attr.needsUpdate=true;});
}
const LEGEND={
  dft:{t:'도막 두께·현재 / 설계',w:`주의·${CRITERIA.dft.warn*100}% 미만`,c:`심각·${CRITERIA.dft.crit*100}% 미만`},
  plate:{t:'강판 두께·감소율 (원두께 기준)',w:`주의·${CRITERIA.plate.warn*100}% 이상`,c:`심각·${CRITERIA.plate.crit*100}% 이상`},
  defect:{t:'도막 손상·종류 / 면적',w:`주의·${DEFECT_LABEL.scratch}`,c:`심각·${DEFECT_LABEL.flaking}, ${CRITERIA.defect.critArea} m² 이상`}
};
$('#heatRamp').style.background=`linear-gradient(90deg,${heatCss()})`;
document.querySelectorAll('#legendPop [data-top]').forEach(el=>{el.textContent=TOP_RULE[el.dataset.top];});   // 최우선 보수 기준 (criteria.js)
function syncLayer(){const l=ui.layer;
  document.querySelectorAll('[data-layer]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.layer===l)));
  $('#heatTtl').textContent=LEGEND[l].t;$('#heatWarn').textContent=LEGEND[l].w;$('#heatCrit').textContent=LEGEND[l].c;}
document.querySelectorAll('[data-layer]').forEach(b=>b.addEventListener('click',()=>ui.setLayer(b.dataset.layer)));
const legendBtn=$('#legendBtn'),legendPop=$('#legendPop');
function openLegend(on){
  legendPop.hidden=!on;legendBtn.setAttribute('aria-expanded',String(on));
  if(on){const pane=$('#pane3d');legendPop.style.left=Math.max(8,Math.min(legendBtn.offsetLeft-12,pane.clientWidth-legendPop.offsetWidth-8))+'px';}
}
legendBtn.addEventListener('click',()=>openLegend(legendPop.hidden));

/* selected measurement: K100 / white bullseye on the shell, distinct from the heatmap and the UI orange */
const selMarker=new THREE.Group();
{const mat=c=>new THREE.MeshBasicMaterial({color:c,side:THREE.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4});
  const ring=(r0,r1,c)=>{const m=new THREE.Mesh(new THREE.RingGeometry(r0,r1,40),mat(c));m.renderOrder=4;return m;};
  const dot=new THREE.Mesh(new THREE.CircleGeometry(0.4,24),mat(0xffffff));dot.renderOrder=4;
  selMarker.add(ring(1.2,1.65,0xffffff),ring(0.65,1.2,0x000000),dot);}
// pulse after a fly-to (SPEC 10.3)
const selPulse=new THREE.Mesh(new THREE.RingGeometry(1.65,1.95,48),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,side:THREE.DoubleSide,depthWrite:false}));
selPulse.renderOrder=4;selPulse.visible=false;selMarker.add(selPulse);
selMarker.visible=false;scene.add(selMarker);
function placeMarker(r){
  if(!r){selMarker.visible=false;return;}
  const nv=shellNormal(r.X,r.Y,r.Z);
  toThree(r.X,r.Y,r.Z,selMarker.position).addScaledVector(nv,0.2);
  selMarker.quaternion.setFromUnitVectors(new V3(0,0,1),nv);selMarker.visible=true;
}
ui.subscribe((k,o)=>{
  if(k==='layer'){syncLayer();rebuildHeat();tip.hidden=true;}
  if(k==='select'||k==='fly'){const r=store&&store.get(ui.selId);
    if(k==='select'){placeMarker(r);if(r)selectFR(r.fr);}
    if(r&&o&&o.fly)flyTo(r);}
});
/* mapping state (SPEC 10.1, 10.2)
   mapping: heatmap fills in behind the robot · paused: heatmap, robot and path stay where they are ·
   done: whole ship + all results, robot and path hidden; "재매핑" only in the ⋯ menu */
const poseText=p=>`${loc(p.fr,p.strake,p.side,p.zone)}·${coords(p.X,p.Y,p.Z)}`;
let mapMode=null,robotSeen=false;
function syncMap(){
  const st=store.mapState,active=st==='mapping'||st==='paused',pct=progress(store.progress);
  const ms=$('#mapState');ms.classList.toggle('on',st==='mapping');ms.classList.toggle('paused',st==='paused');ms.classList.toggle('done',st==='done');
  $('#mapStateTxt').textContent=st==='mapping'?`매핑 중·${pct}`:st==='paused'?`매핑 중지·${pct}`:'매핑 완료';
  const btn=$('#mapBtn');btn.hidden=!active;btn.textContent=st==='mapping'?'매핑 중지':'이어서 매핑';btn.classList.toggle('secondary',st==='mapping');
  $('.map-more').hidden=!(st==='paused'||st==='done');
  $('#speedSeg').hidden=!active;   // replay speed only matters while a run is going or paused
  const again=st==='paused'?'처음부터 다시':'재매핑';$('#mapRestart').textContent=again;$('#mapConfirm').textContent=again;
  $('#stRobotWrap').classList.toggle('idle',st!=='mapping');
  if(st==='done')$('#stRobot').textContent=`매핑 완료·측정점 ${num(store.records.length)}개·마지막 측정 ${store.lastTs?dateTime(store.lastTs):'—'}`;
  if(st==='paused')$('#stRobot').textContent=store.pose?`매핑 중지·${poseText(store.pose)}·진행 ${pct}`:`매핑 중지·진행 ${pct}`;
  if(!active||!store.pose){robotWrap.visible=false;robotSeen=false;}
  pathGroup.visible=active&&lyRobotOn;
  if(st!==mapMode){
    const prev=mapMode;mapMode=st;
    // robot follow (mapping only): every run start (fresh or resumed) moves to ISO first and follows from there;
    // the end of the traversal stops it and brings the camera back to ISO (the KPI panel selects rank 1 at the same time)
    follow.on=follow.engaging=follow.paused=false;
    if(st==='mapping'){if(prev!=='paused')follow.raw=null;startFollow(ISO);}
    else if(st==='done'&&(prev==='mapping'||prev==='paused'))goView('iso');
    openMenu(false);paintHull();syncFollowBtn();}
}
function onPose(p){
  follow.raw=followAngle(p);
  setRobotTarget(p,!robotSeen);robotSeen=true;robotWrap.visible=true;showPathAt(p.k);
  const pct=progress(p.progress);
  $('#mapStateTxt').textContent=`매핑 중·${pct}`;
  $('#stRobot').textContent=`RBT-01 매핑 중·${poseText(p)}·진행 ${pct}`;
}
$('#mapBtn').addEventListener('click',()=>{if(!store)return;if(store.mapState==='mapping')store.pause();else if(store.mapState==='paused')store.resume();});
// ⋯ menu: restart from the beginning, confirmed inside the menu (no browser confirm)
const mapMenu=$('#mapMenu'),mapMoreBtn=$('#mapMoreBtn');
function openMenu(on){
  mapMenu.hidden=!on;mapMoreBtn.setAttribute('aria-expanded',String(on));
  mapMenu.querySelector('.menu-main').hidden=false;mapMenu.querySelector('.menu-confirm').hidden=true;
  if(on)$('#mapRestart').focus();
}
mapMoreBtn.addEventListener('click',()=>openMenu(mapMenu.hidden));
$('#mapRestart').addEventListener('click',()=>{mapMenu.querySelector('.menu-main').hidden=true;mapMenu.querySelector('.menu-confirm').hidden=false;$('#mapCancel').focus();});
$('#mapCancel').addEventListener('click',()=>{openMenu(false);mapMoreBtn.focus();});
$('#mapConfirm').addEventListener('click',()=>{openMenu(false);if(store)store.start();});
// overlays close on an outside press or Esc (Esc is marked handled so a maximized panel stays maximized)
document.addEventListener('pointerdown',e=>{
  if(!mapMenu.hidden&&!e.target.closest('.map-more'))openMenu(false);
  if(!legendPop.hidden&&!e.target.closest('#legendPop,#legendBtn'))openLegend(false);
});
window.addEventListener('keydown',e=>{if(e.key!=='Escape')return;
  if(!mapMenu.hidden){openMenu(false);mapMoreBtn.focus();e.preventDefault();}
  else if(!legendPop.hidden){openLegend(false);legendBtn.focus();e.preventDefault();}
},true);
/* 실선 | 도면 (VIEW row): 도면 = dark navy hull, orange design lines (waterlines, stations, frames); the heatmap stays */
function setLook(l){
  look=l;const bp=l==='bp';
  document.querySelectorAll('[data-look]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.look===l)));
  hullMat.roughness=bp?0.95:0.7;
  deckMat.color.setHex(bp?0x0c1528:0xAAB2BD);trMat.color.setHex(bp?0x0c1528:0xC4CAD2);
  supMat.color.setHex(bp?0x0f1a30:0xC9CED6);supEdgeMat.color.setHex(bp?0xFBB584:0x5F6A7C);supEdgeMat.opacity=bp?0.6:0.9;
  bpLines.visible=bp;
  frameMat.color.setHex(bp?0xFBB584:0x5C687D);frameMat.opacity=bp?0.45:0.3;
  frameMajMat.color.setHex(bp?0xF89B6C:0x34415A);frameMajMat.opacity=bp?0.85:0.7;
  seamMat.color.setHex(bp?0xFBB584:0x5C687D);seamMat.opacity=bp?0.3:0.26;
  sheerMat.color.setHex(bp?0xFBB584:0x34415A);sheerMat.opacity=bp?0.7:0.7;
  dwlMat.color.setHex(bp?0x7FA6E8:0x2F5597);
  zoneMat.color.setHex(bp?0xC9D3E3:0x1F2D4A);
  // scan path keeps its contrast on the navy hull
  if(trailLine){trailLine.material.color.setHex(bp?0xFBB584:0x1F2D4A);trailLine.material.opacity=bp?0.3:0.18;
    rowLine.material.color.setHex(bp?0xffffff:0x000000);nextLine.material.color.setHex(bp?0xC9D3E3:0x1F2D4A);}
  paintHull();
}
document.querySelectorAll('[data-look]').forEach(b=>b.addEventListener('click',()=>setLook(b.dataset.look)));
function setSpeed(k){if(store)store.setSpeed(k);document.querySelectorAll('[data-speed]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.speed===k)));}
document.querySelectorAll('[data-speed]').forEach(b=>b.addEventListener('click',()=>setSpeed(+b.dataset.speed)));
storeReady.then(s=>{store=s;buildPath(s.plan);setSpeed(10);
  setLook(look);createKpiPanel($('#paneKpi .pane-body'),$('#paneList .pane-body'),$('#listCount'),s,ui);
  // diagnostic report (SPEC 6, 10.9): loaded on demand; ?report=preview shows the 5 pages instead of the dashboard
  import('./report/index.js').then(rep=>{rep.setupReportButton($('#reportBtn'),s,toast);
    if(new URLSearchParams(location.search).get('report')==='preview')rep.showPreview(s);});createSideShell($('#paneShell .pane-body'),s,ui);
  createDetailPanel($('#paneDetail .pane-body'),s,ui);
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
lay('#lyRobot',on=>{lyRobotOn=on;pathGroup.visible=on&&!!store&&(store.mapState==='mapping'||store.mapState==='paused');});
lay('#lyZones',on=>{zoneLines.visible=on;zoneLabels.forEach(l=>l.el.hidden=!on);});
$('#cutTog').addEventListener('change',e=>{state.cut=e.target.checked;const planes=state.cut?[clipPlane]:[];clipMats.forEach(m=>{m.clippingPlanes=planes;m.needsUpdate=true;});});

/* camera: view presets and fly-to share one tween that swings around the target while zooming (ease-in-out, ~1 s) */
let tween=null,pulseUntil=0;
const FLY_MS=1000,FLY_DIST=30;   // m: the point plus 2–3 frames around it
function startTween(to,onDone){
  const p0=camera.position.clone(),t0=controls.target.clone(),d0=p0.clone().sub(t0),d1=to.p.clone().sub(to.t);
  if(reduce){camera.position.copy(to.p);controls.target.copy(to.t);controls.update();if(onDone)onDone();return;}
  const a=d0.clone().normalize(),b=d1.clone().normalize();
  tween={t0,t1:to.t.clone(),dir0:a,q:new THREE.Quaternion().setFromUnitVectors(a,b),l0:Math.log(d0.length()),l1:Math.log(d1.length()),start:performance.now(),onDone};
}
const flyBack=$('#flyBack');
function pressView(k){document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===k)));}
function goView(k){pauseFollow();pressView(k);curView=k;flyBack.hidden=true;startTween(fitPreset(k));}
/* fly to a measurement point: look at it along the outward shell normal from ~30 m; bottom points are seen from below */
function flyTo(r){
  const t=toThree(r.X,r.Y,r.Z),dir=shellNormal(r.X,r.Y,r.Z);
  if(dir.y<-0.85){dir.x+=0.12;dir.z+=(r.Y<0?1:-1)*0.35;dir.normalize();}   // straight up would be a degenerate view
  pauseFollow();pressView(null);curView=null;flyBack.hidden=false;
  startTween({p:t.clone().addScaledVector(dir,FLY_DIST),t},()=>{pulseUntil=performance.now()+2000;});
}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>goView(b.dataset.view)));
flyBack.addEventListener('click',()=>goView('iso'));
controls.addEventListener('start',()=>{tween=null;curView=null;pressView(null);pauseFollow();});

/* robot follow while mapping: the ship stays put and the camera turns around the ship centre so the face the robot is on stays in view.
   direction = ISO (a bow-quarter look from above) turned left/right only: starboard strakes → ISO, port strakes → ISO mirrored.
   bottom strakes lower the elevation to the 선저 preset's, looking up from below; bottom or not is judged per strake on the
   midship section, so the view only changes when the robot changes strake (row ends at the bow/stern do not pull it).
   distance: fitted for the current elevation seen from the ISO azimuth — exactly the ISO preset's at ISO elevation; turning
   toward the bow (crossing the keel) needs less, so it never zooms in.
   two low-pass stages (goal, then camera; ~3 s in all) so small robot moves do not shake the view.
   the user orbiting/zooming, a view preset or a fly-to pauses it; "로봇 따라가기" swings back and resumes. */
const FOLLOW_T=new V3(...PRESETS.iso.t),FOLLOW_TAU=[1.2,1.6];
const presetAngles=k=>{const d=new V3(...PRESETS[k].p).sub(new V3(...PRESETS[k].t)).normalize();return {az:Math.atan2(d.z,d.x),el:Math.asin(d.y)};};
const ISO=presetAngles('iso'),EL_BOTTOM=presetAngles('bottom').el;   // az: from the bow (+x) toward starboard (+z)
const follow={paused:false,on:false,engaging:false,raw:null,goal:{...ISO},cur:{...ISO}};
const followBtn=$('#followBtn');
const followDir=(a,out=new V3())=>out.set(Math.cos(a.el)*Math.cos(a.az),Math.sin(a.el),Math.cos(a.el)*Math.sin(a.az));
const followDist=el=>fitDir(followDir({az:ISO.az,el}),FOLLOW_T).p.distanceTo(FOLLOW_T);
const followPose=a=>({p:FOLLOW_T.clone().addScaledVector(followDir(a),followDist(a.el)),t:FOLLOW_T.clone()});
const strakeBottom=new Map(),MID=L/2,midSec=section(MID);
function followAngle(p){
  let b=strakeBottom.get(p.strake);
  if(b===undefined){   // 0 = side shell … 1 = bottom, from how far the strake's outward normal points down on the midship section
    const i=p.strake==='K'?-1:LETTERS.indexOf(p.strake),g=Math.min(i<0?KEEL_HALF/2:strakeLower(i)+STRAKE_W/2,midSec.gs[G-1]*0.999);
    const q=atGirth(midSec,g)||{Y:B/2,Z:D},n=shellNormal(MID,-q.Y,q.Z);
    b=smooth(-0.3,-0.8,n.y/(Math.hypot(n.y,n.z)||1));if(reduce)b=b<0.5?0:1;
    strakeBottom.set(p.strake,b);
  }
  return {az:p.side==='P'?-ISO.az:ISO.az,el:ISO.el+(EL_BOTTOM-ISO.el)*b};
}
function syncFollowBtn(){followBtn.hidden=!(store&&store.mapState==='mapping'&&follow.paused);}
function pauseFollow(){
  if(store&&store.mapState==='mapping')follow.paused=true;
  follow.on=follow.engaging=false;syncFollowBtn();
}
/* swing from wherever the camera is to the follow view at angles a (the usual 1 s tween), then track from there */
function startFollow(a){
  follow.engaging=true;follow.on=false;curView=null;pressView(null);flyBack.hidden=true;
  startTween(followPose(a),()=>{if(!follow.engaging)return;follow.engaging=false;follow.on=true;follow.goal={...a};follow.cur={...a};});
}
function stepFollow(dt){
  if(!follow.on||!store||store.mapState!=='mapping')return;
  const to=follow.raw,gl=follow.goal,c=follow.cur;
  if(to&&reduce){follow.goal={...to};follow.cur={...to};}
  else if(to){const k1=1-Math.exp(-dt/FOLLOW_TAU[0]),k2=1-Math.exp(-dt/FOLLOW_TAU[1]);
    for(const k of ['az','el']){gl[k]+=(to[k]-gl[k])*k1;c[k]+=(gl[k]-c[k])*k2;}}
  const f=followPose(follow.cur);camera.position.copy(f.p);controls.target.copy(f.t);
}
followBtn.addEventListener('click',()=>{follow.paused=false;syncFollowBtn();startFollow(follow.raw||ISO);});

/* frame info card: fold to a small "FR 170" chip (SPEC 10.4) */
const secCard=$('#secCard');
function foldSec(on){secCard.classList.toggle('collapsed',on);lsSet('drdock.secCard',on?'1':'0');(on?$('#secExpand'):$('#secCollapse')).focus({preventScroll:true});}
$('#secCollapse').addEventListener('click',()=>foldSec(true));
$('#secExpand').addEventListener('click',()=>foldSec(false));
if(lsGet('drdock.secCard')==='1')secCard.classList.add('collapsed');

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
  const h=hits[0],p=h.point;const lp=h.object.worldToLocal(p.clone());
  const f=h.face;tri.set(vA.fromArray(pos,f.a*3),vB.fromArray(pos,f.b*3),vC.fromArray(pos,f.c*3)).getBarycoord(lp,bary);
  const g=bary.x*girth[f.a]+bary.y*girth[f.b]+bary.z*girth[f.c];
  const X=p.x+XC,Z=p.y,Y=-p.z,fr=Math.round(X/FS),side=h.object.userData.side,u=side==='P'?g:-g;
  const st=strakeName(g),near=nearest(heatIx,X,u,NEAR_D),rec=near?near.r:null;
  lastHit={fr,X,rec};
  let val='<div class="none">측정값 없음</div>';
  if(rec){const lv=judge(rec,ui.layer).level;
    const cx=isTop(rec,ui.layer);val=`<div class="tv"><b>${value(rec,ui.layer)}</b><span class="lv lv${gradeOf(lv,cx)}">${gradeLabel(lv,cx)}</span></div>`;}
  const zone=ZONES[zoneOf(X,Z)],[frTxt,...rest]=loc(fr,st,side,zone).split('·');   // FR bold, the rest of the same line lighter
  tip.innerHTML=`<div class="t1">${frTxt}<em>·${rest.join('·')}</em></div><div class="t2">${LAYER_LABEL[ui.layer]}</div>${val}<div class="t3">${coords(X,Y,Z)}</div>`;
  tip.hidden=false;const pw=r.width;tip.style.left=(e.clientX-r.left)+'px';tip.style.top=(e.clientY-r.top)+'px';
  tip.style.transform=(e.clientX-r.left)>pw-260?'translate(calc(-100% - 14px),14px)':'translate(14px,14px)';
  hoverDot.position.copy(p);hoverDot.visible=true;
  setHover(X,'3d');
  $('#stCursor').textContent=`${loc(fr,st,side,zone)}·${coords(X,Y,Z)}`;
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
  if(tween){const k=Math.min(1,(now-tween.start)/FLY_MS),e=k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;
    controls.target.lerpVectors(tween.t0,tween.t1,e);
    const dir=tween.dir0.clone().applyQuaternion(new THREE.Quaternion().slerp(tween.q,e));
    camera.position.copy(controls.target).addScaledVector(dir,Math.exp(tween.l0+(tween.l1-tween.l0)*e));
    if(k>=1){const done=tween.onDone;tween=null;if(done)done();}}
  stepFollow(dt);
  controls.update();
  if(robotWrap.visible){const e=1-Math.exp(-dt*14);robotGroup.position.lerp(rbTarget.p,e);robotGroup.quaternion.slerp(rbTarget.q,e);
    rbLocator.scale.setScalar(clamp(camera.position.distanceTo(robotGroup.position)/120,1,3.5));
    if(!reduce){const ph=(now/1000)%1.4/1.4;rbPulse.scale.setScalar(1+ph*0.8);rbPulse.material.opacity=0.6*(1-ph);}}
  if(pendingMove){pick(pendingMove);pendingMove=null;}
  if(selMarker.visible)selMarker.scale.setScalar(clamp(camera.position.distanceTo(selMarker.position)/110,0.45,4));
  // close-up after a fly-to: the whole-frame section ring would cover the point, so it steps aside
  const near=camera.position.distanceTo(controls.target)<90;if(ringMesh)ringMesh.visible=!near;selLabel.hidden=near;
  selPulse.visible=selMarker.visible&&now<pulseUntil;
  if(selPulse.visible){const ph=(now%700)/700;selPulse.scale.setScalar(1+ph*1.6);selPulse.material.opacity=0.9*(1-ph);}
  zoneLabels.forEach(l=>{if(!l.el.hidden)place(l.el,l.p);});
  frLabels.forEach(l=>{if(!l.el.hidden)place(l.el,l.p);});place(selLabel,selLabelPos);
  renderer.render(scene,camera);drawGizmo();
  requestAnimationFrame(loop);
}
syncLayer();paintHull();selectFR(state.selFR);
setupPanels($('.main'));
// LAYERS starts folded every time (index.html, no 'open'); its state is not remembered
requestAnimationFrame(loop);
})();
