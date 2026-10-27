/* =========================================================
   HULL FORM  (Wally Schirra — dimensions in data/baseline.js)
   Ship CS: X from AP (+fwd, −5 … 205 m), Y half-breadth (+port), Z from baseline. Frames: FR = X / FS (FR −6 … 256)
   The exterior design is the original parametric form (long parallel midbody, bulbous bow, transom stern), unchanged,
   scaled to the ship's dimensions: lengthwise to LOA, breadth to B, height to D (the design draught lands on T).
   Shared by the 3D viewer and the robot data simulator.
   ========================================================= */
import { BEAM, DEPTH, DRAFT, DRAFT_LIGHT, WL_TOP, LBP, X_MIN, X_MAX, FRAME_SPACING, FR_MIN, FR_MAX,
  STRAKE_W as SW, KEEL_HALF as KH, KEEL_BLOCK, BOW_FR, STERN_FR } from './data/baseline.js';
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};

/* the original form's own units (design kept as is) and the scale onto the ship */
const O={L:289,B:46.4,D:26.5,R:2.6,LOA:298.6};
export const SX=(X_MAX-X_MIN)/O.LOA, SY=BEAM/O.B, SZ=DEPTH/O.D;
const toO=X=>(X-X_MIN)/SX;   // ship X (m) → the original form's X

export const L=LBP, B=BEAM, D=DEPTH, T=DRAFT, R=O.R*SZ, FS=FRAME_SPACING;
export const XMIN=X_MIN, XMAX=X_MAX, XC=(XMIN+XMAX)/2, FRMIN=FR_MIN, FRMAX=FR_MAX;
export const NX=300, NB=12, NS=48, G=NB+1+NS;
export const KEEL_HALF=KH, STRAKE_W=SW, LETTERS="ABCDEFGHJLMNPQRSTUV";
export const WLS=[2,4,6,8,14,18,22].map(z=>+(z*SZ).toFixed(2));
export const BOTTOM_FLAT=(O.B/2-O.R)*SY;   // half-breadth of the flat bottom (m)
/* frame ↔ X (m): measurements keep X; frames are for display only */
export const frX=fr=>fr*FS;
export const frOf=X=>Math.round(X/FS);

function deckZo(X){const xn=X/O.L;return O.D+(xn>0.86?3.2*Math.pow(Math.min((xn-0.86)/0.16,1.1),2):0);}
function keelZo(X){const xn=X/O.L;if(xn<0.05){const t=(0.05-xn)/0.05;return 9.5*t*t;}return 0;}
function rake(Z){return 7.0*Math.pow(clamp(Z/O.D,0,1.3),1.6);}
function midHB(Z){if(Z>=O.R)return O.B/2;const dz=O.R-Z;return O.B/2-O.R+Math.sqrt(Math.max(0,O.R*O.R-dz*dz));}
function hullHB(X,Z){
  if(X<0||Z<keelZo(X)-1e-6||Z>deckZo(X)+1e-6)return 0;
  const zn=clamp(Z/O.D,0,1);let w=1;
  const xnf=(X-rake(Z))/O.L;
  if(xnf>=1)return 0;
  if(xnf>0.70){const t=(xnf-0.70)/0.30;w*=Math.max(0,1-Math.pow(t,1.6+2.4*zn));}
  const xn=X/O.L;
  if(xn<0.24){const t=(0.24-xn)/0.24;const p=0.6+2.6*zn;const tw=0.80*smooth(0.30,0.85,zn);w*=1-Math.pow(t,p)*(1-tw);}
  return midHB(Z)*w;
}
function bulbHB(X,Z){const u=((X-(O.L+2.5))/7)**2+((Z-6)/4.6)**2;return u>=1?0:3.4*Math.sqrt(1-u);}
export function deckZ(X){return deckZo(toO(X))*SZ;}
export function keelZ(X){return keelZo(toO(X))*SZ;}
export function HB(X,Z){const x=toO(X),z=Z/SZ;return Math.max(hullHB(x,z),z>=0?bulbHB(x,z):0)*SY;}

