/* =========================================================
   진단 보고서 데이터 (SPEC 6): 화면에서 고른 레이어와 상관없이 전체 측정 데이터로 계산한다.
   ========================================================= */
import { FS, STRAKE_W, KEEL_HALF, LETTERS, XMAX, NX, G, stSec, section, strakeLower, ZONES } from '../hull.js';
import { LAYERS, OK, WARN, CRIT, CRITERIA, ACTION, judge, dftRatio, plateLoss, isCompound, isTop, scoreOf } from '../data/criteria.js';
import { DEFECT_LABEL, recLoc, designRatio, lossRatio, area, pct as pctText } from '../format.js';
import { groupZones } from '../data/zones.js';
import { SAMPLE_EVERY } from '../data/scanPath.js';
import { DOCKING_CYCLE_YEARS, CURRENT_DOCK, PREV_DOCK } from '../data/docking.js';

/* 예시 상수: 보고서 계산에만 쓰며 나중에 바꿀 수 있다 */
export const REPORT_CONST={
  pointLen:SAMPLE_EVERY*FS,             // 측정점 하나가 대표하는 길이 (m): 측정 간격
  solids:0.6,                           // 도료 고형분 비율 (도료 물량 = 면적 × 설계 두께 ÷ 고형분)
  yearsSincePrev:DOCKING_CYCLE_YEARS,   // 1차 리도킹(2021.10) → 2차 리도킹(2026.10)
  yearsToNext:DOCKING_CYCLE_YEARS       // 다음 도킹(2031.10)까지
};
export const SHIP={name:'174K LNG Carrier',hull:'H-2491',docking:`${CURRENT_DOCK.date} ${CURRENT_DOCK.name}`,dock:CURRENT_DOCK.dock,robot:'RBT-01',prevDock:PREV_DOCK};

const pct=(n,d)=>d?n/d*100:0;

/* 측정점 하나가 대표하는 외판 면적 (m²) = 측정 간격 × 그 자리 외판열 폭 (K는 반폭, 맨 위 외판열은 갑판까지만) */
const girthCache=new Map();
const girthAt=fr=>{let g=girthCache.get(fr);if(g===undefined){g=section(fr*FS).gs[G-1];girthCache.set(fr,g);}return g;};
export function areaOf(p){
  if(p.strake==='K')return REPORT_CONST.pointLen*KEEL_HALF;
  const lower=strakeLower(LETTERS.indexOf(p.strake));
  return REPORT_CONST.pointLen*Math.max(0,Math.min(STRAKE_W,girthAt(p.fr)-lower));
}
const sumArea=rs=>rs.reduce((a,r)=>a+areaOf(r),0);

/* 전체 외판 면적 (양현): 단면 둘레 × 길이 */
function shellArea(){let a=0;const dx=XMAX/NX;for(let i=0;i<NX;i++)a+=(stSec[i].gs[G-1]+stSec[i+1].gs[G-1])/2*dx;return a*2;}

