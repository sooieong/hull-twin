/* =========================================================
   선체 외판 메시 데이터 (대시보드 3D 뷰와 보고서 3D 렌더가 함께 쓴다)
   three.js 좌표: x = X − XC (선수 +), y = Z (위 +), z = 우현 반폭 (좌현 메시는 z를 뒤집어 쓴다)
   표시용 위치: 한 단면에서 외판이 없는 높이의 점은 중심선(y = 0)으로 옮겨 좌우 외판이 틈 없이 만난다.
     가장 낮은 외판 아래(벌브 밑, forefoot 앞)는 그 단면의 가장 낮은 외판 점으로, 그 위의 빈 높이(벌브 위, 선수재를 지난 곳)는
     같은 높이의 선형 윤곽(선수재·벌브 앞끝) 위로 옮긴다.
     세 점이 모두 중심선인 삼각형은 빼서 중심선 위 납작한 판이 생기지 않는다. 거스·히트맵·선택은 원래 단면 그대로 쓴다.
   선수 벌브 끝: 외판이 남아 있는 마지막 단면의 고리를 벌브 타원체를 따라 줄여 가며 끝점까지 둥글게 닫는다 (bowCap).
   법선(normal, bowCap.normal)도 여기서 계산한다: 중심선 위 점은 옆 방향 성분을 빼서 좌우 메시가 이음새에서 같은 법선을 쓴다.
   ========================================================= */
import { XMIN, XMAX, XC, NX, NB, G, stX, stSec, deckZ, HB, SX, SY, SZ, BULB } from './hull.js';

export const nV=(NX+1)*G;
export const pos=new Float32Array(nV*3),girth=new Float32Array(nV);
const valid=(s,j)=>j<=NB?s.yb>0.02:s.Ys[j]>0.02;
/* the front edge of the shell at height Z, searched aft from X (the stem, bulb or forefoot profile): [X, Z] there, or null.
   Z is held at most at the deck there (the sheer drops aft), so the top points find the stem head */
const zAt=(x,Z)=>Math.min(Z,deckZ(x)-1e-3),shell=(x,Z)=>HB(x,zAt(x,Z))>0.02;
function edge(X,Z){
  let a=X,b=null;for(let d=0.1;d<=12;d+=0.1){if(shell(X-d,Z)){b=X-d;break;}a=X-d;}if(b==null)return null;
  for(let k=0;k<16;k++){const m=(a+b)/2;if(shell(m,Z))b=m;else a=m;}return [b,zAt(b,Z)];
}
/* the lowest shell height on the centreline of station X, between za (no shell) and zb (shell) */
function lowZ(X,za,zb){for(let k=0;k<16;k++){const m=(za+zb)/2;if(HB(X,m)>0.02)zb=m;else za=m;}return zb;}
const onCL=new Uint8Array(nV);   // points moved onto the centreline (no shell at that height)
let lastShell=NX;   // the last station that still has shell
for(let i=0;i<=NX;i++){const s=stSec[i],X=stX[i],ok=[];for(let j=0;j<G;j++)if(valid(s,j))ok.push(j);
  if(!ok.length){if(lastShell===NX)lastShell=i-1;}
  const zLow=ok.length&&ok[0]>0?lowZ(X,s.Zs[ok[0]-1],s.Zs[ok[0]]):0;
  for(let j=0;j<G;j++){const k=i*G+j;girth[k]=s.gs[j];
    if(!ok.length){const q=lastShell*G+j;pos[k*3]=pos[q*3];pos[k*3+1]=pos[q*3+1];pos[k*3+2]=pos[q*3+2];onCL[k]=onCL[q];continue;}   // past the tip: the last ring (zero-area), the cap closes it
    pos[k*3]=X-XC;
    if(valid(s,j)){pos[k*3+1]=s.Zs[j];pos[k*3+2]=s.Ys[j];continue;}
    // below the lowest shell (under the bulb, the forefoot): onto the centreline at that lowest point of this station, so
    // the bottom closes along its own keel line (not on the profile further aft, which would hang a sheet under the bulb)
    onCL[k]=1;pos[k*3+2]=0;
    if(j<ok[0]){pos[k*3+1]=zLow;continue;}
    // a gap higher up (between the bulb and the stem, past the stem): onto the centreline at the profile at the same height
    // (the stem, the bulb), so the shell closes on y = 0 along the stem with no slot; aft half or no profile found: the
    // nearest shell height on this station
    const e=X>XC?edge(X,s.Zs[j]):null;
    if(e){pos[k*3]=e[0]-XC;pos[k*3+1]=e[1];continue;}
    const q=ok.reduce((b,v)=>Math.abs(v-j)<Math.abs(b-j)?v:b);pos[k*3+1]=s.Zs[q];
  }}
/* the bulb on a section: its lowest run of shell points (j) */
const bulbRun=s=>{const r=[];for(let j=0;j<G;j++)if(valid(s,j)&&(!r.length||j===r[r.length-1]+1))r.push(j);return r;};
/* the last shell station (and its copies past the tip): the shell points above the bulb (the stem head) onto the centreline,
   so the stem closes on y = 0 there too — the cap only rounds off the bulb */
{const run=bulbRun(stSec[lastShell]);
  for(let i=lastShell;i<=NX;i++)for(let j=0;j<G;j++)if(!run.includes(j)){const k=i*G+j;pos[k*3+2]=0;onCL[k]=1;}}
