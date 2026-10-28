/* =========================================================
   HULL FORM  (a made-up Panamax-size merchant ship — dimensions and form values in data/baseline.js)
   Ship CS: X from AP (+fwd, −5 … 205 m), Y half-breadth (+port), Z from baseline. Frames: FR = X / FS (FR −6 … 256)
   A tanker / bulk carrier like form: long parallel midbody, raked and flared bow with a bulb faired into it, forecastle,
   counter stern over an open propeller aperture, skeg grown out of the bottom, poop under the accommodation, flat transom.
   Everything (girth, heat, S.SHELL, picking, the robot path) is computed from HB(X, Z), keelZ(X) and deckZ(X) here.
   Shared by the 3D viewer and the robot data simulator.
   ========================================================= */
import { BEAM, DEPTH, DRAFT, DRAFT_LIGHT, WL_TOP, LBP, X_MIN, X_MAX, FRAME_SPACING, FR_MIN, FR_MAX,
  STRAKE_W as SW, KEEL_HALF as KH, KEEL_BLOCK, BOW_FR, STERN_FR, MANUAL, HULL_FORM as HF } from './data/baseline.js';
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};

/* the superstructure's design units and their scale onto the ship (hullMesh.SUPER_BOXES, the waterline heights) */
const O={B:46.4,D:26.5,R:2.6,LOA:298.6};
export const SX=(X_MAX-X_MIN)/O.LOA, SY=BEAM/O.B, SZ=DEPTH/O.D;

export const L=LBP, B=BEAM, D=DEPTH, T=DRAFT, R=O.R*SZ, FS=FRAME_SPACING;
export const XMIN=X_MIN, XMAX=X_MAX, XC=(XMIN+XMAX)/2, FRMIN=FR_MIN, FRMAX=FR_MAX;
export const NX=300, NB=12, NS=48, G=NB+1+NS;
export const KEEL_HALF=KH, STRAKE_W=SW, LETTERS="ABCDEFGHJLMNPQRSTUV";
export const WLS=[2,4,6,8,14,18,22].map(z=>+(z*SZ).toFixed(2));
export const BOTTOM_FLAT=B/2-R;   // half-breadth of the flat bottom amidships (m)
/* frame ↔ X (m): measurements keep X; frames are for display only */
export const frX=fr=>fr*FS;
export const frOf=X=>Math.round(X/FS);

/* The form is built from signed half-breadth² fields (m²: positive inside the hull, negative outside), so two parts can be
   joined with a smooth union (smax) — a round fillet where they are within k of each other, the plain max elsewhere
   (no film past the stem), so no groove or kink where they meet. HB = √field. */
const sq=h=>h<0?-h*h:h*h;
const smax=(a,b,k)=>{const h=Math.max(k-Math.abs(a-b),0)/k;return Math.max(a,b)+h*h*k/4;};
const rad=d=>d*Math.PI/180,TAN_RAKE=Math.tan(rad(HF.stem.rake)),BH=B/2;

/* main deck (m): sheer rising forward to the forecastle and aft to the poop, each of those raised by its height */
export function deckZ(X){
  const S=HF.sheer,F=HF.forecastle,P=HF.poop;let z=D;
  if(X>S.fwdX0)z+=S.fwd*Math.min(1,(X-S.fwdX0)/(F.x0-S.fwdX0))**2;
  if(X<S.aftX0)z+=S.aft*Math.min(1,(S.aftX0-X)/(S.aftX0-P.x1))**2;
  if(X>=F.x0)z+=F.h+F.stem*((X-F.x0)/(X_MAX-F.x0))**2;
  if(X<=P.x1)z+=P.h;
  return z;
}
/* midship section: flat bottom, bilge radius R, vertical side */
function midHB(Z){if(Z>=R)return BH;const dz=R-Z;return BH-R+Math.sqrt(Math.max(0,R*R-dz*dz));}

/* --- bow --- */
/* stem line: through FP (x = LBP) at the design waterline, raked forward; the forefoot rounds it into the keel (tangent to it) */
function stemX(Z){const f=HF.forefoot;let x=L+(Z-T)*TAN_RAKE;if(Z<f.h){const t=(f.h-Math.max(Z,0))/f.h;x-=f.r*(1-Math.sqrt(1-t*t));}return x;}
/* waterline fullness p (waterlines 1 − t^p): the entrance angle at the design waterline, a little finer below,
   fuller towards the forecastle deck (= flare); smooth in Z so the shell has no knuckle */
const Z_FC=D+HF.sheer.fwd+HF.forecastle.h;
const P0=Math.tan(rad(HF.entrance))*(stemX(T)-HF.midbody.x1)/BH;
function fullness(Z){return Z<=T?P0*(0.75+0.25*smooth(-T,T,Z)):P0+(HF.flare-P0)*smooth(T,Z_FC,Z);}
/* forebody field: from the end of the midbody (t = 0) to the stem (t = 1), negative past the stem */
function foreF(X,Z){const x1=HF.midbody.x1;if(X<=x1)return sq(midHB(Z));const t=(X-x1)/(stemX(Z)-x1);return sq(midHB(Z)*(1-Math.pow(t,fullness(Z))));}
/* the bulb ellipsoid (centre x, z; semi-axes along x, z, y) — the 3D bow cap rounds the tip with it (hullMesh.js) */
export const BULB={x:HF.bulb.x,len:HF.bulb.len,z:HF.bulb.z,h:HF.bulb.h,w:HF.bulb.w};
function bulbF(X,Z){return BULB.w**2*(1-((X-BULB.x)/BULB.len)**2-((Z-BULB.z)/BULB.h)**2);}