export function section(X){
  const zk=keelZ(X),zd=deckZ(X);
  const Ys=new Float32Array(G),Zs=new Float32Array(G),gs=new Float32Array(G);
  const yb=HB(X,zk);
  for(let j=0;j<=NB;j++){Ys[j]=yb*j/NB;Zs[j]=zk;}
  for(let k=1;k<=NS;k++){const s=k/NS;const Z=zk+(zd-zk)*Math.pow(s,1.5);Ys[NB+k]=HB(X,Z);Zs[NB+k]=Z;}
  for(let j=1;j<G;j++)gs[j]=gs[j-1]+Math.hypot(Ys[j]-Ys[j-1],Zs[j]-Zs[j-1]);
  return {Ys,Zs,gs,yb};
}
/* strake bands along the girth (from keel CL): K = 0..KEEL_HALF, then A, B, … each STRAKE_W wide */
export function strakeName(g){if(g<KEEL_HALF)return 'K';const i=Math.floor((g-KEEL_HALF)/STRAKE_W);return LETTERS[Math.min(i,LETTERS.length-1)];}
export function strakeLower(i){return i<0?0:KEEL_HALF+STRAKE_W*i;}   // i = -1 for K, 0 for A …
/* zone names: stored in measurement records (spec 3.1) and shown as they are everywhere (format.js) */
export const ZONES=['선저','빌지','선측','흘수선','건현','선수','선미'];
/* 선수 = FR 220 이후, 선미 = FR 10 이전. 나머지는 높이: 선저 · 빌지 · 선측(수선 아래) · 흘수선(수선부 5.6–9.4 m) · 건현 */
export function zoneOf(X,Z){if(X>=BOW_FR*FS)return 5;if(X<STERN_FR*FS)return 6;if(Z<0.15)return 0;if(Z<R+0.6)return 1;if(Z<DRAFT_LIGHT)return 2;if(Z<WL_TOP)return 3;return 4;}
/* frame card: where along the hull (the form's own run / parallel midbody / entrance limits) */
export function regionOf(X){const xn=toO(X)/O.L;if(X<STERN_FR*FS)return '선미';if(xn<0.24)return '선미 곡면부';if(xn<0.70)return '평행 중앙부';if(X<BOW_FR*FS)return '선수 곡면부';return '선수';}
export function strakeAt(X,Z){const s=section(X);let j=NB;for(let k=0;k<G-1;k++){if(s.Zs[k]<=Z&&s.Zs[k+1]>=Z&&k>=NB){j=k;break;}}return strakeName(s.gs[j]);}

/* point on the shell at girth g (m from keel CL) of section s; null where the shell is degenerate */
export function atGirth(s,g){
  if(g<0||g>s.gs[G-1])return null;
  let j=0;while(j<G-2&&s.gs[j+1]<g)j++;
  const valid=k=>k<=NB?s.yb>0.02:s.Ys[k]>0.02;if(!valid(j)||!valid(j+1))return null;
  const t=(g-s.gs[j])/((s.gs[j+1]-s.gs[j])||1);
  return {Y:s.Ys[j]+(s.Ys[j+1]-s.Ys[j])*t,Z:s.Zs[j]+(s.Zs[j+1]-s.Zs[j])*t,bottom:j<NB};
}
/* girth of the shell point nearest to (|Y|, Z) on section s */
export function girthOf(s,Y,Z){
  const y=Math.abs(Y);let best=0,bd=1e9;
  for(let j=0;j<G-1;j++){const ay=s.Ys[j],az=s.Zs[j],dy=s.Ys[j+1]-ay,dz=s.Zs[j+1]-az,l2=dy*dy+dz*dz||1e-9;
    const t=clamp(((y-ay)*dy+(Z-az)*dz)/l2,0,1),d=(ay+dy*t-y)**2+(az+dz*t-Z)**2;
    if(d<bd){bd=d;best=s.gs[j]+(s.gs[j+1]-s.gs[j])*t;}}
  return best;
}
/* signed girth u (m from keel CL, port +) of a ship point; measurement records are cached */
export function signedGirth(X,Y,Z,side){return girthOf(section(X),Y,Z)*(side==='P'?1:-1);}
const recU=new WeakMap();
export function recordU(r){let u=recU.get(r);if(u===undefined){u=signedGirth(r.X,r.Y,r.Z,r.side);recU.set(r,u);}return u;}
/* girth from keel CL to the point at height Z on section s */
export function girthAtZ(s,Z){
  for(let j=NB;j<G-1;j++){if(s.Zs[j+1]>=Z){const t=(Z-s.Zs[j])/((s.Zs[j+1]-s.Zs[j])||1);return s.gs[j]+(s.gs[j+1]-s.gs[j])*clamp(t,0,1);}}
  return s.gs[G-1];
}

export const stX=new Float32Array(NX+1),stSec=[];
for(let i=0;i<=NX;i++){stX[i]=XMIN+(XMAX-XMIN)*i/NX;stSec.push(section(stX[i]));}
export const stIndex=X=>clamp(Math.round((X-XMIN)/(XMAX-XMIN)*NX),0,NX);   // nearest mesh station

/* keel blocks under the bottom centreline: footprint centre (X, Y) and contact size (m). Contact areas cannot be measured. */
export const BLOCK_SIZE={dx:KEEL_BLOCK.len,dy:KEEL_BLOCK.half*2};
export const KEEL_BLOCKS=[];
for(let X=KEEL_BLOCK.x0;X<=KEEL_BLOCK.x1+1e-6;X+=KEEL_BLOCK.spacing)KEEL_BLOCKS.push({X:Math.round(X*100)/100,Y:0});
