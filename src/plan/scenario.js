/* =========================================================
   보수 범위 (SPEC 13.3): 5단 슬라이더의 포함 범위와 계산. 단계 번호는 data/repairSteps.js.
   1 최우선 보수 · 2 + 강판 두께 경고 · 3 + 도막 두께 경고·손상 (권장, 기본값 — 보고서 5장 권장 보수와 같은 범위)
   · 4 + 다음 도킹 경고 예상 · 5 + 남은 주의 전체
   스위치 "수면 아래 전체 재도장" (fullBelow)은 어느 단과도 조합된다. 범위의 판은 고정이고, 범위 밖 판을 직접 더하는 것은 plan/view.js.

   계획 = 판 번호 → 작업 {steel, paint, spot}  (planOf)
     steel: 강판 교체·보강 (판 전체 — 중량 = 판 중량) · paint: 'full' 판 전체 재도장 · 'local' 국부 보수·터치업 (판의 이상 지점만)
     spot: 판의 이상 지점 국부 보수 (강판·도막)
     단계 1·2 → steel + full (새 판은 판 전체를 칠한다 — 교체한 면적만큼 재도장·도료에 든다) · 3·4 → full
     · 5·6·7 → local + spot (repairSteps 조치) · 단계 없는(정상) 판을 넣으면 full
     fullBelow는 설계 흘수선 아래로 걸치는 판(zLo < DRAFT)을 모두 full로 더한다 (강판 작업·국부 보수는 그대로)
   evaluate(store, plan) → 보수 효과 값과 자재 목록 (자재 목록 합계 = 보수 효과 값, 같은 합을 쓴다):
     - 재도장 면적 (m²) = full 판 면적 + local 판의 이상 지점 면적 (측정점 1개 = 측정 격자 한 칸, 판 면적 이하).
       국부 보수·터치업도 칠하는 면적이므로 재도장 면적에 넣는다 — 보수 효과와 도료 목록 합계가 같은 규칙이다.
     - 강판 교체 중량 (t) = steel 판 중량 합 (plates.js: 면적 × 원두께 × 강재 밀도)
     - 도료량 (L) = 도장 구역별 면적 × 설계 두께 ÷ 고형분 비율 × (1 + 손실률) (baseline.PAINT_SPEC, PAINT_LOSS)
     - 마찰 저항 (새 선체 대비 증가분, %) = Townsin 식 (FRICTION, 보고서 5장과 같은 식), 측정점마다 거칠기 AHR:
         지금 도막 상태 (ahrOf) → 다시 칠한 곳 (full 판 전체, local 판의 이상 지점)은 새 도막
     - 다음 도킹 경고 (건) = 다음 도킹(5년 뒤)에 경고 이상이 될 곳을 보수 구역 단위로 센 수 (zones.pointZones: 이웃한 점을
         판 크기로 나누고 작은 묶음을 합친다, 구역 평균 약 25 m²). 측정점마다 5년 뒤를 예측한다 (predictNext):
         강판·도막 감소율 ≥ 경고 기준 (criteria.reaches, 판정과 같은 비교) · 고치지 않은 도막 떨어짐.
         감소 속도 = 직전 리도킹 정비 후(1차 afterRepair = 레코드의 …Prev) 대비 지금까지 줄어든 양 ÷ 5년.
         보수하지 않은 판은 그 점의 감소 속도 그대로. 보수한 판은 판의 모든 점을 다시 계산한다 (SPEC 13 #16):
         강판 교체·보강 판 → 강판이 원두께에서, 재도장 판 → 도막이 설계 두께에서 다시 시작
         · 국부 보수·터치업 판 → 강판은 지금 두께 그대로, 도막은 설계 두께에서 다시 시작
         감소 속도는 보수한 쪽(강판·도막) 모두 같은 구역(선저·빌지 …) 측정점들의 평균 (zoneRates).
     - 4단계가 넣는 판 (단계 5·6 중 다음 도킹 경고 예상 판): LEVEL4 — years년 뒤 경고가 예상되는 점이 판 측정점의 share 이상
   진단 보고서 5장(종합 판정·보수 효과·다음 도킹 관찰 권고)과 보수 계획 화면이 이 계산을 같이 쓴다.
   ========================================================= */
