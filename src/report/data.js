/* =========================================================
   진단 보고서 데이터 (SPEC 6): 보고서를 만드는 순간 대시보드가 보고 있는 도킹의 측정 데이터로 계산한다.
   건수(최우선 보수 · 경고 · 주의)와 보수 우선 순서는 대시보드 KPI·보수 목록과 같은 보수 구역(zones.zonesOf)에서 센다.
   감소율은 대시보드 목록의 수치와 같은 반올림(format.refDropRate)을 쓴다.
   ========================================================= */
import { XMIN, XMAX, NX, G, stSec, ZONES } from '../hull.js';
import { LAYERS, LAYER_LABEL, OK, WARN, CRIT, TOP, CRITERIA, ACTION, ACTION_ORDER, judge, dftRatio, plateLoss, isTop, gradeOf } from '../data/criteria.js';
import { DEFECT_LABEL, recLoc, designRatio, lossRatio, area, refDropRate, pct as pctText } from '../format.js';
import { groupZones, zonesOf } from '../data/zones.js';
import { SHIP as BASE, GRID, ROBOT, LBP, DRAFT, AHR, SERVICE_SPEED, SEA_NU, STEEL_DENSITY } from '../data/baseline.js';
import { DOCKING_CYCLE_YEARS, dockOf, prevDockOf, dockLabel } from '../data/docking.js';

/* 예시 상수: 보고서 계산에만 쓰며 나중에 바꿀 수 있다 */
export const REPORT_CONST={
  cellArea:GRID*GRID,                   // 측정점 하나가 대표하는 외판 면적 (m²): 측정 격자 1.1 m × 1.1 m
  solids:0.6,                           // 도료 고형분 비율 (도료 물량 = 면적 × 설계 두께 ÷ 고형분)
  yearsSincePrev:DOCKING_CYCLE_YEARS,   // 이전 도킹 → 이 도킹 (1차 리도킹 → 2차 리도킹, 신조 인도 → 1차 리도킹)
  yearsToNext:DOCKING_CYCLE_YEARS       // 다음 도킹(2031.10)까지
};
export const SHIP={name:BASE.name,hull:BASE.hull,robot:ROBOT};   // name: 머리말·표지 · hull: 파일명
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

/* 마찰 저항 증가 (Townsin): ΔCF × 10³ = 44 [(AHR / L)^(1/3) − 10 Rn^(−1/3)] + 0.125 · CF = ITTC-1957 0.075 / (log10 Rn − 2)²
   L = 수선간장, 속도 SERVICE_SPEED (노트). AHR은 µm → m */
export const FRICTION=(()=>{
  const V=SERVICE_SPEED*1852/3600,Rn=V*LBP/SEA_NU,CF=0.075/(Math.log10(Rn)-2)**2;
  return {Rn,CF,dCF:ahr=>(44*(Math.cbrt(ahr*1e-6/LBP)-10*Math.cbrt(1/Rn))+0.125)/1000};
})();

/* grade counts of a zone list: {3: 최우선 보수, 2: 경고, 1: 주의} */
const gradeCount=zs=>{const c={[TOP]:0,[CRIT]:0,[WARN]:0};zs.forEach(z=>c[gradeOf(z.level,z.top)]++);return c;};

