/* =========================================================
   보수 단계 (SPEC 12.4): 세 레이어를 합친 순서, 1이 가장 심각하다.
   한 판(또는 한 위치)이 여러 단계에 해당하면 가장 심각한 단계 하나로 정한다 (stepOf).
   ACTION_ORDER(무거운 조치 → 가벼운 조치)는 이 표의 조치를 단계 순서대로 한 번씩 모은 것이다 —
   보고서 5장 구역별 보수 물량의 "가장 무거운 조치 하나만 센다" 규칙도 이 순서를 쓴다.
   grade: criteria.gradeOf 단계 (TOP 최우선 보수 · CRIT 경고 · WARN 주의) · layer 'all' = 세 레이어 중 하나라도
   ========================================================= */
import { ACTION, TOP, CRIT, WARN, gradeName } from './criteria.js';

export const REPAIR_STEPS=[
  {step:1,layer:'all',   grade:TOP, action:ACTION.steelRepaint},   // 최우선 보수
  {step:2,layer:'plate', grade:CRIT,action:ACTION.steel},          // 강판 두께 경고
  {step:3,layer:'defect',grade:CRIT,action:ACTION.repaint},        // 도막 손상 경고 (도막 떨어짐)
  {step:4,layer:'dft',   grade:CRIT,action:ACTION.repaint},        // 도막 두께 경고
  {step:5,layer:'plate', grade:WARN,action:ACTION.local},          // 강판 두께 주의
  {step:6,layer:'dft',   grade:WARN,action:ACTION.local},          // 도막 두께 주의
  {step:7,layer:'defect',grade:WARN,action:ACTION.touchUp}         // 도막 손상 주의 (스크래치)
].map(s=>({...s,label:s.layer==='defect'?`${gradeName(s.grade)} (${gradeName(s.grade,'defect')})`:gradeName(s.grade)}));

export const ACTION_ORDER=[...new Set(REPAIR_STEPS.map(s=>s.action))];
export const stepInfo=n=>REPAIR_STEPS[n-1];

/* grades: the worst grade per layer {plate, dft, defect} (0 정상 … TOP) → the most serious step (1–7), null = 정상 */
export function stepOf(grades){
  for(const s of REPAIR_STEPS){
    if(s.layer==='all'?Object.values(grades).some(g=>g===TOP):grades[s.layer]===s.grade)return s.step;
  }
  return null;
}
