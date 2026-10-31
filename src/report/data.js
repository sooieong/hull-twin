/* =========================================================
   진단 보고서 데이터 (SPEC 6): 보고서를 만드는 순간 대시보드가 보고 있는 도킹의 측정 데이터로 계산한다.
   건수(최우선 보수 · 경고 · 주의)와 보수 우선 순서는 대시보드 KPI·보수 목록과 같은 보수 구역(zones.zonesOf)에서 센다.
   감소율(강판·도막 모두 기준 두께 대비)은 대시보드 목록의 수치와 같은 반올림(format.lossRate)을 쓴다.
   보수 계획 (5장, 1장 종합 판정의 강판·재도장): 보수 계획 화면과 연동하지 않고 권장 보수 = 보수 범위 3단계로 고정한다 (SPEC 12.8, 13.7).
     재도장 면적·도료량·강판 교체 중량·판 수·마찰 저항(보수 후)은 plan/scenario.js를 3단계로 부른 값 그대로 —
     보수 계획 화면 3단계(스위치 꺼짐, 직접 바꾼 판 없음)의 보수 효과·자재 목록과 같은 숫자다. 현재 값(마찰 저항)은 같은 계산의 보수 없음.
   ========================================================= */
import { XMIN, XMAX, NX, G, stSec, ZONES } from '../hull.js';
import { LAYERS, LAYER_LABEL, WARN, CRIT, TOP, CRITERIA, judge, reaches, dftLoss, plateLoss, isTop, gradeOf } from '../data/criteria.js';
import { ACTION_ORDER } from '../data/repairSteps.js';
import { DEFECT_LABEL, recLoc, lossPct, area, lossRate, pct as pctText } from '../format.js';
import { groupZones, zonesOf, topCount } from '../data/zones.js';
import { SHIP as BASE, FLEET_DETAIL } from '../data/baseline.js';
import { FRICTION, CELL_AREA, DEFAULT_LEVEL, rangeResult, noRepair } from '../plan/scenario.js';
import { platesOf } from '../data/plates.js';
import { DOCKING_CYCLE_YEARS, dockOf, prevDockOf, dockLabel } from '../data/docking.js';

/* 예시 상수: 보고서 계산에만 쓰며 나중에 바꿀 수 있다 */
export const REPORT_CONST={
  cellArea:CELL_AREA,                   // 측정점 하나가 대표하는 외판 면적 (m²): 측정 격자 1.1 m × 1.1 m
  plan:DEFAULT_LEVEL,                   // 5장 보수 계획의 범위: 권장 보수 = 보수 범위 3단계 (plan/scenario.js)
  yearsSincePrev:DOCKING_CYCLE_YEARS,   // 이전 도킹 → 이 도킹 (1차 리도킹 → 2차 리도킹, 신조 인도 → 1차 리도킹)
  yearsToNext:DOCKING_CYCLE_YEARS       // 다음 도킹(2031.10)까지
};
export const SHIP={name:BASE.name,hull:BASE.hull,robot:FLEET_DETAIL};   // name: 머리말·표지 · hull: 파일명 · robot: 1장 측정 로봇 (6대)
/* the docking the report is about = the one picked in the header (store.dockKey): 현재(2차 리도킹) or the 1차 리도킹 record.
   prev = the docking before it — loss rates run from its value (a record without …Prev: 신조 인도 = the original thickness) */
export function dockContext(key){
  const dock=dockOf(key),prev=prevDockOf(dock);
  return {...SHIP,dockInfo:dock,docking:`${dock.date} ${dock.name}`,dock:dock.dock||'',prevDock:prev,since:dockLabel(prev),prevShort:prev.short,next:dock.next};
}
export const prevPlate=r=>r.platePrev??r.plateOrig;
export const prevDft=r=>r.dftPrev??r.dftDesign;
/* thickness now and at the docking before (plate mm, coating µm) */
export const thickOf=(r,layer)=>layer==='plate'?r.plate:r.dft;
export const prevOf=(r,layer)=>layer==='plate'?prevPlate(r):prevDft(r);

const pct=(n,d)=>d?n/d*100:0;

/* 측정점 하나가 대표하는 외판 면적 (m²): 측정 격자 한 칸 (측정점은 1.1 m 간격 격자) */
export function areaOf(){return REPORT_CONST.cellArea;}
const sumArea=rs=>rs.reduce((a,r)=>a+areaOf(r),0);

/* 전체 외판 면적 (양현): 단면 둘레 × 길이 */
function shellArea(){let a=0;const dx=(XMAX-XMIN)/NX;for(let i=0;i<NX;i++)a+=(stSec[i].gs[G-1]+stSec[i+1].gs[G-1])/2*dx;return a*2;}

/* 마찰 저항 증가 (Townsin): 보수 계획 화면과 같은 식 (plan/scenario.js) */
export { FRICTION };

