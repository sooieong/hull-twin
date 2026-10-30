/* =========================================================
   도킹 이력 (예시): 5년 주기. 헤더 도킹 선택, 상세 패널, 보고서, 감소 속도·예측 계산이 모두 이 값을 쓴다.
   신조 인도 2016.10 → 1차 리도킹 2021.10 → 2차 리도킹 2026.10 (현재)
   헤더 드롭다운: 현재 = 매핑 화면 · 1차 리도킹 = 그때 매핑을 마친 기록 보기 · 신조 인도 = 측정 데이터 없이 3D만
   ========================================================= */
import { DOCKING_CYCLE_YEARS } from './baseline.js';
export { DOCKING_CYCLE_YEARS };   // 도킹 주기 (baseline.js)
export const DOCKINGS=[
  {key:'current',date:'2026.10',name:'2차 리도킹',short:'2차',dock:'2번 도크',current:true,next:'2031.10'},
  {key:'first',date:'2021.10',name:'1차 리도킹',short:'1차',next:'2026.10'},
  {key:'newbuild',date:'2016.10',name:'신조 인도',short:'신조'}
];
export const CURRENT_DOCK=DOCKINGS[0],PREV_DOCK=DOCKINGS[1];
export const NEXT_DOCK_DATE=CURRENT_DOCK.next;
export const dockOf=key=>DOCKINGS.find(d=>d.key===key)||CURRENT_DOCK;
/* the docking before this one (the reference for "since …" and loss rates); 신조 인도 has none */
export const prevDockOf=d=>DOCKINGS[DOCKINGS.indexOf(d)+1]||null;
/* "1차 리도킹(2021.10)" — 화면·보고서의 "1차" 값은 이 도킹의 출거 시점(정비를 마친 뒤) 두께 */
export const dockLabel=d=>`${d.name}(${d.date})`;
export const prevDockLabel=dockLabel(PREV_DOCK);