export function buildReportData(store,now=new Date()){
  const R=store.records,C=REPORT_CONST,plan=store.plan,ship=dockContext(store.dockKey);
  const lv=(r,l)=>judge(r,l).level;
  // the dashboard's repair zones per layer (KPI tiles, 보수 목록 order)
  const zonesBy=Object.fromEntries(LAYERS.map(l=>[l,zonesOf(store,l)]));

  /* --- layer summaries (1장 cards): the dashboard KPI counts --- */
  const layers={};
  for(const l of LAYERS)layers[l]={counts:gradeCount(zonesBy[l]),total:zonesBy[l].length};
  const byRatio=[...R].sort((a,b)=>dftRatio(a)-dftRatio(b)),byLoss=[...R].sort((a,b)=>plateLoss(b)-plateLoss(a));
  // 도막 손상 (화면 목록과 같은 기준): 최우선 보수 → 도막 떨어짐 → 스크래치, 각 안에서 면적 큰 순
  const dmgGrade=r=>isTop(r,'defect')?TOP:lv(r,'defect');
  const defects=R.filter(r=>r.defect).sort((a,b)=>dmgGrade(b)-dmgGrade(a)||b.defectArea-a.defectArea);
  if(R.length){
    layers.dft.worst={label:'최소 도막',value:designRatio(byRatio[0]),where:recLoc(byRatio[0])};
    layers.plate.worst={label:'최대 강판 감소율',value:lossRatio(byLoss[0]),where:recLoc(byLoss[0])};
  }else{layers.dft.worst={label:'최소 도막',value:'—',where:''};layers.plate.worst={label:'최대 강판 감소율',value:'—',where:''};}
  const bigDefect=[...defects].sort((a,b)=>b.defectArea-a.defectArea)[0];
  layers.defect.worst=bigDefect?{label:'최대 손상',value:area(bigDefect.defectArea),where:`${DEFECT_LABEL[bigDefect.defect]}·${recLoc(bigDefect)}`}:{label:'최대 손상',value:'없음',where:''};

  /* --- repair zones (all layers) and quantities --- */
  const zonesAll=groupZones(R,'all');
  const repaintPts=R.filter(r=>lv(r,'dft')===CRIT||lv(r,'defect')===CRIT);
  const repaintArea=sumArea(repaintPts);
  const paintL=repaintPts.reduce((s,r)=>s+areaOf(r)*r.dftDesign*1e-6*1000/C.solids,0);
  // steel work: plain steel replacement and the compound zones (steel first, then repaint)
  const steelZones=zonesAll.filter(z=>z.action===ACTION.steel||z.action===ACTION.steelRepaint),topZones=zonesAll.filter(z=>z.top);
  // 강판 교체 중량 (t): the points of those zones, area × original thickness (mm → m) × steel density
  const steelPts=steelZones.flatMap(z=>z.items.map(i=>i.r));
  const steelT=steelPts.reduce((s,r)=>s+areaOf(r)*r.plateOrig/1000*STEEL_DENSITY,0);
  const headline={top:topZones.length,steel:steelZones.length,repaint:Math.round(repaintArea)};
  /* 5장 구역별 보수 물량: the combined repair zones counted by action (ACTION_ORDER) — a place that needs repair in several layers
     counts once, as its heaviest action (zones.actionAll) — split by area (a zone goes to the area most of its points are in) */
  const byZone=ZONES.map(zone=>{const zs=zonesAll.filter(z=>z.zone===zone);return {zone,n:ACTION_ORDER.map(a=>zs.filter(z=>z.action===a).length)};});

  /* --- 2·3장: 구역별 (fixed rows = ZONES) — 감소율 over the points of the area, counts = the dashboard's repair zones named after it --- */
  const lossOf=(r,l)=>l==='plate'?plateLoss(r):1-dftRatio(r);
  const areaRows=l=>ZONES.map(name=>{const rs=R.filter(r=>r.zone===name),c=gradeCount(zonesBy[l].filter(z=>z.zone===name));
    return {zone:name,n:rs.length,avg:rs.length?rs.reduce((a,r)=>a+lossOf(r,l),0)/rs.length*100:null,
      max:rs.length?Math.max(...rs.map(r=>refDropRate(r,l))):null,top:c[TOP],crit:c[CRIT],warn:c[WARN]};});
  // repair zones by the reduction of their worst point (설계 / 원두께 대비 감소율), largest first — one place per zone, not neighbouring points
  const byDrop=l=>[...zonesBy[l]].sort((a,b)=>b.value-a.value||b.count-a.count);
  // 감소율 상위 3곳 (단면 비교)
  const top3=l=>byDrop(l).slice(0,3).map(z=>z.worst);
  // 감소율 상위 5곳 (표): with the change since the docking before ÷ the years between
  const top5=l=>byDrop(l).slice(0,5).map(z=>{const r=z.worst,prev=prevOf(r,l),cur=thickOf(r,l);
    return {z,r,prev,cur,rate:(prev-cur)/C.yearsSincePrev};});
  // 4장 구역별: repair zones (최우선 보수 → 도막 떨어짐 → 스크래치, as the dashboard counts them) with their damage area
  const dmgArea=zs=>zs.reduce((a,z)=>a+z.items.reduce((s,i)=>s+i.r.defectArea,0),0);
  const defectZones=ZONES.map(name=>{const zs=zonesBy.defect.filter(z=>z.zone===name),g=k=>zs.filter(z=>gradeOf(z.level,z.top)===k);
    const t=g(TOP),f=g(CRIT),s=g(WARN);
    return {zone:name,tN:t.length,tA:dmgArea(t),fN:f.length,fA:dmgArea(f),sN:s.length,sA:dmgArea(s)};}).filter(row=>row.tN+row.fN+row.sN>0);

  /* --- plate loss rate and next-docking prediction (5장 다음 도킹 관찰 권고) --- */
  const rate=r=>(prevPlate(r)-r.plate)/C.yearsSincePrev;
  const predLoss=r=>(r.plateOrig-(r.plate-rate(r)*C.yearsToNext))/r.plateOrig;
  const predicted=R.filter(r=>lv(r,'plate')<CRIT&&predLoss(r)>=CRITERIA.plate.crit).sort((a,b)=>predLoss(b)-predLoss(a))
    .map(r=>({r,rate:rate(r),loss:plateLoss(r),pred:predLoss(r)}));

  /* --- key findings (generated from the data; 건 = the dashboard's repair zones), one form for all three lines:
     "선저에 강판 감소 집중 (강판 두께 보수 98건 중 67.3%)" — the area with the most zones (areas tied at the top are named
     together, with their combined share) --- */
  const findings=[];
  [['dft','도막 두께 이상'],['plate','강판 감소'],['defect','도막 손상']].forEach(([l,what])=>{const zs=zonesBy[l];if(!zs.length)return;
    const c={};zs.forEach(z=>c[z.zone]=(c[z.zone]||0)+1);
    const max=Math.max(...Object.values(c)),top=ZONES.filter(name=>c[name]===max);
    findings.push(`${top.join('·')}에 ${what} 집중 (${LAYER_LABEL[l]} 보수 ${zs.length}건 중 ${pctText(pct(max*top.length,zs.length))})`);});
  if(topZones.length&&findings.length<3)findings.push(`최우선 보수 ${topZones.length}건 — 도막 이상(두께 또는 손상)과 강판 이상이 같은 곳에 함께 있음`);

  /* --- 5장 보수 효과 (estimates): current → after the planned repairs --- */
  const steelIds=new Set(steelPts.map(r=>r.id)),repaintIds=new Set(repaintPts.map(r=>r.id));
  // 외판 두께 잔존율: area-weighted mean of plate / original; replaced plates go back to the original thickness
  const remain=f=>R.length?R.reduce((s,r)=>s+areaOf(r)*f(r)/r.plateOrig,0)/sumArea(R)*100:0;
  // 허용 마모 초과 면적: plate loss at or over the 경고 limit (20% of the original)
  const worn=keep=>sumArea(R.filter(r=>lv(r,'plate')===CRIT&&keep(r)));
  // 마찰 저항 (새 선체 대비 증가분, %): ΔCF ÷ CF × 100 (area-weighted ΔCF over the measured shell)
  //  · 보수 후 = 전체 방오 재도장: the whole shell below the design draft and the recommended repaint get a new coat
  const ahrOf=r=>r.defect==='flaking'?AHR.flaking:lv(r,'dft')>OK||r.defect==='scratch'?AHR.coatAbnormal:AHR.normal;
  const friction=f=>R.length?R.reduce((s,r)=>s+areaOf(r)*FRICTION.dCF(f(r)),0)/sumArea(R)/FRICTION.CF*100:0;
  const fullIds=new Set(R.filter(r=>repaintIds.has(r.id)||r.Z<=DRAFT).map(r=>r.id));
  const effect={
    remain:{now:remain(r=>r.plate),after:remain(r=>steelIds.has(r.id)?r.plateOrig:r.plate)},
    worn:{now:worn(()=>true),after:worn(r=>!steelIds.has(r.id))},
    friction:{now:friction(ahrOf),after:friction(r=>fullIds.has(r.id)?AHR.newCoat:ahrOf(r))}
  };

  /* --- coverage --- */
  const blockedS=plan.samples.filter(s=>s.blocked),total=shellArea(),measured=sumArea(R);
  const coverage={points:R.length,planned:plan.samples.length,blocked:blockedS.length,measuredArea:measured,blockedArea:sumArea(blockedS),shellArea:total,ratio:pct(measured,total)};

  return {now,ship,records:R,layers,headline,findings:findings.slice(0,3),coverage,effect,
    dft:{zones:areaRows('dft'),top3:top3('dft'),top5:top5('dft')},
    plate:{zones:areaRows('plate'),top3:top3('plate'),top5:top5('plate'),predicted},
    defect:{zones:defectZones,photos:defects.slice(0,6)},
    repair:{byZone,repaintArea,paintL,steelT}};
}