/* grade counts of a zone list: {3: 최우선 보수, 2: 경고, 1: 주의} */
const gradeCount=zs=>{const c={[TOP]:0,[CRIT]:0,[WARN]:0};zs.forEach(z=>c[gradeOf(z.level,z.top)]++);return c;};

export function buildReportData(store,now=new Date()){
  const R=store.records,C=REPORT_CONST,plan=store.plan,ship=dockContext(store.dockKey);
  const lv=(r,l)=>judge(r,l).level;
  // the dashboard's repair zones per layer (KPI tiles, 보수 목록 order)
  const zonesBy=Object.fromEntries(LAYERS.map(l=>[l,zonesOf(store,l)]));

  /* --- layer summaries (1장 cards): the dashboard KPI counts --- */
  const layers={};
  for(const l of LAYERS){const counts=gradeCount(zonesBy[l]);counts[TOP]=topCount(store);   // 최우선 보수: 종합 건수 (KPI와 같다)
    layers[l]={counts,total:zonesBy[l].length};}
  // 강판·도막 카드: the largest 감소율 of the layer, the same label
  const lossOf=(r,l)=>l==='plate'?plateLoss(r):dftLoss(r),most=l=>R.reduce((a,r)=>!a||lossOf(r,l)>lossOf(a,l)?r:a,null);
  // 도막 손상 (화면 목록과 같은 기준): 최우선 보수 → 도막 떨어짐 → 스크래치, 각 안에서 면적 큰 순
  const dmgGrade=r=>isTop(r,'defect')?TOP:lv(r,'defect');
  const defects=R.filter(r=>r.defect).sort((a,b)=>dmgGrade(b)-dmgGrade(a)||b.defectArea-a.defectArea);
  for(const l of ['plate','dft']){const r=most(l);layers[l].worst=r?{label:'최대 감소율',value:lossPct(r,l),where:recLoc(r)}:{label:'최대 감소율',value:'—',where:''};}
  const bigDefect=[...defects].sort((a,b)=>b.defectArea-a.defectArea)[0];
  layers.defect.worst=bigDefect?{label:'최대 손상',value:area(bigDefect.defectArea),where:`${DEFECT_LABEL[bigDefect.defect]}·${recLoc(bigDefect)}`}:{label:'최대 손상',value:'없음',where:''};

  /* --- repair zones (all layers) and the planned quantities: 권장 보수 = range level 3 (plan/scenario.js, plate by plate) --- */
  const zonesAll=groupZones(R,'all'),topZones=zonesAll.filter(z=>z.top);
  const rec=rangeResult(store,C.plan),none=noRepair(store);
  const headline={top:topZones.length,steel:rec.steelN,repaint:rec.repaint};   // 강판 교체·보강 = plates (판)
  /* 5장 구역별 보수 물량: the combined repair zones counted by action (ACTION_ORDER) — a place that needs repair in several layers
     counts once, as its heaviest action (zones.actionAll) — split by area (a zone goes to the area most of its points are in) */
  const byZone=ZONES.map(zone=>{const zs=zonesAll.filter(z=>z.zone===zone);return {zone,n:ACTION_ORDER.map(a=>zs.filter(z=>z.action===a).length)};});

  /* --- 2·3장: 구역별 (fixed rows = ZONES) — 감소율 over the points of the area, counts = the dashboard's repair zones named after it --- */
  const areaRows=l=>ZONES.map(name=>{const rs=R.filter(r=>r.zone===name),c=gradeCount(zonesBy[l].filter(z=>z.zone===name));
    return {zone:name,n:rs.length,avg:rs.length?rs.reduce((a,r)=>a+lossOf(r,l),0)/rs.length*100:null,
      max:rs.length?Math.max(...rs.map(r=>lossRate(r,l))):null,top:c[TOP],crit:c[CRIT],warn:c[WARN]};});
  // repair zones by the reduction of their worst point (설계 / 원두께 대비 감소율), largest first — one place per zone, not neighbouring points
  const byDrop=l=>[...zonesBy[l]].sort((a,b)=>b.value-a.value||b.count-a.count);
  // 감소율 상위 3건 (단면 비교)
  const top3=l=>byDrop(l).slice(0,3).map(z=>z.worst);
  // 감소율 상위 5건 (표): with the change since the docking before ÷ the years between
  const top5=l=>byDrop(l).slice(0,5).map(z=>{const r=z.worst,prev=prevOf(r,l),cur=thickOf(r,l);
    return {z,r,prev,cur,rate:(prev-cur)/C.yearsSincePrev};});
  // 4장 구역별: repair zones (최우선 보수 → 도막 떨어짐 → 스크래치, as the dashboard counts them) with their damage area
  const dmgArea=zs=>zs.reduce((a,z)=>a+z.items.reduce((s,i)=>s+i.r.defectArea,0),0);
  const defectZones=ZONES.map(name=>{const zs=zonesBy.defect.filter(z=>z.zone===name),g=k=>zs.filter(z=>gradeOf(z.level,z.top)===k);
    const t=g(TOP),f=g(CRIT),s=g(WARN);
    return {zone:name,tN:t.length,tA:dmgArea(t),fN:f.length,fA:dmgArea(f),sN:s.length,sA:dmgArea(s)};}).filter(row=>row.tN+row.fN+row.sN>0);

  /* --- 5장 다음 도킹 관찰 권고: places that still reach 경고 at the next docking after the 권장 보수 — the very zones of the
     보수 계획 screen's "다음 도킹 경고 예상" at level 3 (scenario.evaluate nextZones, same count). Per zone: the point furthest
     past its limit, the layer that brings it there (강판 · 도막, or a 도막 떨어짐 left), its 감소율 now and predicted,
     and the zone's judgement now in that layer; largest first --- */
  const over=x=>Math.max(x.plate/CRITERIA.plate.crit,x.dft/CRITERIA.dft.crit);
  const predicted=rec.nextZones.map(z=>{
    const a=z.items.reduce((m,b)=>over(b.next)>over(m.next)?b:m),x=a.next;
    const layer=reaches(x.plate,CRITERIA.plate.crit)||reaches(x.dft,CRITERIA.dft.crit)?(x.plate/CRITERIA.plate.crit>=x.dft/CRITERIA.dft.crit?'plate':'dft'):'defect';
    const grade=Math.max(...z.items.map(b=>gradeOf(judge(b.r,layer).level,isTop(b.r,layer))));
    return {z,r:a.r,layer,grade,pred:layer==='defect'?null:x[layer],over:over(x)};
  }).sort((a,b)=>b.over-a.over);

  /* --- key findings (generated from the data; 건 = the dashboard's repair zones), one form for all three lines:
     "선저에 강판 감소 집중 (강판 두께 보수 98건 중 67.3%)" — the area with the most zones (areas tied at the top are named
     together, with their combined share) --- */
  const findings=[];
  [['plate','강판 감소'],['dft','도막 두께 이상'],['defect','도막 손상']].forEach(([l,what])=>{const zs=zonesBy[l];if(!zs.length)return;
    const c={};zs.forEach(z=>c[z.zone]=(c[z.zone]||0)+1);
    const max=Math.max(...Object.values(c)),top=ZONES.filter(name=>c[name]===max);
    findings.push(`${top.join('·')}에 ${what} 집중 (${LAYER_LABEL[l]} 보수 ${zs.length}건 중 ${pctText(pct(max*top.length,zs.length))})`);});
  if(topZones.length&&findings.length<3)findings.push(`최우선 보수 ${topZones.length}건 — 도막 이상(두께 또는 손상)과 강판 이상이 같은 곳에 함께 있음`);

  /* --- 5장 보수 효과 (estimates): current → after 권장 보수 (range level 3) --- */
  // the points on the plates B replaces (강판 교체·보강): back to the original thickness
  const {ofRecord}=platesOf(store),replaced=r=>{const p=ofRecord.get(r.id),w=p&&rec.plan.get(p.id);return !!w&&w.steel;};
  // 외판 두께 잔존율: area-weighted mean of plate / original
  const remain=f=>R.length?R.reduce((s,r)=>s+areaOf(r)*f(r)/r.plateOrig,0)/sumArea(R)*100:0;
  // 허용 마모 초과 면적: plate loss at or over the 경고 limit (20% of the original)
  const worn=keep=>sumArea(R.filter(r=>lv(r,'plate')===CRIT&&keep(r)));
  // 마찰 저항 (새 선체 대비 증가분, %): scenario.evaluate — no repair → level 3 (the 보수 계획 screen's value at level 3)
  const effect={
    remain:{now:remain(r=>r.plate),after:remain(r=>replaced(r)?r.plateOrig:r.plate)},
    worn:{now:worn(()=>true),after:worn(r=>!replaced(r))},
    friction:{now:none.friction,after:rec.friction}
  };

  /* --- coverage --- */
  const blockedS=plan.samples.filter(s=>s.blocked),total=shellArea(),measured=sumArea(R);
  const coverage={points:R.length,planned:plan.samples.length,blocked:blockedS.length,measuredArea:measured,blockedArea:sumArea(blockedS),shellArea:total,ratio:pct(measured,total)};

  return {now,ship,records:R,layers,headline,findings:findings.slice(0,3),coverage,effect,
    plate:{zones:areaRows('plate'),top3:top3('plate'),top5:top5('plate'),predicted},
    dft:{zones:areaRows('dft'),top3:top3('dft'),top5:top5('dft')},
    defect:{zones:defectZones,photos:defects.slice(0,6)},
    repair:{byZone,repaintArea:rec.repaint,paintL:rec.paint,steelT:rec.steel,steelN:rec.steelN}};
}
