/* =========================================================
   보수 구역: 서로 이웃한 측정점들을 한 구역으로 묶는다.
   1) 최우선 보수 구역 (criteria.isTop): 최우선 보수 지점끼리 판정 단계와 상관없이 이웃하면 묶는다.
      도막 두께·강판 두께 레이어는 같은 기준이라 묶음을 한 번만 계산해서 함께 쓴다 (zonesOf) — 두 레이어의 개수·항목이 같다.
   2) 나머지 이상 지점: 현재 레이어에서 판정이 같은(주의끼리, 경고끼리) 점끼리 묶는다.
      경고 핵심부와 그 둘레의 주의 영역은 따로 구역이 된다 (주의 띠로 여러 경고 군집이 한 덩어리가 되지 않게).
   목록 순서 (레이어 화면): 최우선 보수 → 경고 → 주의로 묶고, 각 묶음 안에서는 현재 레이어 수치(layerValue)가 큰 순.
     구역의 대표 지점(목록 수치·선택 지점)도 그 레이어 수치가 가장 큰 지점이다. 레이어마다 1위가 다를 수 있다.
   이웃 = 외판 위 거리(x, 부호 있는 거스 u)가 ZONE_LINK.dist 이내 (측정 격자 1.1 m의 대각선까지, 킬을 건너 좌우현이 이어진다).
   보수는 외판 1장 단위: 이웃끼리 묶은 덩어리를 프레임 구간(PLATE_FRAMES개, 약 5.6 m) × 이웃한 외판열 1–2개로 나눠 1건씩 만든다.
   복합은 구역 안에 복합 점이 하나라도 있으면 복합이다.
   layer 'all': 세 레이어를 합친 기준 (보고서 5장 보수 계획). 점의 판정 = 세 레이어 중 가장 나쁜 판정, 순서는 우선순위 점수.
   ========================================================= */
import { LETTERS, ZONES, FRMIN, recordU } from '../hull.js';
import { OK, CRIT, LAYERS, judge, isCompound, isTop, topGroup, actionFor, scoreOf, dftRatio, plateLoss, ACTION } from './criteria.js';

export const ZONE_LINK={dist:1.6};   // m: 측정 격자 1.1 m의 대각선(1.56 m)까지 이웃
export const PLATE_FRAMES=7;         // 보수 1건의 프레임 구간 (외판 1장 길이, 약 6–8프레임)

const strakeIdx=s=>s==='K'?-1:LETTERS.indexOf(s);
const strakeOf=i=>i<0?'K':LETTERS[i];

/* 세 레이어를 합친 판정: {level, degree, types:[이상 레이어], primary:점수가 가장 높은 레이어} */
export function judgeAll(r){
  let level=OK,degree=0,primary=null,best=-1;const types=[];
  for(const l of LAYERS){const j=judge(r,l);if(j.level===OK)continue;types.push(l);
    const sc=scoreOf(j.level,j.degree,false);if(sc>best){best=sc;primary=l;level=j.level;degree=j.degree;}}
  return {level,degree,types,primary};
}
function actionAll(r,level,top){
  if(level===OK)return null;
  if(top)return ACTION.steelRepaint;
  if(judge(r,'plate').level===CRIT)return ACTION.steel;
  if(judge(r,'dft').level===CRIT||judge(r,'defect').level===CRIT)return ACTION.repaint;
  return ACTION.local;
}

/* neighbours → clusters (union-find) on the shell surface (x, u in m). items: [{r, si, level}] · sameLevel: only link equal judgements */
function cluster(items,sameLevel){
  const C=ZONE_LINK.dist,cell=(x,u)=>Math.floor(x/C)*100000+Math.floor(u/C),grid=new Map(),pos=items.map(a=>({x:a.r.X,u:recordU(a.r)}));
  pos.forEach((p,i)=>{const k=cell(p.x,p.u);let l=grid.get(k);if(!l)grid.set(k,l=[]);l.push(i);});
  const parent=items.map((_,i)=>i),find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  pos.forEach((p,i)=>{
    const cx=Math.floor(p.x/C),cu=Math.floor(p.u/C);
    for(let dx=-1;dx<=1;dx++)for(let du=-1;du<=1;du++){const l=grid.get((cx+dx)*100000+cu+du);if(!l)continue;
      for(const j of l){if(j<=i)continue;const q=pos[j];
        if((q.x-p.x)**2+(q.u-p.u)**2<=C*C&&(!sameLevel||items[j].level===items[i].level)){const x=find(i),y=find(j);if(x!==y)parent[x]=y;}}}
  });
  const groups=new Map();
  items.forEach((a,i)=>{const g=find(i);let l=groups.get(g);if(!l)groups.set(g,l=[]);l.push(a);});
  return [...groups.values()];
}
/* a cluster → plate-sized repair zones: PLATE_FRAMES-frame bins × runs of at most 2 neighbouring strakes (girth order across K) */
function plates(items){
  const gi=a=>a.si<0?0:(a.r.side==='P'?a.si+1:-(a.si+1)),bins=new Map(),out=[];
  for(const a of items){const b=Math.floor((a.r.fr-FRMIN)/PLATE_FRAMES);let l=bins.get(b);if(!l)bins.set(b,l=[]);l.push(a);}
  for(const l of bins.values()){
    const ks=[...new Set(l.map(gi))].sort((x,y)=>x-y),chunk=new Map();let c=-1,start=0,prev=0;
    for(const k of ks){if(c<0||k!==prev+1||k-start>=2){c++;start=k;}chunk.set(k,c);prev=k;}
    const parts=new Map();for(const a of l){const id=chunk.get(gi(a));let q=parts.get(id);if(!q)parts.set(id,q=[]);q.push(a);}
    out.push(...parts.values());
  }
  return out;
}

