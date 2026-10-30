/* =========================================================
   보수 계획 패널 접기·최대화 (SPEC 13 #10): 진단 화면(panels.js)과 같은 버튼·꺾쇠·아이콘.
   배치: 위 보수 범위 설정 | 보수 물량 및 효과 · 아래 보수 도면 | 보수 정보 (오른쪽 열 한 폭).
   - 보수 도면: 최대화만 (보수 계획 화면 전체, 다시 누르거나 Esc로 복원)
   - 보수 범위 설정 · 보수 물량 및 효과 · 보수 정보: 접기만. 접힌 패널은 헤더 줄만 남는다.
   - 남은 공간은 보수 도면이 채운다: 보수 범위 설정을 접으면 보수 도면이 위로 늘고, 오른쪽 열이 모두 접히면
     44px 세로 띠 두 개가 되어 보수 도면이 나머지 폭을 쓴다. 오른쪽 열에서 하나만 접히면 다른 하나가 높이를 채운다.
   - 보수 범위 설정과 보수 물량 및 효과는 펼쳐져 있으면 한 줄 (같은 높이), 그 아래 보수 도면과 보수 정보의 위가 맞는다.
   - 보수 이력 (setHistory): 보수 범위 설정이 없다 — 왼쪽 보수 도면이 위아래 전체, 오른쪽 열(같은 폭)에 보수 물량 및 효과 (위)
     / 보수 정보 (아래). 하나를 접으면 다른 하나가 오른쪽 열 높이를 채우고, 둘 다 접으면 44px 세로 띠가 된다.
   - 상태는 localStorage에 기억한다. 좁은 화면(≤ 820px)은 세로로 쌓고 띠를 만들지 않는다 (style.css).
   ========================================================= */
import { CHEV, ICON_MAX, ICON_RESTORE } from '../panels.js';

const KEY='drdock.planPanels.v3';
const FOLD=['paneRange','paneEffect','paneSide'],MAX='paneDraw';
const RIGHT='clamp(440px,31%,600px)',STRIP='44px',HEAD='44px';
const FILL='minmax(0,1fr)';

export function setupPlanPanels(root){
  let st={collapsed:{},max:false},history=false;
  try{const v=JSON.parse(localStorage.getItem(KEY)||'null');if(v&&typeof v==='object')st={collapsed:v.collapsed||{},max:!!v.max};}catch(_){}
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(st));}catch(_){}};
  const mobile=matchMedia('(max-width:820px)');
  const panes={};
  [...FOLD,MAX].forEach(id=>{
    const el=root.querySelector('#'+id),ctl=document.createElement('div');
    ctl.className='pane-ctl';
    ctl.innerHTML=`<button class="icon-btn" data-act="${id===MAX?'max':'fold'}">${id===MAX?ICON_MAX:CHEV}</button>`;
    el.querySelector('.pane-head').appendChild(ctl);
    ctl.addEventListener('click',()=>{if(id===MAX)st.max=!st.max;else st.collapsed[id]=!st.collapsed[id];apply();save();});
    panes[id]={el,btn:ctl.querySelector('button')};
  });

  /* the folded panels that become 44px strips (the right column all folded) */
  const strips=()=>{
    if(mobile.matches)return [];
    return st.collapsed.paneEffect&&st.collapsed.paneSide?['paneEffect','paneSide']:[];
  };
  /* the grid: columns, rows and areas by what is folded */
  function grid(){
    const r=!!st.collapsed.paneRange,e=!!st.collapsed.paneEffect,s=!!st.collapsed.paneSide;
    if(history)return {cols:`${FILL} ${e&&s?STRIP:RIGHT}`,rows:e&&s?`${FILL} ${FILL}`:e?`${HEAD} ${FILL}`:s?`${FILL} ${HEAD}`:`auto ${FILL}`,
      areas:['draw effect','draw side']};
    const top=r?HEAD:'auto',L3=['range effect','draw effect','draw side'];
    if(e&&s)return {cols:`${FILL} ${STRIP}`,rows:`${top} ${FILL} ${FILL}`,areas:L3};   // two strips
    if(s)return {cols:`${FILL} ${RIGHT}`,rows:`${top} ${FILL} ${HEAD}`,areas:L3};      // 보수 물량 및 효과 fills
    if(e)return r?{cols:`${FILL} ${RIGHT}`,rows:`${HEAD} ${FILL}`,areas:['range effect','draw side']}
      :{cols:`${FILL} ${RIGHT}`,rows:`${HEAD} auto ${FILL}`,areas:['range effect','range side','draw side']};
    return r?{cols:`${FILL} ${RIGHT}`,rows:`${HEAD} auto ${FILL}`,areas:L3}
      :{cols:`${FILL} ${RIGHT}`,rows:`auto ${FILL}`,areas:['range effect','draw side']};
  }
  function apply(){
    const max=st.max,strip=max?[]:strips();
    root.classList.toggle('has-max',max);root.classList.toggle('is-history',history);
    panes.paneRange.el.hidden=history;
    FOLD.forEach(id=>{
      const p=panes[id],folded=!max&&!!st.collapsed[id];
      p.el.classList.toggle('collapsed',folded);p.el.classList.toggle('strip',strip.includes(id));
      p.btn.classList.toggle('down',folded);p.btn.title=folded?'펼치기':'접기';
      p.btn.setAttribute('aria-label',p.btn.title);p.btn.setAttribute('aria-expanded',String(!folded));
    });
    const m=panes[MAX];m.el.classList.toggle('max',max);
    m.btn.innerHTML=max?ICON_RESTORE:ICON_MAX;m.btn.title=max?'복원':'최대화';m.btn.setAttribute('aria-label',m.btn.title);m.btn.setAttribute('aria-pressed',String(max));
    if(mobile.matches||max){root.style.gridTemplateColumns=root.style.gridTemplateRows=root.style.gridTemplateAreas='';return;}
    const g=grid();
    root.style.gridTemplateColumns=g.cols;root.style.gridTemplateRows=g.rows;root.style.gridTemplateAreas=g.areas.map(a=>`"${a}"`).join(' ');
  }
  mobile.addEventListener('change',apply);
  // Esc restores the maximized drawing while the plan screen shows (overlays mark Esc handled first)
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!e.defaultPrevented&&st.max&&!root.hidden){st.max=false;apply();save();}});
  apply();
  return {setHistory(on){if(history!==!!on){history=!!on;apply();}}};
}
