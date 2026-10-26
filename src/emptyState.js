/* =========================================================
   빈 상태 안내: 보수 목록 · 상세 이미지가 같은 모양(글자 크기·색·가운데 위치·점 표시)과 같은 문구 규칙을 쓴다.
   - 매핑 중:   "매핑 중입니다" / "이상이 탐지되면 {무엇}이/가 여기에 표시됩니다" + 깜빡이는 점
   - 매핑 중지: "매핑이 중지되었습니다" / "이어서 매핑하면 이상 탐지를 계속합니다" + 멈춘 점
   - 매핑 완료인데 보여줄 것이 없을 때: PICK_HINT
   {무엇}: 목록 "보수 대상", 상세 "상세 정보" (외판 전개도는 안내 없이 매핑 모습을 그대로 보여준다)
   ========================================================= */
import { subj } from './format.js';

export const PICK_HINT='보수 우선순위 목록에서 지점을 선택하세요';
const DOTS='<div class="es-dots" aria-hidden="true"><i></i><i></i><i></i></div>';

/* icon: inline svg markup (optional) · live: 'on' blinking dots, 'off' still dots */
export function emptyState(title,sub='',{icon='',live=null}={}){
  return `<div class="empty-state${live?' live':''}${live==='off'?' paused':''}">${live?DOTS:icon}<b>${title}</b>${sub?`<span>${sub}</span>`:''}</div>`;
}

/* the mapping / paused notice for a panel, or null when no run is going */
export function mappingState(store,what){
  if(store.mapState==='mapping')return emptyState('매핑 중입니다',`이상이 탐지되면 ${subj(what)} 여기에 표시됩니다`,{live:'on'});
  if(store.mapState==='paused')return emptyState('매핑이 중지되었습니다','이어서 매핑하면 이상 탐지를 계속합니다',{live:'off'});
  return null;
}
