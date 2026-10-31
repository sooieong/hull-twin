/* =========================================================
   보수 구역 (SPEC v6 14.0): 보수 구역 1건 = 판 1장 (프레임 구간 PLATE_FRAMES개, 약 5.6 m × 외판열 1개, 약 25 m² —
   plates.js의 판과 같은 구간. K는 좌우현에 걸친 한 판).
   1) 최우선 보수 구역 (criteria.isTop): 최우선 보수 지점이 있는 판마다 1건.
      세 레이어가 같은 기준이라 묶음을 한 번만 계산해서 함께 쓴다 (zonesOf) — 어느 레이어든 최우선 보수의 개수·항목이 같다.
   2) 강판 두께 · 도막 두께 (와 'all'): 판 1장 = 그 판에서 가장 나쁜 판정 1건. 한 판 안의 이상 지점은 판정이 달라도 한 구역이고
      (경고와 주의를 따로 세지 않는다), 최우선 보수 판의 나머지 이상 지점은 그 최우선 보수 구역에 든다. 옆 판과는 합치지 않는다.
   목록 순서 (레이어 화면): 최우선 보수 → 경고 → 주의로 묶고, 각 묶음 안에서는 현재 레이어 수치(layerValue)가 큰 순.
     구역의 대표 지점(목록 수치·선택 지점)은 판정이 가장 나쁜 점 중 그 레이어 수치가 가장 큰 지점이다. 레이어마다 1위가 다를 수 있다.
   도막 손상 레이어 (v3 11.6): 손상은 서로 DAMAGE_LINK(3 m) 안에 있으면 1건이다 (외판 위 거리 x, 부호 있는 거스 u —
     스크래치·도막 떨어짐을 함께 묶고 판으로 나누지 않는다).
     구역의 판정은 더 나쁜 쪽 (도막 떨어짐이 있으면 도막 떨어짐). 최우선 보수 구역은 손상이 있는 것만 든다.
   복합은 구역 안에 복합 점이 하나라도 있으면 복합이다.
   layer 'all': 세 레이어를 합친 기준 (보고서 5장 보수 계획). 점의 판정 = 세 레이어 중 가장 나쁜 판정, 순서는 우선순위 점수.
   ========================================================= */
import { LETTERS, ZONES, FRMIN, recordU } from '../hull.js';
import { OK, CRIT, LAYERS, judge, isCompound, isTop, actionFor, scoreOf, dftLoss, plateLoss } from './criteria.js';
import { ACTION_ORDER } from './repairSteps.js';

export const PLATE_FRAMES=7;         // 보수 1건의 프레임 구간 (외판 1장 길이, 약 6–8프레임)
export const DAMAGE_LINK=3;          // m: 이 거리 안의 손상은 1건

const strakeIdx=s=>s==='K'?-1:LETTERS.indexOf(s);
const strakeOf=i=>i<0?'K':LETTERS[i];

/* 세 레이어를 합친 판정: {level, degree, types:[이상 레이어], primary:점수가 가장 높은 레이어} */
export function judgeAll(r){
  let level=OK,degree=0,primary=null,best=-1;const types=[];
  for(const l of LAYERS){const j=judge(r,l);if(j.level===OK)continue;types.push(l);
    const sc=scoreOf(j.level,j.degree,false);if(sc>best){best=sc;primary=l;level=j.level;degree=j.degree;}}
  return {level,degree,types,primary};
}
/* 'all' zone action: the heaviest of every point's per-layer action (ACTION_ORDER), so a place that needs repair in several
   layers counts once, as its heaviest repair */
function actionAll(items){
  let best=ACTION_ORDER.length;
  for(const {r} of items)for(const l of LAYERS){const lv=judge(r,l).level;if(lv===OK)continue;
    best=Math.min(best,ACTION_ORDER.indexOf(actionFor(r,l,lv,isTop(r,l))));}
  return ACTION_ORDER[best]??null;
}

/* neighbours within C m → clusters (union-find) on the shell surface (x, u in m). items: [{r, …}] — the 도막 손상 layer */
function cluster(items,C){
  const cell=(x,u)=>Math.floor(x/C)*100000+Math.floor(u/C),grid=new Map(),pos=items.map(a=>({x:a.r.X,u:recordU(a.r)}));
  pos.forEach((p,i)=>{const k=cell(p.x,p.u);let l=grid.get(k);if(!l)grid.set(k,l=[]);l.push(i);});
  const parent=items.map((_,i)=>i),find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  pos.forEach((p,i)=>{
    const cx=Math.floor(p.x/C),cu=Math.floor(p.u/C);
    for(let dx=-1;dx<=1;dx++)for(let du=-1;du<=1;du++){const l=grid.get((cx+dx)*100000+cu+du);if(!l)continue;
      for(const j of l){if(j<=i)continue;const q=pos[j];
        if((q.x-p.x)**2+(q.u-p.u)**2<=C*C){const x=find(i),y=find(j);if(x!==y)parent[x]=y;}}}
  });
  const groups=new Map();
  items.forEach((a,i)=>{const g=find(i);let l=groups.get(g);if(!l)groups.set(g,l=[]);l.push(a);});
  return [...groups.values()];
}
/* the plate an item lies on (plates.js: PLATE_FRAMES-frame bin × strake, K one plate across the centreline) */
const plateKey=a=>Math.floor((a.r.fr-FRMIN)/PLATE_FRAMES)*1000+(a.si<0?0:a.r.side==='P'?a.si+1:-(a.si+1));
/* items [{r, si, …}] → Map plate key → items on it (one repair zone per plate) */
function byPlate(items){
  const m=new Map();
  for(const a of items){const k=plateKey(a);let l=m.get(k);if(!l)m.set(k,l=[]);l.push(a);}
  return m;
}