/* 목록 정렬 수치 = 목록 오른쪽에 보이는 값의 크기: 도막 설계 대비 감소, 강판 원두께 대비 감소, 손상 면적 */
export function layerValue(r,layer){return layer==='dft'?1-dftRatio(r):layer==='plate'?plateLoss(r):r.defectArea;}

/* the 최우선 보수 point clusters for a layer's criterion, as record lists (layer-independent within a criterion group) */
export function topClusters(records,layer){
  return cluster(records.filter(r=>isTop(r,layer)).map(r=>({r,si:strakeIdx(r.strake),level:0})),false).map(c=>c.map(a=>a.r));
}

/* → [{worst, items, count, level, degree, compound, top, value, score, action, frMin, frMax, strakeMin, strakeMax, side, zone, ids, types, primary}]
   worst: 대표 지점 (레이어 화면: 레이어 수치가 가장 큰 점, 'all': 우선순위 점수가 가장 높은 점) · value: 그 점의 레이어 수치
   순서: 최우선 보수 → 경고 → 주의, 각 안에서 value 내림차순 ('all'은 우선순위 점수) — 같으면 점이 많은 구역이 위 */
export function groupZones(records,layer,top=topClusters(records,layer)){
  const all=layer==='all';
  const item=r=>{const j=all?judgeAll(r):judge(r,layer),compound=isCompound(r);
    const score=scoreOf(j.level,j.degree,compound);
    return {r,level:j.level,degree:j.degree,compound,score,value:all?score:layerValue(r,layer),si:strakeIdx(r.strake),types:all?j.types:[layer],primary:all?j.primary:layer};};
  const zone=(items,isTopZone)=>{
    items.sort((a,b)=>b.value-a.value||b.score-a.score);
    const w=items[0],compound=items.some(a=>a.compound);
    let frMin=1e9,frMax=-1e9,siMin=99,siMax=-99;const sides=new Set(),zc={},types=new Set();
    for(const a of items){frMin=Math.min(frMin,a.r.fr);frMax=Math.max(frMax,a.r.fr);siMin=Math.min(siMin,a.si);siMax=Math.max(siMax,a.si);
      sides.add(a.r.side);zc[a.r.zone]=(zc[a.r.zone]||0)+1;a.types.forEach(t=>types.add(t));}
    return {worst:w.r,items,count:items.length,level:w.level,degree:w.degree,compound,top:isTopZone,value:w.value,
      score:scoreOf(w.level,w.degree,compound),action:all?actionAll(w.r,w.level,isTopZone):actionFor(w.r,layer,w.level,isTopZone),
      frMin,frMax,strakeMin:strakeOf(siMin),strakeMax:strakeOf(siMax),side:sides.size>1?'PS':[...sides][0],
      // zone name: the one most points are in; a tie goes by the fixed ZONES order (not the layer's point order)
      zone:Object.keys(zc).sort((a,b)=>zc[b]-zc[a]||ZONES.indexOf(a)-ZONES.indexOf(b))[0],ids:new Set(items.map(a=>a.r.id)),
      types:LAYERS.filter(l=>types.has(l)),primary:w.primary};
  };
  // grade group first (최우선 보수 → 경고 → 주의), then the layer value (the priority score for 'all'), then more points
  const order=(a,b)=>(b.top-a.top)||(b.level-a.level)||(b.value-a.value)||(b.count-a.count);
  const inTop=new Set(top.flatMap(c=>c.map(r=>r.id)));
  const rest=[];for(const r of records){if(inTop.has(r.id))continue;const a=item(r);if(a.level>OK)rest.push(a);}
  return [...top.flatMap(c=>plates(c.map(item))).map(items=>zone(items,true)),
    ...cluster(rest,true).flatMap(plates).map(items=>zone(items,false))].sort(order);
}

/* the store's zones for a layer, once per data version. The 최우선 보수 clusters are cached per criterion group,
   so 도막 두께 and 강판 두께 use the very same clusters (same count, same items) */
const zoneCache=new Map(),topCache=new Map();
export function zonesOf(store,layer){
  const v=store.version,c=zoneCache.get(layer);if(c&&c.v===v)return c.zones;
  const g=topGroup(layer);let t=topCache.get(g);
  if(!t||t.v!==v)topCache.set(g,t={v,clusters:topClusters(store.records,layer)});
  const zones=groupZones(store.records,layer,t.clusters);zoneCache.set(layer,{v,zones});return zones;
}