/* triangles with all three points on the centreline are left out: they could only be a flat sheet on y = 0 (or zero area) */
export const index=[];
for(let i=0;i<NX;i++)for(let j=0;j<G-1;j++){const a=i*G+j,b=(i+1)*G+j,c=a+1,d=b+1;
  if(!(onCL[a]&&onCL[b]&&onCL[c]))index.push(a,b,c);if(!(onCL[b]&&onCL[d]&&onCL[c]))index.push(b,d,c);}
/* vertex normals (area-weighted, as three.js computes them); on the centreline the sideways part is dropped so the starboard
   mesh and its port mirror share one normal along the stem and the keel — no dark seam, no break in the highlight */
function vertexNormals(P,I){
  const N=new Float32Array(P.length);
  for(let t=0;t<I.length;t+=3){const [a,b,c]=[I[t],I[t+1],I[t+2]],V=k=>[P[k*3],P[k*3+1],P[k*3+2]];
    const pa=V(a),pb=V(b),pc=V(c),cb=[pc[0]-pb[0],pc[1]-pb[1],pc[2]-pb[2]],ab=[pa[0]-pb[0],pa[1]-pb[1],pa[2]-pb[2]];
    const n=[cb[1]*ab[2]-cb[2]*ab[1],cb[2]*ab[0]-cb[0]*ab[2],cb[0]*ab[1]-cb[1]*ab[0]];
    for(const k of [a,b,c])for(let q=0;q<3;q++)N[k*3+q]+=n[q];}
  for(let k=0;k<P.length/3;k++){if(Math.abs(P[k*3+2])<1e-6)N[k*3+2]=0;
    const l=Math.hypot(N[k*3],N[k*3+1],N[k*3+2]);if(l>1e-12)for(let q=0;q<3;q++)N[k*3+q]/=l;else N[k*3]=1;}
  return N;
}
export const normal=vertexNormals(pos,index);

/* bow cap: rings from the last shell station to the bulb tip, each the last ring scaled about the bulb axis as the ellipsoid narrows */
const CAP_RINGS=10;
export const bowCap=(()=>{
  const X0=stX[lastShell],a0=(X0-BULB.x)/BULB.len,r0=Math.sqrt(Math.max(1e-6,1-a0*a0)),p=[],idx=[];
  // the ring the cap rings shrink from: the last shell section's bulb, the other points on the centreline at the nearest
  // bulb height (not up the stem or at the stem head, which would make the cap a sheet in front of it)
  const s=stSec[lastShell],ok=bulbRun(s);
  const ring=[];for(let j=0;j<G;j++){const on=ok.includes(j),q=on?j:ok.reduce((b,v)=>Math.abs(v-j)<Math.abs(b-j)?v:b);ring.push([s.Zs[q],on?s.Ys[j]:0]);}
  for(let r=1;r<=CAP_RINGS;r++){const t=1-(1-r/CAP_RINGS)**2,X=X0+(XMAX-X0)*t,a=Math.min(1,(X-BULB.x)/BULB.len),f=Math.sqrt(Math.max(0,1-a*a))/r0;   // denser near the tip
    for(const [Z,Y] of ring)p.push(X-XC,BULB.z+(Z-BULB.z)*f,Y*f);}
  const base=Array.from(pos.subarray(lastShell*G*3,(lastShell+1)*G*3));   // the hull's last ring itself: the cap meets it with no gap
  const all=new Float32Array([...base,...p]),cl=k=>Math.abs(all[k*3+2])<1e-6;
  for(let r=0;r<CAP_RINGS;r++)for(let j=0;j<G-1;j++){const a=r*G+j,b=(r+1)*G+j,c=a+1,d=b+1;
    if(!(cl(a)&&cl(b)&&cl(c)))idx.push(a,b,c);if(!(cl(b)&&cl(d)&&cl(c)))idx.push(b,d,c);}
  // one normal on the ring the hull and the cap share (the mean of both sides'), so the light runs on across the joint
  const N=vertexNormals(all,idx);
  for(let j=0;j<G;j++){const h=(lastShell*G+j)*3,c=j*3,v=[0,1,2].map(q=>normal[h+q]+N[c+q]),l=Math.hypot(...v);
    if(l>1e-9)for(let q=0;q<3;q++)normal[h+q]=N[c+q]=v[q]/l;}
  return {pos:all,index:idx,normal:N,x0:X0};
})();

/* superstructure boxes [x0, x1, z0, z1, width, funnelBand?] (ship X, Z in m): the original design, unchanged,
   written in its own units (OD = its depth) and scaled with the hull (hull.js SX, SY, SZ) */
const OD=26.5,sx=x=>XMIN+x*SX,mast=deckZ(sx(279))/SZ;
export const SUPER_BOXES=[[40,245,OD,OD+2.4,34],[6,24,OD,OD+20,36],[18,24,OD+17.8,OD+20,46],[2,9,OD+20,OD+30,9],[2,9,OD+27.4,OD+29,9.2,true],
  [120,135,OD+2.4,OD+6.4,14],[278,279.4,mast,mast+11,1.4],...[60,100,150,200].map(x=>[x,x+9,OD+2.4,OD+4.4,6])]
  .map(([x0,x1,z0,z1,w,band])=>[sx(x0),sx(x1),z0*SZ,z1*SZ,w*SY,band]);