import { OK, WARN, CRIT, TOP, CRITERIA, LAYERS, judge, reaches } from '../data/criteria.js';
import { GRID, DRAFT, DRAFT_LIGHT, WL_TOP, AHR, LBP, SERVICE_SPEED, SEA_NU, PAINT_SPEC, PAINT_LOSS } from '../data/baseline.js';
import { DOCKING_CYCLE_YEARS } from '../data/docking.js';
import { platesOf } from '../data/plates.js';
import { pointZones } from '../data/zones.js';

/* the five levels of the slider: name (권장 → " (권장)"), the lines under it, the steps it takes in,
   group: the name of its group in 최종 보수 목록 (the plates this level adds) · grade: that group's judgement icon (gradeUi) */
export const LEVELS=[
  {level:1,name:'최우선 보수',sub:['강판·도막 모두 이상'],steps:[1],group:'최우선 보수',grade:TOP},
  {level:2,name:'+ 강판 두께 경고',sub:[`원두께 대비 ${Math.round(CRITERIA.plate.crit*100)}% 이상 감소`],steps:[1,2],group:'강판 두께 경고',grade:CRIT},
  {level:3,name:'+ 도막 두께 경고·손상',sub:[`설계 대비 ${Math.round(CRITERIA.dft.crit*100)}% 이상 감소 및`,'도막 떨어짐, 스크래치'],steps:[1,2,3,4,7],rec:true,group:'도막 두께 경고·손상',grade:CRIT},
  {level:4,name:'+ 다음 도킹 경고 예상',sub:[`${DOCKING_CYCLE_YEARS}년 안에 경고가 예상됨`],steps:[1,2,3,4,7],nextDock:true,group:'다음 도킹 경고 예상',grade:WARN},   // + 단계 5·6 중 다음 도킹에 경고가 예상되는 판
  {level:5,name:'+ 남은 주의 전체',sub:['모든 주의 포함'],steps:[1,2,3,4,5,6,7],group:'주의',grade:WARN}
];
export const levelName=lv=>`${lv.name}${lv.rec?' (권장)':''}`;
export const DEFAULT_LEVEL=3;   // 권장 (보고서 5장)
export const levelOf=n=>LEVELS[n-1];

export const CELL_AREA=GRID*GRID;                       // 측정점 하나가 대표하는 외판 면적 (m²)
export const YEARS_SINCE=DOCKING_CYCLE_YEARS,YEARS_TO_NEXT=DOCKING_CYCLE_YEARS;

/* 마찰 저항 증가 (Townsin): ΔCF × 10³ = 44 [(AHR / L)^(1/3) − 10 Rn^(−1/3)] + 0.125 · CF = ITTC-1957 0.075 / (log10 Rn − 2)²
   L = 수선간장, 속도 SERVICE_SPEED (노트). AHR은 µm → m */
export const FRICTION=(()=>{
  const V=SERVICE_SPEED*1852/3600,Rn=V*LBP/SEA_NU,CF=0.075/(Math.log10(Rn)-2)**2;
  return {Rn,CF,dCF:ahr=>(44*(Math.cbrt(ahr*1e-6/LBP)-10*Math.cbrt(1/Rn))+0.125)/1000};
})();
/* a point's hull roughness now: 도막 떨어짐 · 도막 이상 (도막 두께 주의 이상, 스크래치) · 정상 */
export const ahrOf=r=>r.defect==='flaking'?AHR.flaking:judge(r,'dft').level>OK||r.defect==='scratch'?AHR.coatAbnormal:AHR.normal;
/* friction increase (%) over points, roughness f(r) each (every point stands for the same area) */
export const frictionOf=(R,f)=>R.length?R.reduce((s,r)=>s+FRICTION.dCF(f(r)),0)/R.length/FRICTION.CF*100:0;

