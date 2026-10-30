/* =========================================================
   화면 전환 (SPEC 12.2): 헤더 로고 오른쪽 [진단] [보수] 탭. 선택된 탭은 주황 배경.
   - 진단 = 지금 대시보드 그대로 · 보수 계획 = plan/view.js (처음 열 때 만든다)
   - 보수 계획은 매핑이 완료된 도킹에서만: 매핑 중·매핑 중지·신조 인도 보기에서는 탭을
     비활성으로 두고 툴팁으로 알린다. 보수 계획을 보는 중에 그 상태가 되면 진단으로 돌아간다.
   - 도킹 선택은 헤더 하나를 같이 쓰므로 두 화면이 같은 도킹을 본다. 탭 이름은 어느 도킹이든 "보수" — 지난 도킹(1차 리도킹)은
     그때 보수한 판을 읽기 전용으로 보여 준다 (plan/view.js 보수 이력).
   - 헤더 오른쪽 출력 버튼 (SPEC 13.1): 진단 = "진단 보고서(PDF)" (#reportBtn) · 보수 계획 = "자재 발주 목록(Excel)" · "보수 도면(PDF)"
     (#xlsxBtn · #planPdfBtn, plan/view.js). body.view-plan으로 화면에 맞는 것만 보인다 (style.css).
   ========================================================= */
import { createPlanView } from './view.js';

export const PLAN_UNAVAILABLE='매핑이 완료된 도킹에서 사용할 수 있습니다';

export function setupScreens(store,toast){
  const $=s=>document.querySelector(s);
  const tabs=[...document.querySelectorAll('.view-tabs [data-screen]')],planTab=$('#tabPlan');
  const views={diag:$('#diagView'),plan:$('#planView')};
  let screen='diag',view=null;
  const available=()=>store.mapState==='done'&&store.dockKey!=='newbuild';

  function show(s){
    if(s==='plan'&&!available())s='diag';
    screen=s;
    Object.entries(views).forEach(([k,el])=>{el.hidden=k!==s;});
    document.body.classList.toggle('view-plan',s==='plan');
    tabs.forEach(t=>{const on=t.dataset.screen===s;t.setAttribute('aria-selected',String(on));t.tabIndex=on?0:-1;});
    if(s==='plan'){if(!view)view=createPlanView(views.plan,store,{toast});view.refresh();}
  }
  function sync(){
    const ok=available();
    planTab.setAttribute('aria-disabled',String(!ok));planTab.classList.toggle('is-disabled',!ok);planTab.title=ok?'':PLAN_UNAVAILABLE;
    if(!ok&&screen==='plan')show('diag');
    else if(screen==='plan')view.refresh();
  }
  const go=s=>{if(s==='plan'&&!available()){toast(PLAN_UNAVAILABLE);return;}if(s!==screen)show(s);};
  tabs.forEach(t=>t.addEventListener('click',()=>go(t.dataset.screen)));
  // arrow keys between the two tabs (tablist)
  $('.view-tabs').addEventListener('keydown',e=>{if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;e.preventDefault();
    const next=screen==='diag'?'plan':'diag';go(next);document.querySelector(`.view-tabs [data-screen="${screen}"]`).focus();});
  store.subscribe(k=>{if(k.has('state')||k.has('records'))sync();});   // a docking change sends both
  sync();
  return {show:go,get screen(){return screen;}};
}