export function buildReportData(store,now=new Date()){
  const R=store.records,C=REPORT_CONST,plan=store.plan;
  const lv=(r,l)=>judge(r,l).level;

  /* --- layer summaries --- */
  const layers={};
  for(const l of LAYERS){const c=[0,0,0];R.forEach(r=>c[lv(r,l)]++);layers[l]={counts:c,total:R.length};}
  const byRatio=[...R].sort((a,b)=>dftRatio(a)-dftRatio(b)),byLoss=[...R].sort((a,b)=>plateLoss(b)-plateLoss(a));
  // 도막 손상 (화면 목록과 같은 기준): 최우선 보수 → 도막 떨어짐 → 스크래치, 각 안에서 면적 큰 순
  const dmgGrade=r=>isTop(r,'defect')?3:judge(r,'defect').level;
  const defects=R.filter(r=>r.defect).sort((a,b)=>dmgGrade(b)-dmgGrade(a)||b.defectArea-a.defectArea);
  layers.dft.worst={label:'최소 도막',value:designRatio(byRatio[0]),where:recLoc(byRatio[0])};
  layers.plate.worst={label:'최대 강판 감소율',value:lossRatio(byLoss[0]),where:recLoc(byLoss[0])};
  const bigDefect=[...defects].sort((a,b)=>b.defectArea-a.defectArea)[0];
  layers.defect.worst=bigDefect?{label:'최대 손상',value:area(bigDefect.defectArea),where:`${DEFECT_LABEL[bigDefect.defect]}·${recLoc(bigDefect)}`}:{label:'최대 손상',value:'없음',where:''};

  /* --- repair zones (all layers) and quantities --- */
  const zonesAll=groupZones(R,'all');
  const repaintPts=R.filter(r=>lv(r,'dft')===CRIT||lv(r,'defect')===CRIT);
  const repaintArea=sumArea(repaintPts);
  const paintL=repaintPts.reduce((s,r)=>s+areaOf(r)*r.dftDesign*1e-6*1000/C.solids,0);
  // steel work: plain steel replacement and the compound zones (steel first, then repaint)
  const steelZones=zonesAll.filter(z=>z.action===ACTION.steel||z.action===ACTION.steelRepaint),localZones=zonesAll.filter(z=>z.action===ACTION.local);
  const compoundZones=zonesAll.filter(z=>z.compound),topZones=zonesAll.filter(z=>z.top);
  const headline={top:topZones.length,steel:steelZones.length,repaint:Math.round(repaintArea)};

  /* --- per-zone tables --- */
  const zoneRows=f=>ZONES.map(z=>{const rs=R.filter(r=>r.zone===z);return {zone:z,n:rs.length,...f(rs)};}).filter(row=>row.n>0);
  const dftZones=zoneRows(rs=>{const v=rs.map(dftRatio);const w=rs.filter(r=>lv(r,'dft')===WARN).length,c=rs.filter(r=>lv(r,'dft')===CRIT).length;
    return {avg:v.reduce((a,b)=>a+b,0)/v.length*100,min:Math.min(...v)*100,warn:w,crit:c,area:sumArea(rs.filter(r=>lv(r,'dft')===CRIT))};});
  const plateZones=zoneRows(rs=>{const v=rs.map(plateLoss);return {avg:v.reduce((a,b)=>a+b,0)/v.length*100,max:Math.max(...v)*100,
    warn:rs.filter(r=>lv(r,'plate')===WARN).length,crit:rs.filter(r=>lv(r,'plate')===CRIT).length};});
  // 최우선 보수에 든 손상은 도막 떨어짐·스크래치에서 뺀다
  const defectZones=zoneRows(rs=>{const d=rs.filter(r=>r.defect),t=d.filter(r=>isTop(r,'defect')),rest=d.filter(r=>!isTop(r,'defect'));
    const f=rest.filter(r=>r.defect==='flaking'),s=rest.filter(r=>r.defect==='scratch'),A=xs=>xs.reduce((a,r)=>a+r.defectArea,0);
    return {tN:t.length,tA:A(t),fN:f.length,fA:A(f),sN:s.length,sA:A(s)};}).filter(row=>row.tN+row.fN+row.sN>0);

  /* --- plate loss rate and next-docking prediction --- */
  const rate=r=>(r.platePrev-r.plate)/C.yearsSincePrev;
  const predLoss=r=>(r.plateOrig-(r.plate-rate(r)*C.yearsToNext))/r.plateOrig;
  const fastest=[...R].sort((a,b)=>rate(b)-rate(a)).slice(0,5).map(r=>({r,rate:rate(r),loss:plateLoss(r)}));
  const predicted=R.filter(r=>lv(r,'plate')<CRIT&&predLoss(r)>=CRITERIA.plate.crit).sort((a,b)=>predLoss(b)-predLoss(a))
    .map(r=>({r,rate:rate(r),loss:plateLoss(r),pred:predLoss(r)}));

  /* --- key findings (generated from the data) --- */
  const share=(rs)=>{const c={};rs.forEach(r=>c[r.zone]=(c[r.zone]||0)+1);return Object.entries(c).sort((a,b)=>b[1]-a[1]);};
  const findings=[];
  const dAb=R.filter(r=>lv(r,'dft')>OK),pAb=R.filter(r=>lv(r,'plate')>OK);
  if(dAb.length){const [z,n]=share(dAb)[0];findings.push(`${z}에 도막 두께 이상 집중 (전체 도막 이상의 ${pctText(pct(n,dAb.length))})·최소 ${layers.dft.worst.value}`);}
  if(pAb.length){const [z,n]=share(pAb)[0];findings.push(`${z}에 강판 감소 집중 (전체 강판 이상의 ${pctText(pct(n,pAb.length))})·최대 ${layers.plate.worst.value}, ${byLoss[0]?recLoc(byLoss[0]):''}`);}
  if(defects.length){const sh=share(defects),top2=sh.slice(0,2),n2=top2.reduce((a,[,n])=>a+n,0);
    findings.push(`도막 손상 ${defects.length}건 중 ${pctText(pct(n2,defects.length))}가 ${top2.map(([z])=>z).join('·')}에 분포·${DEFECT_LABEL.flaking} ${defects.filter(r=>r.defect==='flaking').length}건`);}
  if(topZones.length&&findings.length<3)findings.push(`최우선 보수 ${topZones.length}구역 — 도막 이상(두께 또는 손상)과 강판 이상이 같은 곳에 함께 있음`);

  /* --- coverage --- */
  const blockedS=plan.samples.filter(s=>s.blocked),total=shellArea(),measured=sumArea(R);
  const coverage={points:R.length,planned:plan.samples.length,blocked:blockedS.length,measuredArea:measured,blockedArea:sumArea(blockedS),shellArea:total,ratio:pct(measured,total)};

  return {now,records:R,layers,headline,findings:findings.slice(0,3),coverage,
    dft:{zones:dftZones,thinnest:byRatio.slice(0,5),values:R.map(r=>dftRatio(r)*100)},
    plate:{zones:plateZones,top3:byLoss.slice(0,3),fastest,predicted},
    defect:{zones:defectZones,photos:defects.slice(0,6),count:defects.length},
    repair:{zones:zonesAll.slice(0,15).map(z=>({...z,area:sumArea(z.items.map(a=>a.r))})),all:zonesAll,repaintArea,paintL,
      steel:{count:steelZones.length,area:steelZones.reduce((a,z)=>a+sumArea(z.items.map(i=>i.r)),0)},
      local:localZones.length,compound:compoundZones.length}};
}