/* 도장 구역 (자재 목록 도료 탭): the plate's middle height */
export function paintZoneOf(p){const z=(p.zLo+p.zHi)/2;return z<DRAFT_LIGHT?'bottom':z<WL_TOP?'boot':'top';}
export const belowDwl=p=>p.zLo<DRAFT;
/* L of paint for an area (m²) of a paint zone: area × dft (µm → m) × 1000 L/m³ ÷ solids × (1 + loss) */
export const litresOf=(area,zone)=>{const s=PAINT_SPEC[zone];return area*s.dft*1e-3/s.solids*(1+PAINT_LOSS);};

/* a point that needs repair in any layer (local repair fixes these on its plate) */
const abnormal=r=>LAYERS.some(l=>judge(r,l).level>OK);
/* 국부 보수·터치업 area of a plate (m²): its abnormal points, at most the plate */
const localArea=p=>Math.min(p.area,p.records.filter(abnormal).length*CELL_AREA);

/* the work a plate gets by its step (null = 정상: put in by hand → repaint). spot: 국부 보수 of the plate's abnormal points
   (steel and coating) — kept when D repaints the whole plate */
export function workOf(step){
  if(step===1||step===2)return {steel:true,paint:'full',spot:false};   // a replaced plate is painted whole
  if(step===3||step===4||step==null)return {steel:false,paint:'full',spot:false};
  return {steel:false,paint:'local',spot:true};
}
/* the drawing's category of a work: 강판 교체·보강 · 재도장 · 국부 보수·터치업 */
export const kindOf=w=>w.steel?'steel':w.paint==='full'?'paint':'local';

/* next docking per point: rates since the docking before (≥ 0), then `years` more (YEARS_TO_NEXT).
   fix: {plate, coat} — what the plate's repair did to this point:
     plate 'new' = 강판 교체·보강 (from the original thickness) · 'zone' = 국부 보수 (from the thickness now) · null = not repaired
     coat true = 다시 칠함 (from the design thickness; no 도막 떨어짐 left)
   a repaired side wears at the average rate of its zone (zoneRates), a side not repaired keeps the point's own rate
   → {plate, dft: predicted 감소율 (0–1), flaking: a 도막 떨어짐 left as it is} */
const prevPlate=r=>r.platePrev??r.plateOrig,prevDft=r=>r.dftPrev??r.dftDesign;
const plateRate=r=>Math.max(0,(prevPlate(r)-r.plate)/YEARS_SINCE),dftRate=r=>Math.max(0,(prevDft(r)-r.dft)/YEARS_SINCE);
export function predictNext(r,fix,rates,years=YEARS_TO_NEXT){
  const z=rates[r.zone],pr=fix.plate?z.plate:plateRate(r),dr=fix.coat?z.dft:dftRate(r);
  const plate=(fix.plate==='new'?r.plateOrig:r.plate)-pr*years,dft=(fix.coat?r.dftDesign:r.dft)-dr*years;
  return {plate:(r.plateOrig-plate)/r.plateOrig,dft:(r.dftDesign-dft)/r.dftDesign,flaking:!fix.coat&&r.defect==='flaking'};
}
export const warnsOf=x=>reaches(x.plate,CRITERIA.plate.crit)||reaches(x.dft,CRITERIA.dft.crit)||x.flaking;
/* average wear per zone (선저, 빌지 …) over the docking's points: {plate mm/년, dft µm/년} — the rate of a repaired point.
   Once per data version */
