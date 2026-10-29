/* =========================================================
   히트맵 (SPEC 4.4): 이상 구역만 칠한다. 곡면 거리는 (X, 부호 있는 거스 u) 평면 거리로 근사한다.
   - 도막 두께 · 강판 두께: 측정점 사이를 IDW로 보간한다. 주의(앰버) → 경고(레드) 연속 그라데이션 (gradeUi.js와 같은 색 체계).
   - 도막 손상: 값을 섞지 않는다 (damageAt). 손상 측정점마다 색은 판정으로 고정하고 진하기만 중심에서 멀어질수록 줄인다.
   화면·보고서는 모두 createPaint(layer)로 칠한다: 대시보드 3D·S.SHELL 전개도, 보고서 전개도·3D 그림.
   ========================================================= */
import { judge, isTop, OK, TOP } from './data/criteria.js';
import { COLOR, rgbOf } from './styles/tokens.js';
import { recordU } from './hull.js';

export const HEAT={
  radius:4.5,       // 보간에 쓰는 측정점 반경 (m)
  soft:3.0,         // 거리 가중치 완화 (m²): 측정점마다 뾰족하게 튀지 않고 부드럽게 번지도록
  background:0.012, // 측정점이 멀수록 기본색으로 돌아가게 하는 가중치
  alphaFrom:0.04,   // 이 값부터 칠하기 시작해서
  alphaTo:0.2,      // 이 값에서 완전히 칠한다
  alphaMax:0.94
};
/* 히트 값 h: 정상 0, 주의 0.2–0.6, 경고 0.6–1 (판정 경계가 정확히 0.6) */
export const HEAT_STOPS=[[0.2,rgbOf(COLOR.lv[1])],[0.6,rgbOf(COLOR.lv[2])],[1.0,rgbOf(COLOR.lv[3])]];   // 주의 → 경고 → 최우선 보수 (styles/tokens.js)

export function heatOf(r,layer){const j=judge(r,layer);return j.level===OK?0:0.2+0.8*j.degree;}

export function heatRGB(h){
  const S=HEAT_STOPS;if(h<=S[0][0])return S[0][1];
  for(let i=1;i<S.length;i++){if(h<=S[i][0]){const [h0,c0]=S[i-1],[h1,c1]=S[i],t=(h-h0)/(h1-h0);return c0.map((v,k)=>v+(c1[k]-v)*t);}}
  return S[S.length-1][1];
}
export function heatAlpha(h){
  if(h<=HEAT.alphaFrom)return 0;
  const t=Math.min(1,(h-HEAT.alphaFrom)/(HEAT.alphaTo-HEAT.alphaFrom));return t*t*(3-2*t)*HEAT.alphaMax;
}
export function heatCss(){return HEAT_STOPS.map(([h,c])=>`rgb(${c.join(',')}) ${((h-0.2)/0.8*100).toFixed(0)}%`).join(',');}

const cellKey=(cx,cu)=>(cx+1000)*10000+(cu+5000);
/* 측정점 격자 색인: items = [{X, u, h, r}] */
export function buildIndex(items){
  const cell=HEAT.radius,map=new Map();
  const ix={cell,map};for(const it of items)addToIndex(ix,it);
  return ix;
}
export function addToIndex(ix,it){const key=cellKey(Math.floor(it.X/ix.cell),Math.floor(it.u/ix.cell));let a=ix.map.get(key);if(!a)ix.map.set(key,a=[]);a.push(it);}
function forNear(ix,X,u,fn){
  const cx=Math.floor(X/ix.cell),cu=Math.floor(u/ix.cell);
  for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const l=ix.map.get(cellKey(cx+a,cu+b));if(l)for(const it of l)fn(it);}
}
/* res가 있으면 res.w에 주변 측정점 가중치 합을 넣는다 (측정된 영역인지 판단용) */
export function idw(ix,X,u,res){
  const R2=HEAT.radius*HEAT.radius;let sw=HEAT.background,sh=0;
  forNear(ix,X,u,it=>{const d2=(it.X-X)**2+(it.u-u)**2;if(d2>=R2)return;const f=1-d2/R2,w=f*f/(d2+HEAT.soft);sw+=w;sh+=w*it.h;});
  if(res)res.w=sw-HEAT.background;
  return sh/sw;
}
/* ---------- 도막 손상 ----------
   색 = 판정 (최우선 보수 lv[3] · 도막 떨어짐 lv[2] · 스크래치 lv[1]), 섞지 않는다.
   반경 = 손상 면적 × DAMAGE.k (m), DAMAGE.rMin 이상 — 가장 작은 손상도 측정 격자(1.1 m)와 3D 메시 꼭짓점 간격보다 넓게 칠해져
   따로 떨어진 스크래치도 보인다 (측정점에서 가장 가까운 메시 꼭짓점이 최대 약 2.1 m — 선미 빌지; 1.7 m 떨어진 꼭짓점도
   진하기 0.8 이상). rMax 이하 (색인 칸 HEAT.radius 안에서 찾을 수 있게).
   진하기: 중심부(반경 × core)는 alphaMax, 거기서 반경까지 부드럽게 0으로.
   겹치는 곳: 그 자리에서 가장 진한 손상의 절반 이상으로 칠하는 손상들 가운데 가장 나쁜 판정의 색, 진하기는 가장 진한 값
   (옅은 가장자리가 다른 손상의 중심 색을 바꾸지 않게) */
