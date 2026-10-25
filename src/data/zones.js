/* =========================================================
   보수 구역: 현재 레이어에서 판정이 같은(주의끼리, 심각끼리) 측정점 중 서로 이웃한 점들을 한 구역으로 묶는다.
   심각 핵심부와 그 둘레의 주의 영역은 따로 구역이 된다 (주의 띠로 여러 심각 군집이 한 덩어리가 되지 않게).
   이웃 = 같은 현에서 FR 차이 ZONE_LINK.dfr 이내이고 외판열 차이 ZONE_LINK.dstrake 이내 (K 외판열은 좌우현이 이어진다).
   구역의 판정·복합·점수는 구역 안에서 가장 나쁜 점 기준이며, 복합은 구역 안에 복합 점이 하나라도 있으면 복합이다.
   ========================================================= */
import { LETTERS } from '../hull.js';
import { OK, judge, isCompound, actionFor, scoreOf } from './criteria.js';

export const ZONE_LINK={dfr:3,dstrake:1};   // 측정 간격(3 프레임)과 이웃 외판열

const strakeIdx=s=>s==='K'?-1:LETTERS.indexOf(s);
const strakeOf=i=>i<0?'K':LETTERS[i];

/* → [{worst, items, count, level, degree, compound, score, action, frMin, frMax, strakeMin, strakeMax, side, zone, ids}]
   우선순위 내림차순 (같은 점수면 점이 많은 구역이 위) */
export function groupZones(records,layer){
  const ab=[];
  for(const r of records){const j=judge(r,layer);if(j.level===OK)continue;
    const compound=isCompound(r);ab.push({r,level:j.level,degree:j.degree,compound,score:scoreOf(j.level,j.degree,compound),si:strakeIdx(r.strake)});}

  const key=(side,si,fr)=>(si+2)*100000+fr*10+side,at=new Map();
  ab.forEach((a,i)=>at.set(key(a.r.side==='P'?1:0,a.si,a.r.fr),i));
  const parent=ab.map((_,i)=>i),find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  ab.forEach((a,i)=>{
    const sd=a.r.side==='P'?1:0,sides=a.si<0?[0,1]:[sd];
    for(const s of sides)for(let ds=-ZONE_LINK.dstrake;ds<=ZONE_LINK.dstrake;ds++)for(let df=-ZONE_LINK.dfr;df<=ZONE_LINK.dfr;df++){
      const si=a.si+ds;if(s!==sd&&si>=0)continue;   // crossing sides only along K
      const j=at.get(key(s,si,a.r.fr+df));if(j!==undefined&&ab[j].level===a.level){const x=find(i),y=find(j);if(x!==y)parent[x]=y;}
    }
  });

  const groups=new Map();
  ab.forEach((a,i)=>{const g=find(i);let l=groups.get(g);if(!l)groups.set(g,l=[]);l.push(a);});
  const zones=[];
  for(const items of groups.values()){
    items.sort((a,b)=>b.score-a.score);
    const w=items[0],compound=items.some(a=>a.compound);
    let frMin=1e9,frMax=-1e9,siMin=99,siMax=-99;const sides=new Set(),zc={};
    for(const a of items){frMin=Math.min(frMin,a.r.fr);frMax=Math.max(frMax,a.r.fr);siMin=Math.min(siMin,a.si);siMax=Math.max(siMax,a.si);
      sides.add(a.r.side);zc[a.r.zone]=(zc[a.r.zone]||0)+1;}
    zones.push({worst:w.r,items,count:items.length,level:w.level,degree:w.degree,compound,
      score:scoreOf(w.level,w.degree,compound),action:actionFor(w.r,layer,w.level,compound),
      frMin,frMax,strakeMin:strakeOf(siMin),strakeMax:strakeOf(siMax),side:sides.size>1?'PS':[...sides][0],
      zone:Object.keys(zc).sort((a,b)=>zc[b]-zc[a])[0],ids:new Set(items.map(a=>a.r.id))});
  }
  return zones.sort((a,b)=>b.score-a.score||b.count-a.count);
}