let rateCache=null;
export function zoneRates(store){
  if(rateCache&&rateCache.v===store.version&&rateCache.plan===store.plan)return rateCache.out;
  const acc={};
  for(const r of store.records){const a=acc[r.zone]??={n:0,plate:0,dft:0};a.n++;a.plate+=plateRate(r);a.dft+=dftRate(r);}
  const out=Object.fromEntries(Object.entries(acc).map(([z,a])=>[z,{plate:a.plate/a.n,dft:a.dft/a.n}]));
  rateCache={v:store.version,plan:store.plan,out};return out;
}
const NO_FIX={plate:null,coat:false};
/* the fix of a plate's work (null = not in the plan): the whole plate counts as repaired — 국부 보수·터치업 too */
const fixOf=w=>w?{plate:w.steel?'new':w.spot?'zone':null,coat:w.paint==='full'||w.paint==='local'}:NO_FIX;
/* 4단계가 넣는 판: 고치지 않으면 years년 뒤 경고가 예상되는 점이 판 측정점의 share 이상 (share 0 = 한 점이라도) */
export const LEVEL4={years:YEARS_TO_NEXT,share:0};
/* does a plate left as it is reach 경고 within LEVEL4.years (LEVEL4.share of its points) — the plates level 4 takes in */
export function plateWarnsNext(p,rates,rule=LEVEL4){
  const n=p.records.filter(r=>warnsOf(predictNext(r,NO_FIX,rates,rule.years))).length;
  return n>0&&n>=rule.share*p.records.length;
}
/* the first level that takes a plate in (보수 계획 최종 보수 목록 groups), null = 정상 · 측정 불가 */
export function entryLevel(store,p){
  if(!p.measurable||p.step==null)return null;
  const lv=LEVELS.find(l=>l.steps.includes(p.step)||l.nextDock&&(p.step===5||p.step===6)&&plateWarnsNext(p,zoneRates(store)));
  return lv?lv.level:null;
}

/* the plan of a range (level 1–5, + 전체 방오 재도장): Map plate id → work */
export function planOf(store,level,fullBelow=false){
  const lv=levelOf(level),P=platesOf(store).plates.filter(p=>p.measurable),plan=new Map(),rates=zoneRates(store);
  for(const p of P){
    if(p.step!=null&&lv.steps.includes(p.step))plan.set(p.id,workOf(p.step));
    else if(lv.nextDock&&(p.step===5||p.step===6)&&plateWarnsNext(p,rates))plan.set(p.id,workOf(p.step));
  }
  if(fullBelow)for(const p of P)if(belowDwl(p)){const w=plan.get(p.id);plan.set(p.id,{steel:!!w&&w.steel,paint:'full',spot:!!w&&w.spot});}
  return plan;
}

/* → {repaint m², steel t, paint L, friction %, nextWarn 건, nextZones, steelRows, paintRows, steelN}
   nextZones: the places predicted to reach 경고 at the next docking, as repair zones (zones.pointZones) — items [{r, next}]
     (next = predictNext); nextWarn = their number
   steelRows: [{p, w}] (단계 → 판 번호 순) · paintRows: [{key, zone, work, area, paint, litres}] (선저·선측 · 흘수선 · 건현 · 국부) */
export function evaluate(store,plan){
  const {plates}=platesOf(store),P=plates.filter(p=>p.measurable);
  const rates=zoneRates(store),steelRows=[],full={bottom:0,boot:0,top:0},warns=[];let localA=0,localL=0,steel=0;
  for(const p of P){
    const w=plan.get(p.id);
    if(w){
      if(w.steel){steelRows.push({p,w});steel+=p.weight;}
      if(w.paint==='full')full[paintZoneOf(p)]+=p.area;
      else if(w.paint==='local'){const a=w.area??localArea(p);localA+=a;localL+=litresOf(a,paintZoneOf(p));}   // area: 보수 이력 (the points repainted)
    }
    const fix=fixOf(w);
    for(const r of p.records){const next=predictNext(r,fix,rates);if(warnsOf(next))warns.push({r,next});}
  }
  const nextZones=pointZones(warns),nextWarn=nextZones.length;
  steelRows.sort((a,b)=>(a.p.step??9)-(b.p.step??9)||a.p.si-b.p.si||a.p.bin-b.p.bin||a.p.id.localeCompare(b.p.id));
  const paintRows=Object.entries(full).filter(([,a])=>a>0).map(([k,a])=>({key:k,zone:PAINT_SPEC[k].zone,work:'재도장',area:a,paint:PAINT_SPEC[k].paint,litres:litresOf(a,k)}));
  if(localA>0)paintRows.push({key:'local',zone:'국부 보수·터치업',work:'국부 보수·터치업',area:localA,paint:'구역별 동일',litres:localL});
  // friction: repainted plates all new coat; on a local plate its abnormal points
  const R=P.flatMap(p=>{const w=plan.get(p.id);return p.records.map(r=>[r,w]);});
  const friction=R.length?R.reduce((s,[r,w])=>s+FRICTION.dCF(w&&(w.paint==='full'||(w.paint==='local'&&abnormal(r)))?AHR.newCoat:ahrOf(r)),0)/R.length/FRICTION.CF*100:0;
  return {repaint:paintRows.reduce((s,x)=>s+x.area,0),steel,paint:paintRows.reduce((s,x)=>s+x.litres,0),friction,nextWarn,nextZones,
    steelRows,paintRows,steelN:steelRows.length};
}

