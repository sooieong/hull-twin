/* =========================================================
   도킹 이력 (예시): 5년 주기. 헤더 도킹 선택, 상세 패널, 보고서, 감소 속도·예측 계산이 모두 이 값을 쓴다.
   신조 인도 2016.10 → 1차 리도킹 2021.10 → 2차 리도킹 2026.10 (현재)
   ========================================================= */
export const DOCKING_CYCLE_YEARS=5;
export const DOCKINGS=[
  {date:'2026.10',name:'2차 리도킹',dock:'2번 도크',current:true},
  {date:'2021.10',name:'1차 리도킹'},
  {date:'2016.10',name:'신조 인도'}
];
export const CURRENT_DOCK=DOCKINGS[0],PREV_DOCK=DOCKINGS[1];
export const NEXT_DOCK_DATE='2031.10';
/* "1차 리도킹(2021.10)" — 화면·보고서의 "1차" 값은 이 도킹의 출거 시점(정비를 마친 뒤) 두께 */
export const prevDockLabel=`${PREV_DOCK.name}(${PREV_DOCK.date})`;
