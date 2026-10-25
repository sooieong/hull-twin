/* =========================================================
   히트맵 (SPEC 4.4): 이상 구역만 칠한다. 주의(주황) → 심각(진한 빨강) 연속 그라데이션.
   측정점 사이는 곡면 거리 기준 IDW로 보간한다. 곡면 거리는 (X, 부호 있는 거스 u) 평면 거리로 근사한다.
   ========================================================= */
import { judge, OK } from './data/criteria.js';

export const HEAT={
  radius:4.5,       // 보간에 쓰는 측정점 반경 (m)
  soft:3.0,         // 거리 가중치 완화 (m²): 측정점마다 뾰족하게 튀지 않고 부드럽게 번지도록
  background:0.012, // 측정점이 멀수록 기본색으로 돌아가게 하는 가중치
  alphaFrom:0.04,   // 이 값부터 칠하기 시작해서
  alphaTo:0.2,      // 이 값에서 완전히 칠한다
  alphaMax:0.94
};
/* 히트 값 h: 정상 0, 주의 0.2–0.6, 심각 0.6–1 (판정 경계가 정확히 0.6) */
export const HEAT_STOPS=[[0.2,[255,178,36]],[0.6,[232,54,28]],[1.0,[138,11,18]]];   // #FFB224 → #E8361C → #8A0B12

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
/* 측정 범위: 가중치 합 0.03 이하는 미측정, 0.15 이상은 측정 완료 */
export function coverage(w){const t=Math.min(1,Math.max(0,(w-0.03)/0.12));return t*t*(3-2*t);}
export function nearest(ix,X,u,maxD){
  let best=null,bd=maxD*maxD;
  forNear(ix,X,u,it=>{const d2=(it.X-X)**2+(it.u-u)**2;if(d2<bd){bd=d2;best=it;}});
  return best;
}