/* the plan and result of a range of the store's docking, once per data version and range —
   level 0 = no repair (보고서 5장 "현재", 보수 효과 "보수 안 하면") */
let cache=null;
export function rangeResult(store,level,fullBelow=false){
  if(!cache||cache.v!==store.version||cache.plan!==store.plan)cache={v:store.version,plan:store.plan,out:new Map()};
  const k=`${level}${fullBelow?'+':''}`;
  if(!cache.out.has(k)){const plan=level?planOf(store,level,fullBelow):new Map();cache.out.set(k,{plan,...evaluate(store,plan)});}
  return cache.out.get(k);
}
export const noRepair=store=>rangeResult(store,0);

/* 보수 계획 화면의 범위 — the one state everything reads (plan/view.js state.range, the outputs' snapshot):
     {level 1–5, fullBelow, added: Set of plate ids put in by hand (taking one out = deleting it)}
   → {plan, base (the range's plan, fixed), added (the hand-put plates the range does not take in), ...evaluate}.
   A plate put in by hand gets its step's work (workOf); one the switch has since taken in counts as the range's.
   The screen reuses the last result while the state and the data are the same; the outputs ask for it fresh */
let stateCache=null;
export function stateResult(store,range,{fresh=false}={}){
  const key=`${range.level}${range.fullBelow?'+':''}|${[...range.added].sort().join(',')}`;
  if(!fresh&&stateCache&&stateCache.v===store.version&&stateCache.plan===store.plan&&stateCache.key===key)return stateCache.out;
  const base=planOf(store,range.level,range.fullBelow),plan=new Map(base),added=new Set(),{byId}=platesOf(store);
  for(const id of range.added){const p=byId.get(id);if(!p||!p.measurable||base.has(id))continue;plan.set(id,workOf(p.step));added.add(id);}
  const out={base,added,plan,...evaluate(store,plan)};
  if(!fresh)stateCache={v:store.version,plan:store.plan,key,out};
  return out;
}

/* 보수 이력 (지난 도킹, SPEC 13 #13): 그 도킹에서 실제로 보수한 판 = 정비 전(asFound)과 정비 후(afterRepair) 두께가 다른 측정점이 있는 판.
   강판 두께가 바뀐 점이 있으면 강판 교체·보강 · 도막 두께가 판의 모든 측정점에서 바뀌었으면 재도장 (판 전체),
   일부만이면 국부 보수 (바뀐 점의 면적). 물량은 evaluate와 같은 계산 → {plan, ...evaluate}. Once per data version */
let histCache=null;
export function historyResult(store){
  if(histCache&&histCache.v===store.version&&histCache.plan===store.plan)return histCache.out;
  const plan=new Map();
  for(const p of platesOf(store).plates){
    const R=p.records.filter(r=>r.asFound&&r.afterRepair);if(!p.measurable||!R.length)continue;
    const steel=R.some(r=>r.afterRepair.plate!==r.asFound.plate),coat=R.filter(r=>r.afterRepair.dft!==r.asFound.dft).length;
    if(!steel&&!coat)continue;
    const paint=coat===R.length?'full':coat?'local':null;
    plan.set(p.id,paint==='local'?{steel,paint,spot:false,area:Math.min(p.area,coat*CELL_AREA)}:{steel,paint,spot:false});
  }
  const out={plan,...evaluate(store,plan)};
  histCache={v:store.version,plan:store.plan,out};return out;
}
