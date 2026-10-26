/* =========================================================
   패널 접기·최대화 (SPEC 10.4): 3D 선체 모델, 외판 전개도, 상세, KPI 핵심 지표, 보수 대상
   - 접기/펼치기: 위쪽 꺾쇠(접기) ↔ 아래쪽 꺾쇠(펼치기). −/+는 확대·축소로 오해하기 쉬워 쓰지 않는다.
   - 접힌 패널은 헤더 줄만 남고 같은 열의 다른 패널이 높이를 채운다. 한 열이 모두 접히면 44px 세로 띠가 된다.
   - 최대화/복원: 헤더와 상태바 사이 전체를 차지한다. Esc로도 복원.
   - 상태는 localStorage에 기억한다.
   ========================================================= */
export const CHEV='<svg class="ic chev" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 10l4-4 4 4"/></svg>';
const ICON_MAX='<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/></svg>';
const ICON_RESTORE='<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 2.5V6H2.5M13.5 6H10V2.5M10 13.5V10h3.5M2.5 10H6v3.5"/></svg>';
const COLS=[['pane3d'],['paneShell','paneDetail'],['paneKpi','paneList']];
const WEIGHT=[50,29,21];          // 레이아웃.png 비율 (style.css .main 과 같은 값)
const STRIP='44px';
const KEY='drdock.panels.v1';

export function setupPanels(main){
  let st={collapsed:{},max:null};
  try{const v=JSON.parse(localStorage.getItem(KEY)||'null');if(v&&typeof v==='object')st={collapsed:v.collapsed||{},max:v.max||null};}catch(_){}
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(st));}catch(_){}};
  const mobile=matchMedia('(max-width:820px)');
  const panes={};
  COLS.flat().forEach(id=>{
    const el=document.getElementById(id),ctl=document.createElement('div');
    ctl.className='pane-ctl';
    ctl.innerHTML=`<button class="icon-btn" data-act="fold">${CHEV}</button><button class="icon-btn" data-act="max">${ICON_MAX}</button>`;
    el.querySelector('.pane-head').appendChild(ctl);
    ctl.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
      if(b.dataset.act==='fold')st.collapsed[id]=!st.collapsed[id];
      else{st.max=st.max===id?null:id;if(st.max)st.collapsed[id]=false;}
      apply();save();});
    panes[id]={el,fold:ctl.children[0],max:ctl.children[1]};
  });

  function apply(){
    main.classList.toggle('has-max',!!st.max);
    COLS.forEach(col=>{
      const strip=!st.max&&!mobile.matches&&col.every(id=>st.collapsed[id]);
      col.forEach(id=>{
        const p=panes[id],folded=!st.max&&!!st.collapsed[id],isMax=st.max===id;
        p.el.classList.toggle('collapsed',folded);p.el.classList.toggle('strip',strip);p.el.classList.toggle('max',isMax);
        p.fold.classList.toggle('down',folded);p.fold.hidden=isMax;
        p.fold.title=folded?'펼치기':'접기';p.fold.setAttribute('aria-label',p.fold.title);p.fold.setAttribute('aria-expanded',String(!folded));
        p.max.innerHTML=isMax?ICON_RESTORE:ICON_MAX;p.max.hidden=strip;
        p.max.title=isMax?'복원':'최대화';p.max.setAttribute('aria-label',p.max.title);p.max.setAttribute('aria-pressed',String(isMax));
      });
    });
    if(mobile.matches||st.max){main.style.gridTemplateColumns='';main.style.gridTemplateRows='';return;}
    main.style.gridTemplateColumns=COLS.map((col,i)=>col.every(id=>st.collapsed[id])?STRIP:`minmax(0,${WEIGHT[i]}fr)`).join(' ');
    const [a,b]=COLS[1].map(id=>!!st.collapsed[id]);
    main.style.gridTemplateRows=a&&b?'minmax(0,1fr) minmax(0,1fr)':a?`${STRIP} minmax(0,1fr)`:b?`minmax(0,1fr) ${STRIP}`:'minmax(0,6fr) minmax(0,5fr)';
  }
  mobile.addEventListener('change',apply);
  // overlays (menu, legend, lightbox) handle Esc first and mark it handled
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!e.defaultPrevented&&st.max){st.max=null;apply();save();}});
  apply();
}