export const DAMAGE={k:3,rMin:2,rMax:HEAT.radius,core:0.6,overlap:0.5};
export const DAMAGE_RGB=[null,rgbOf(COLOR.lv[1]),rgbOf(COLOR.lv[2]),rgbOf(COLOR.lv[3])];   // 스크래치 · 도막 떨어짐 · 최우선 보수
/* a record's damage grade: 0 none · 1 스크래치 · 2 도막 떨어짐 · 3 최우선 보수 */
export const damageGrade=r=>!r.defect?OK:isTop(r,'defect')?TOP:judge(r,'defect').level;
export const damageRadius=area=>Math.min(DAMAGE.rMax,Math.max(DAMAGE.rMin,DAMAGE.k*area));
const smoothstep=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
/* ix: damaged points [{X, u, g, rad}] → out.a (0 … alphaMax), out.g (grade), out.rgb (null where nothing is painted) */
export function damageAt(ix,X,u,out){
  let amax=0,n=0;const hits=out._hits||(out._hits=[]);
  forNear(ix,X,u,it=>{const d2=(it.X-X)**2+(it.u-u)**2;if(d2>=it.rad*it.rad)return;
    const a=HEAT.alphaMax*(1-smoothstep(it.rad*DAMAGE.core,it.rad,Math.sqrt(d2)));if(a<=0)return;
    hits[n++]={a,g:it.g};if(a>amax)amax=a;});
  let g=0;for(let i=0;i<n;i++)if(hits[i].a>=amax*DAMAGE.overlap&&hits[i].g>g)g=hits[i].g;
  out.a=amax;out.g=g;out.rgb=g?DAMAGE_RGB[g]:null;return out;
}

/* ---------- one painter for every view ----------
   createPaint(layer, records) → {ix, add(r), at(X, u, out)}
   at → out.a (진하기 0 … alphaMax), out.rgb (0–255, null where nothing is painted), out.w (측정 가중치, coverage용)
   ix: every point {X, u, h, r} (hover lookup, the measured-area weight; h = the layer's heat for the IDW layers) */
export function createPaint(layer,records=[]){
  const dmg=layer==='defect',ix=buildIndex([]),dix=buildIndex([]);
  const p={ix,
    add(r){const u=recordU(r);addToIndex(ix,{X:r.X,u,h:dmg?0:heatOf(r,layer),r});
      if(dmg&&r.defect)addToIndex(dix,{X:r.X,u,g:damageGrade(r),rad:damageRadius(r.defectArea)});},
    at(X,u,out){const v=idw(ix,X,u,out);
      if(dmg)return damageAt(dix,X,u,out);
      out.a=heatAlpha(v);out.rgb=out.a>0?heatRGB(v):null;return out;}};
  records.forEach(p.add);
  return p;
}

/* 측정 범위: 가중치 합 0.03 이하는 미측정, 0.15 이상은 측정 완료 */
export function coverage(w){const t=Math.min(1,Math.max(0,(w-0.03)/0.12));return t*t*(3-2*t);}
export function nearest(ix,X,u,maxD){
  let best=null,bd=maxD*maxD;
  forNear(ix,X,u,it=>{const d2=(it.X-X)**2+(it.u-u)**2;if(d2<bd){bd=d2;best=it;}});
  return best;
}
