/* =========================================================
   보수 구역: 서로 이웃한 측정점들을 한 구역으로 묶는다.
   1) 최우선 보수 구역 (criteria.isTop): 최우선 보수 지점끼리 판정 단계와 상관없이 이웃하면 묶는다.
      세 레이어가 같은 기준이라 묶음을 한 번만 계산해서 함께 쓴다 (zonesOf) — 어느 레이어든 최우선 보수의 개수·항목이 같다.
   2) 나머지 이상 지점: 현재 레이어에서 판정이 같은(주의끼리, 경고끼리) 점끼리 묶는다.
      경고 핵심부와 그 둘레의 주의 영역은 따로 구역이 된다 (주의 띠로 여러 경고 군집이 한 덩어리가 되지 않게).
   목록 순서 (레이어 화면): 최우선 보수 → 경고 → 주의로 묶고, 각 묶음 안에서는 현재 레이어 수치(layerValue)가 큰 순.
     구역의 대표 지점(목록 수치·선택 지점)은 판정이 가장 나쁜 점 중 그 레이어 수치가 가장 큰 지점이다. 레이어마다 1위가 다를 수 있다.
   이웃 = 외판 위 거리(x, 부호 있는 거스 u)가 ZONE_LINK.dist 이내 (측정 격자 1.1 m의 대각선까지, 킬을 건너 좌우현이 이어진다).
   보수는 외판 1장 단위: 이웃끼리 묶은 덩어리를 프레임 구간(PLATE_FRAMES개, 약 5.6 m) × 이웃한 외판열 1–2개로 나눠 1건씩 만든다.
   작은 구역 합치기 (구역 평균 약 25 m²): 측정점 ZONE_MERGE.small개 미만인 구역은 ZONE_MERGE.dist 안의 가장 가까운 구역에 넣고,
     측정점 1개짜리 구역은 거리와 상관없이 가장 가까운 구역에 넣는다 (판정이 다르면 합친 구역의 판정은 더 나쁜 쪽).
     최우선 보수 구역은 합치지 않는다.
   도막 손상 레이어: 손상은 서로 DAMAGE_LINK(3 m) 안에 있으면 1건이다 (스크래치·도막 떨어짐을 함께 묶고 판으로 나누지 않는다).
     구역의 판정은 더 나쁜 쪽 (도막 떨어짐이 있으면 도막 떨어짐). 최우선 보수 구역은 손상이 있는 것만 든다.
   복합은 구역 안에 복합 점이 하나라도 있으면 복합이다.
   layer 'all': 세 레이어를 합친 기준 (보고서 5장 보수 계획). 점의 판정 = 세 레이어 중 가장 나쁜 판정, 순서는 우선순위 점수.
   ========================================================= */
import { LETTERS, ZONES, FRMIN, recordU } from '../hull.js';
import { OK, CRIT, LAYERS, judge, isCompound, isTop, actionFor, scoreOf, dftLoss, plateLoss } from './criteria.js';
import { ACTION_ORDER } from './repairSteps.js';

export const ZONE_LINK={dist:1.6};   // m: 측정 격자 1.1 m의 대각선(1.56 m)까지 이웃
export const PLATE_FRAMES=7;         // 보수 1건의 프레임 구간 (외판 1장 길이, 약 6–8프레임)
export const ZONE_MERGE={small:10,dist:3.3};  // 측정점 10개(약 12 m²) 미만인 구역은 3.3 m(측정 격자 3칸) 안의 가장 가까운 구역에 넣는다
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

/* neighbours → clusters (union-find) on the shell surface (x, u in m). items: [{r, si, level}] · sameLevel: only link equal judgements */
function cluster(items,sameLevel,C=ZONE_LINK.dist){
  const cell=(x,u)=>Math.floor(x/C)*100000+Math.floor(u/C),grid=new Map(),pos=items.map(a=>({x:a.r.X,u:recordU(a.r)}));
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
/* small pieces → the nearest piece (smallest first): under ZONE_MERGE.small points within ZONE_MERGE.dist, one point at any distance.
   A piece of the same judgement goes first (within the distance, then for one point at any distance), so a lone 경고 point
   does not turn a 주의 zone into 경고 */
function mergeSmall(pieces){
  const pos=new Map();for(const p of pieces)for(const a of p)pos.set(a,{x:a.r.X,u:recordU(a.r)});
  const gap=(p,q)=>{let m=Infinity;for(const a of p){const s=pos.get(a);for(const b of q){const t=pos.get(b);m=Math.min(m,(s.x-t.x)**2+(s.u-t.u)**2);}}return Math.sqrt(m);};
  const lvl=p=>Math.max(...p.map(a=>a.level)),live=pieces.map(p=>[...p]),done=new Set();
  const nearest=(p,f)=>{let best=null,bd=Infinity;for(const q of live)if(q!==p&&f(q)){const d=gap(p,q);if(d<bd){bd=d;best=q;}}return best&&{q:best,d:bd};};
  for(;;){
    const p=live.filter(q=>q.length<ZONE_MERGE.small&&!done.has(q)).sort((a,b)=>a.length-b.length)[0];if(!p)break;
    const same=nearest(p,q=>lvl(q)===lvl(p)),any=nearest(p,()=>true),D=ZONE_MERGE.dist;
    const to=same&&same.d<=D?same:any&&any.d<=D?any:p.length===1?same||any:null;
    if(to){to.q.push(...p);live.splice(live.indexOf(p),1);}else done.add(p);
  }
  return live;
}

/* 목록 정렬 수치 = 목록 오른쪽에 보이는 값의 크기: 도막·강판 감소율, 손상 면적 */
export function layerValue(r,layer){return layer==='dft'?dftLoss(r):layer==='plate'?plateLoss(r):r.defectArea;}

/* the 최우선 보수 point clusters (the same for every layer), as record lists */
export function topClusters(records){
  return cluster(records.filter(r=>isTop(r)).map(r=>({r,si:strakeIdx(r.strake),level:0})),false).map(c=>c.map(a=>a.r));
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
  const others=layer==='defect'?cluster(rest,false,DAMAGE_LINK):mergeSmall(cluster(rest,true).flatMap(plates));
  // 도막 손상: only the 최우선 보수 zones with damage in them (a coating + steel one has nothing to show in this list)
  const tops=top.flatMap(c=>plates(c.map(item))).filter(items=>layer!=='defect'||items.some(a=>a.r.defect));
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
/* points of one kind (items [{r, …}], e.g. the points predicted to reach 경고 at the next docking) → repair-zone sized groups,
   by the same rules as the layer zones (neighbours, plate-sized pieces, small pieces merged): [{items, count, …extent}] */
export function pointZones(points){
  const items=points.map(a=>({...a,si:strakeIdx(a.r.strake),level:CRIT}));
  return mergeSmall(cluster(items,false).flatMap(plates)).map(z=>({items:z,count:z.length,...extent(z)}));
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