/* 목록 정렬 수치 = 목록 오른쪽에 보이는 값의 크기: 도막·강판 감소율, 손상 면적 */
export function layerValue(r,layer){return layer==='dft'?dftLoss(r):layer==='plate'?plateLoss(r):r.defectArea;}

/* the 최우선 보수 points per plate (the same for every layer), as record lists */
export function topClusters(records){
  return [...byPlate(records.filter(r=>isTop(r)).map(r=>({r,si:strakeIdx(r.strake)}))).values()].map(c=>c.map(a=>a.r));
}

/* → [{worst, items, count, level, degree, compound, top, value, score, action, frMin, frMax, strakeMin, strakeMax, side, zone, ids, types, primary}]
   worst: 대표 지점 (레이어 화면: 레이어 수치가 가장 큰 점, 'all': 우선순위 점수가 가장 높은 점) · value: 그 점의 레이어 수치
   순서: 최우선 보수 → 경고 → 주의, 각 안에서 value 내림차순 ('all'은 우선순위 점수) — 같으면 점이 많은 구역이 위 */
export function groupZones(records,layer,top=topClusters(records)){
  const all=layer==='all';
  const item=r=>{const j=all?judgeAll(r):judge(r,layer),compound=isCompound(r);
    const score=scoreOf(j.level,j.degree,compound);
    return {r,level:j.level,degree:j.degree,compound,score,value:all?score:layerValue(r,layer),si:strakeIdx(r.strake),types:all?j.types:[layer],primary:all?j.primary:layer};};
  const zone=(items,isTopZone)=>{
    items.sort((a,b)=>b.level-a.level||b.value-a.value||b.score-a.score);   // the worst judgement first (merged or damage zones mix them)
    const w=items[0],compound=items.some(a=>a.compound),types=new Set();
    for(const a of items)a.types.forEach(t=>types.add(t));
    return {worst:w.r,items,count:items.length,level:w.level,degree:w.degree,compound,top:isTopZone,value:w.value,
      score:scoreOf(w.level,w.degree,compound),action:all?actionAll(items):actionFor(w.r,layer,w.level,isTopZone),
      ...extent(items),types:LAYERS.filter(l=>types.has(l)),primary:w.primary};
  };
  // grade group first (최우선 보수 → 경고 → 주의), then the layer value (the priority score for 'all'), then more points
  const order=(a,b)=>(b.top-a.top)||(b.level-a.level)||(b.value-a.value)||(b.count-a.count);
  const inTop=new Set(top.flatMap(c=>c.map(r=>r.id)));
  const rest=[];for(const r of records){if(inTop.has(r.id))continue;const a=item(r);if(a.level>OK)rest.push(a);}
  let tops=top.map(c=>c.map(item)),others;
  if(layer==='defect'){
    others=cluster(rest,DAMAGE_LINK);
    tops=tops.filter(items=>items.some(a=>a.r.defect));   // only the 최우선 보수 zones with damage in them (a coating + steel one has nothing to show here)
  }else{
    // one zone per plate: the other abnormal points of a 최우선 보수 plate go into its zone
    const P=byPlate(rest);
    for(const items of tops){const k=plateKey(items[0]),more=P.get(k);if(more){items.push(...more);P.delete(k);}}
    others=[...P.values()];
  }
  return [...tops.map(items=>zone(items,true)),...others.map(items=>zone(items,false))].sort(order);
}
/* where a zone is: frame and strake span, side, the zone name most of its points are in (a tie goes by the fixed ZONES order) */
function extent(items){
  let frMin=1e9,frMax=-1e9,siMin=99,siMax=-99;const sides=new Set(),zc={};
  for(const a of items){frMin=Math.min(frMin,a.r.fr);frMax=Math.max(frMax,a.r.fr);siMin=Math.min(siMin,a.si);siMax=Math.max(siMax,a.si);
    sides.add(a.r.side);zc[a.r.zone]=(zc[a.r.zone]||0)+1;}
  return {frMin,frMax,strakeMin:strakeOf(siMin),strakeMax:strakeOf(siMax),side:sides.size>1?'PS':[...sides][0],
    zone:Object.keys(zc).sort((a,b)=>zc[b]-zc[a]||ZONES.indexOf(a)-ZONES.indexOf(b))[0],ids:new Set(items.map(a=>a.r.id))};
}
/* points of one kind (items [{r, …}], e.g. the points predicted to reach 경고 at the next docking) → repair zones,
   one per plate as the layer zones: [{items, count, …extent}] */
export function pointZones(points){
  const items=points.map(a=>({...a,si:strakeIdx(a.r.strake),level:CRIT}));
  return [...byPlate(items).values()].map(z=>({items:z,count:z.length,...extent(z)}));
}

/* a judgement group's action = the one most of its zones have (ties: the first zone's) — the 보수 목록 group title
   (dashboard) and the report tables' group rows */
export function groupAction(zones){
  const n=new Map();zones.forEach(z=>n.set(z.action,(n.get(z.action)||0)+1));
  return [...n.entries()].sort((a,b)=>b[1]-a[1])[0][0];
}

/* the store's zones for a layer, once per data version. The 최우선 보수 clusters (one criterion for every layer) are cached
   once, so every layer uses the very same clusters (same count, same items) */
const zoneCache=new Map();let topCache=null;
export function zonesOf(store,layer){
  const v=store.version,c=zoneCache.get(layer);if(c&&c.v===v)return c.zones;
  if(!topCache||topCache.v!==v)topCache={v,clusters:topClusters(store.records)};
  const zones=groupZones(store.records,layer,topCache.clusters);zoneCache.set(layer,{v,zones});return zones;
}