/* --- stern --- */
/* bottom of the afterbody: 0 at run.x0, rising smoothly (flat at both ends) to the transom's lower edge */
function runZ(X){const r=HF.run,u=clamp((r.x0-X)/(r.x0-X_MIN),0,1);return HF.transom.z*(1-(1-u**r.q)**r.r);}
/* the skeg's raked aft edge: x at height Z (x1 at the keel → x2 where it meets the counter) */
export function skegAftX(Z){const s=HF.skeg;return s.x1+(s.x2-s.x1)*clamp(Z/runZ(s.x2),0,1);}
/* afterbody field: sections narrowing and rounding aft over the rising bottom (U sections by the skeg, a flatter counter
   towards the transom), unioned with the skeg fin so the bottom gathers into it */
function aftF(X,Z){
  const u=clamp((HF.run.x0-X)/(HF.run.x0-X_MIN),0,1),bw=BH*(1-(1-HF.transom.w)*u**2.5);
  const rb=(R+(bw-R)*smooth(0,0.35,u))*(1-0.4*smooth(0.72,1,u)),dz=Z-runZ(X);
  const h=dz>=rb?bw:dz>=0?bw-rb+Math.sqrt(rb*rb-(rb-dz)**2):bw-rb+30*dz;
  // skeg: a thin fin at its aft edge, widening forward into a V that merges with the bottom (deadwood); held inside the
  // section's breadth (0.9 bw), so high up it never pushes the side out past the beam
  const s=HF.skeg,xe=skegAftX(Z),w=Math.min(s.half+s.v*Z*smooth(s.x1+2,32,X),0.9*bw),hs=X>=xe?w:w-8*(xe-X);
  return smax(sq(h),sq(hs),s.blend);
}
/* smallest curvature radius of the bulb ellipsoid at (X, Z) (m): 1 / the larger principal curvature at its surface point
   (the tightest bend in any direction) — Infinity off the ellipsoid */
export function bulbRadius(X,Z){
  const A=[BULB.len,BULB.w,BULB.h],x=X-BULB.x,z=Z-BULB.z,y2=1-(x/A[0])**2-(z/A[2])**2;if(y2<=0)return Infinity;
  const q=[x,A[1]*Math.sqrt(y2),z],g=q.map((v,i)=>2*v/A[i]**2),gl=Math.hypot(...g),n=g.map(v=>v/gl),Hd=A.map(v=>2/v**2);
  const e=[0,1,2].reduce((m,i)=>Math.abs(n[i])<Math.abs(n[m])?i:m,0),u=[0,0,0];u[e]=1;   // the axis least along the normal
  const cr=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],nz=v=>{const l=Math.hypot(...v);return v.map(c=>c/l);};
  const t1=nz(cr(n,u)),t2=cr(n,t1),h=(a,b)=>(a[0]*b[0]*Hd[0]+a[1]*b[1]*Hd[1]+a[2]*b[2]*Hd[2])/gl;   // shape operator on the tangent plane
  const s11=h(t1,t1),s12=h(t1,t2),s22=h(t2,t2),m=(s11+s22)/2,kmax=m+Math.sqrt(Math.max(0,m*m-(s11*s22-s12*s12)));
  return 1/kmax;
}
/* the shell at (X, Z) cannot be measured (baseline.MANUAL): 'stern' (propeller·rudder·skeg) or 'bulb' (the bulb's nose:
   within the bulb's heights, forward of its centre, where the shell is the bulb itself and its curvature radius is under rMax) — else null */
export function unmeasurable(X,Z){
  for(const m of MANUAL){
    if(X<m.x0-1e-6||X>m.x1+1e-6||Z<m.z0-1e-6||Z>m.z1+1e-6)continue;
    if(m.key!=='bulb')return m.key;
    const b=bulbF(X,Z);
    if(X>=BULB.x&&b>0&&b>=foreF(X,Z)-1e-6&&bulbRadius(X,Z)<m.rMax)return m.key;
  }
  return null;
}
/* half-breadth (m) at (X, Z): forebody ∪ bulb, midbody, afterbody ∪ skeg; 0 outside the shell */
export function HB(X,Z){
  if(Z<-1e-6||Z>deckZ(X)+1e-6)return 0;
  const f=X>=HF.midbody.x1?smax(foreF(X,Z),bulbF(X,Z),HF.bulb.blend):X<=HF.run.x0?aftF(X,Z):sq(midHB(Z));
  return f>0?Math.sqrt(f):0;
}
/* keel (lowest shell point on the centreline): the baseline, except abaft the skeg — its raked aft edge, then the
   counter over the propeller aperture (found on HB) */
export function keelZ(X){
  if(X>=HF.skeg.x1)return 0;
  const has=Z=>HB(X,Z)>0.005,top=deckZ(X);let a=0,b=null;
  for(let Z=0;Z<=top;Z+=0.1){if(has(Z)){b=Z;break;}a=Z;}
  if(b===null)return top;if(b===0)return 0;
  for(let k=0;k<20;k++){const m=(a+b)/2;if(has(m))b=m;else a=m;}
  return b;
}

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
/* frame card: where along the hull (the run / parallel midbody / entrance limits, HULL_FORM.midbody) */
export function regionOf(X){const M=HF.midbody;if(X<STERN_FR*FS)return '선미';if(X<M.x0)return '선미 곡면부';if(X<=M.x1)return '평행 중앙부';if(X<BOW_FR*FS)return '선수 곡면부';return '선수';}
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
