/* =========================================================
   패널 접기·최대화 (SPEC 10.4): 3D 선체 모델, 외판 전개도, 상세, KPI 핵심 지표, 보수 대상
   - 접기/펼치기: 위쪽 꺾쇠(접기) ↔ 아래쪽 꺾쇠(펼치기). −/+는 확대·축소로 오해하기 쉬워 쓰지 않는다.
   - 3D 선체 외판은 접지 않는다 (최대화만). 다른 패널을 접으면 그 자리를 3D가 채운다.
   - 접힌 패널은 헤더 줄만 남고 같은 열의 다른 패널이 높이를 채운다. 한 열이 모두 접히면 44px 세로 띠가 되어
     원래 열 순서대로 화면 오른쪽에 모인다 (띠는 위에서 아래까지). 펼친 열은 원래 폭 그대로, 3D가 나머지 폭을 모두 쓴다.
   - 최대화/복원: 헤더와 상태바 사이 전체를 차지한다. Esc로도 복원. KPI 핵심 지표·보수 목록은 최대화하지 않는다 (접기만).
   - 상태는 localStorage에 기억한다 (3D가 접힌 상태로 저장돼 있으면 무시).
   - setSolo(true): 3D만 화면 전체 (신조 인도 보기) — 다른 패널은 숨기고 3D 최대화 버튼은 비활성. 저장 상태는 그대로 둔다.
   ========================================================= */
export const CHEV='<svg class="ic chev" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 10l4-4 4 4"/></svg>';
const ICON_MAX='<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/></svg>';
const ICON_RESTORE='<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 2.5V6H2.5M13.5 6H10V2.5M10 13.5V10h3.5M2.5 10H6v3.5"/></svg>';
const COLS=[['pane3d'],['paneShell','paneDetail'],['paneKpi','paneList']];
const AREAS=[['main','main'],['shell','detail'],['kpi','kpi']];   // grid areas per column: top row, bottom row
const WEIGHT=[50,29,21];          // 레이아웃.png 비율 (style.css .main 과 같은 값)
const GAPS='16px';                // the two 8px column gaps (style.css .main gap)
const STRIP='44px';
const KEY='drdock.panels.v1';
const NO_MAX=new Set(['paneKpi','paneList']);   // fold only
const NO_FOLD=new Set(['pane3d']);              // maximize only

export function setupPanels(main){
  let st={collapsed:{},max:null},solo=false;
  try{const v=JSON.parse(localStorage.getItem(KEY)||'null');if(v&&typeof v==='object')st={collapsed:v.collapsed||{},max:v.max&&!NO_MAX.has(v.max)?v.max:null};}catch(_){}   // a stored max of a fold-only panel is ignored
  NO_FOLD.forEach(id=>delete st.collapsed[id]);   // the 3D panel is never folded
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(st));}catch(_){}};
  const mobile=matchMedia('(max-width:820px)');
  const panes={};
  COLS.flat().forEach(id=>{
    const el=document.getElementById(id),ctl=document.createElement('div');
    ctl.className='pane-ctl';
    ctl.innerHTML=(NO_FOLD.has(id)?'':`<button class="icon-btn" data-act="fold">${CHEV}</button>`)+(NO_MAX.has(id)?'':`<button class="icon-btn" data-act="max">${ICON_MAX}</button>`);
    el.querySelector('.pane-head').appendChild(ctl);
    ctl.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;
      if(b.dataset.act==='fold')st.collapsed[id]=!st.collapsed[id];
      else{st.max=st.max===id?null:id;if(st.max)st.collapsed[id]=false;}
      apply();save();});
    panes[id]={el,fold:ctl.querySelector('[data-act=fold]'),max:ctl.querySelector('[data-act=max]')};
  });

  function apply(){
    const max=solo?null:st.max,isStrip=col=>!max&&!mobile.matches&&col.every(id=>st.collapsed[id]);
    main.classList.toggle('has-max',!!max);main.classList.toggle('solo',solo);
    COLS.forEach(col=>{
      const strip=isStrip(col);
      col.forEach(id=>{
        const p=panes[id],folded=!max&&!!st.collapsed[id],isMax=max===id;
        p.el.classList.toggle('collapsed',folded);p.el.classList.toggle('strip',strip);p.el.classList.toggle('max',isMax);
        if(p.fold){
          p.fold.classList.toggle('down',folded);p.fold.hidden=isMax;
          p.fold.title=folded?'펼치기':'접기';p.fold.setAttribute('aria-label',p.fold.title);p.fold.setAttribute('aria-expanded',String(!folded));}
        if(p.max){
          p.max.innerHTML=isMax?ICON_RESTORE:ICON_MAX;p.max.hidden=strip;p.max.disabled=solo;
          p.max.title=isMax?'복원':'최대화';p.max.setAttribute('aria-label',p.max.title);p.max.setAttribute('aria-pressed',String(isMax));}
      });
    });
    if(mobile.matches||max||solo){main.style.gridTemplateColumns='';main.style.gridTemplateRows='';main.style.gridTemplateAreas='';return;}
    // open columns first (3D takes the rest), then the folded columns as strips on the right, each group in the original order
    const order=[0,1,2].sort((a,b)=>isStrip(COLS[a])-isStrip(COLS[b])||a-b);
    main.style.gridTemplateColumns=order.map(i=>i===0?'minmax(0,1fr)':isStrip(COLS[i])?STRIP:`minmax(0,calc((100% - ${GAPS}) * ${WEIGHT[i]/100}))`).join(' ');
    main.style.gridTemplateAreas=[0,1].map(row=>`"${order.map(i=>AREAS[i][row]).join(' ')}"`).join(' ');
    const [a,b]=COLS[1].map(id=>!!st.collapsed[id]);
    main.style.gridTemplateRows=a&&b?'minmax(0,1fr) minmax(0,1fr)':a?`${STRIP} minmax(0,1fr)`:b?`minmax(0,1fr) ${STRIP}`:'minmax(0,1fr) minmax(0,1fr)';   // S.SHELL : 상세 이미지 = 50 : 50
  }
  mobile.addEventListener('change',apply);
  // overlays (menu, legend, lightbox) handle Esc first and mark it handled
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!e.defaultPrevented&&st.max&&!solo){st.max=null;apply();save();}});
  apply();
  return {setSolo(on){solo=!!on;apply();}};
}
