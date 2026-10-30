/* =========================================================
   판 한 장의 설명 (SPEC 13.5, 13.6): 보수 도면 툴팁 · 선택한 판 · 보수 대상 목록이 같이 쓴다.
   - 클릭 가능한 판 = 측정한 판 중 보수 단계(1–7)가 있는 판 (판정 주의 이상). 정상 판과 측정 불가 판은 클릭·툴팁 없음.
   - 측정값: 레이어마다 판에서 가장 나쁜 측정점 하나 — 강판·도막 = 감소율 최대 · 손상 = 도막 떨어짐 → 스크래치, 넓은 것.
     표시는 대시보드와 같은 형식 (format.js): 13.8 / 19.5 mm (29.2%) · 94 / 350 µm (73.1%) · 도막 떨어짐 0.7 m²
   - 보수 대상인 이유: 레이어별 판정(p.grades)을 문장 하나로 이어 쓰고 → 보수 단계의 조치 (data/repairSteps.js, 대시보드와 같은 이름)
   ========================================================= */
import { CRITERIA, DEFECT_LABEL, LAYER_LABEL, OK, WARN, CRIT, GRADE_LABEL, dftLoss, plateLoss } from '../data/criteria.js';
import { stepInfo } from '../data/repairSteps.js';
import { thickNum, thick, lossPct, areaNum } from '../format.js';
import { PLATE_SIDE_LABEL } from '../data/plates.js';

export const clickable=p=>p.measurable&&p.step!=null;
/* FR50–56·C·우현 (PDF·Excel 강판 목록) · with the zone: FR50–56·C·우현·빌지 (선택한 판, 보수 대상 목록) */
export const plateLoc=p=>`FR${p.frFrom}–${p.frTo}·${p.strake}·${PLATE_SIDE_LABEL[p.side]}`;
export const plateWhere=p=>`${plateLoc(p)}·${p.zone}`;
/* the group name of a step: 최우선 보수 · 강판 두께 경고 · 도막 손상 주의 … */
export const stepTitle=s=>{const i=stepInfo(s);return i.layer==='all'?GRADE_LABEL[i.grade]:`${LAYER_LABEL[i.layer]} ${GRADE_LABEL[i.grade]}`;};

const worst=(R,score)=>R.reduce((a,r)=>!a||score(r)>score(a)?r:a,null);
const DEFECT_RANK={flaking:2,scratch:1};
/* the worst point of each layer on the plate (null = no value in that layer) */
export function worstOf(p){
  const R=p.records;
  return {plate:worst(R,plateLoss),dft:worst(R,dftLoss),
    defect:worst(R.filter(r=>r.defect),r=>(DEFECT_RANK[r.defect]||0)*1e3+(r.defectArea||0))};
}
/* the three measurement lines: [label, text] — "—" where the layer has no value */
export function measureRows(p){
  const w=worstOf(p);
  return [
    ['강판',w.plate?`${thickNum(w.plate.plate,'plate')} / ${thick(w.plate.plateOrig,'plate')} (${lossPct(w.plate,'plate')})`:'—'],
    ['도막',w.dft?`${thickNum(w.dft.dft,'dft')} / ${thick(w.dft.dftDesign,'dft')} (${lossPct(w.dft,'dft')})`:'—'],
    ['손상',w.defect?`${DEFECT_LABEL[w.defect.defect]} ${areaNum(w.defect.defectArea||0)} m²`:'—']];
}

/* tooltip line 2: the value behind the plate's step and its judgement — 강판 감소율 29.2% · 경고 / 도막 감소율 73.2% · 경고 */
export function stepReason(p){
  const i=stepInfo(p.step),w=worstOf(p),layer=i.layer==='all'?'plate':i.layer;
  const what=layer==='plate'||layer==='dft'?`${layer==='plate'?'강판':'도막'} 감소율 ${lossPct(w[layer],layer)}`
    :`${DEFECT_LABEL[w.defect.defect]} ${areaNum(w.defect.defectArea||0)} m²`;
  return `${what} · ${GRADE_LABEL[i.grade]}`;
}

/* 보수 대상인 이유: one clause per layer above 정상, joined (…고 …어요), the later ones with 도; then → the step's action */
const pc=x=>Math.round(x*100);
const CLAUSES={
  // the criteria's 이상: "…% 이상이 되었고 / 되었어요"
  plate:g=>{const t=pc(g>=CRIT?CRITERIA.plate.crit:CRITERIA.plate.warn);return [`강판 감소율이 ${t}% 이상이 되었`,`강판 감소율도 ${t}% 이상이 되었`];},
  dft:g=>{const t=pc(g>=CRIT?CRITERIA.dft.crit:CRITERIA.dft.warn);return [`도막 감소율이 ${t}% 이상이 되었`,`도막 감소율도 ${t}% 이상이 되었`];},
  flaking:()=>['도막이 떨어져 있','도막도 떨어져 있'],
  scratch:()=>['도막에 스크래치가 있','도막에도 스크래치가 있']
};
export function reasonText(p){
  const g=p.grades,w=worstOf(p),parts=[];
  if(g.plate>OK)parts.push(CLAUSES.plate(g.plate));
  if(g.dft>OK)parts.push(CLAUSES.dft(g.dft));
  if(g.defect>OK&&w.defect)parts.push(CLAUSES[w.defect.defect]());
  const text=parts.map((c,i)=>c[i?1:0]+(i===parts.length-1?'어요.':'고')).join(' ');
  return {text:text||`${GRADE_LABEL[Math.max(WARN,stepInfo(p.step).grade)]} 판정이에요.`,action:stepInfo(p.step).action};
}
