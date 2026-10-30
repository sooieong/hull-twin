/* =========================================================
   보수 계획 화면 (SPEC 13): 위 보수 범위 설정 | 보수 물량 및 효과 · 아래 보수 도면 | 보수 정보 (오른쪽 열 한 폭).
   보수 도면은 최대화만, 나머지는 접기만 (plan/layout.js). 글자 크기·굵기는 진단 화면과 같은 토큰 규칙.
   - 보수 범위 설정: 5단 슬라이더 (plan/scenario.js LEVELS, 기본 3단계 = 권장) + 스위치 "수면 아래 전체 재도장"
     (기본 꺼짐, 어느 단과도 조합). 주황 점을 끌면 매끄럽게 따라오고 놓으면 가장 가까운 단계로 붙는다.
     점 클릭과 키보드 좌우 화살표도 된다.
   - 보수 범위의 상태는 하나 (state.range: 단계 · 스위치 · 직접 추가한 판). 도면 · 보수 물량 및 효과 · 최종 보수 목록 · PDF · Excel이
     모두 이 상태를 scenario.stateResult로 계산한다 (출력은 버튼을 누를 때 그 상태로 다시).
   - 선택 규칙: 범위(슬라이더 단계 + 스위치)에 든 판은 고정 — 뺄 수 없다. 범위 밖의 주의 이상 판(회색 점선)만 더하거나 다시 뺀다
     (range.added = 더한 판). 회색 점선 판을 누르면 도면 위 그 판 옆에 팝업 (판 번호 · 위치 · 강판·도막·손상 · 예상 조치 ·
     [보수 목록에 추가]) — 바깥을 누르거나 Esc로 닫힌다. 더하면 주황이 되고 최종 보수 목록에 들어가며 판 정보에서 고를 수 있다.
     더하면 최종 보수 목록 탭 이름 옆에 작은 주황 점 (그 탭을 열면 사라진다), 목록을 열면 그 판 줄이 1.5초 옅은 주황으로 반짝인다.
     판 정보에는 보수 대상(범위의 판, 더한 판)만 보인다 — 회색 점선 판은 팝업에서만.
     단계를 바꾸거나 도킹을 바꾸면 더한 판은 지워진다 (판의 보수 단계가 도킹마다 다르다). 스위치는 그대로 둔다.
   - 보수 물량 및 효과 (13.4): 강판 교체 · 재도장 / 마찰 저항 (보수 후, (N% 감소)) · 다음 도킹 경고 예상 ((N% 감소)).
     N은 아무 판도 보수하지 않은 같은 계산 (noRepair) 대비. 단계·스위치·더한 판이 바뀔 때마다 다시 계산한다.
   - 보수 도면 (13.5, plan/drawing.js): S.SHELL 외판 전개도만 (3D 보기 없음). 색 규칙은 drawing.js
     (범위 = 회색 섞인 조치별 단색, 추가 = 주황, 추가 가능 = 회색 점선).
   - 보수 정보 (13.6): [판 정보] [최종 보수 목록]. 최종 보수 목록 탭일 때만 패널 이름 옆에 "총 N판".
     처음 열 때 보수 대상 중 가장 심각한 판을 고른다.
     판 정보: 측정값 · 보수 대상인 이유 · 더한 판이면 패널 맨 아래 주황 버튼 "보수 목록에서 제외",
     범위의 판이면 회색 안내 "보수 목록에 포함된 판".
     최종 보수 목록: 계획에 든 판만 — "추가한 판" (NEW 아이콘, 줄마다 체크박스: 끄면 뺀다), 그 아래 그 판을
     처음 넣는 단계별 그룹 (판정 아이콘 + 최우선 보수 → 강판 두께 경고 → 도막 두께 경고·손상 → 다음 도킹 경고 예상 → 주의).
     그룹마다 3개, 넘치면 "더 보기 (+N판) ⌄" / "접기 ⌃". 줄을 누르면 그 판을 고르고 판 정보 탭으로 간다. 위치는 FR 구간만 흰색 굵게.
   - 보수 이력 (13 #13): 현재가 아닌 도킹(1차 리도킹)은 읽기 전용 — 보수 범위 설정을 숨기고 (왼쪽 보수 도면이 위아래 전체,
     오른쪽 열에 보수 물량 및 효과 / 보수 정보), 추가/제외도 없다.
     그 도킹에서 실제로 보수한 판 (scenario.historyResult: 정비 전 asFound와 정비 후 afterRepair 두께가 다른 판)을 조치별 색으로.
     1차 정비는 권장 범위로 했다 (data/simulator.repairedAt) — 보수 도면 부제 자리에 "기준: 도막 두께 경고·손상 (권장)".
     보수 물량 및 효과: 강판 교체 · 재도장 · 마찰 저항 (보수 안 했을 때 대비). 판 정보는 현재 도킹과 같은 "보수 대상인 이유",
     최종 보수 목록은 조치별 그룹. 헤더 Excel은 "자재 사용 내역(Excel)" (같은 양식, 결재란 없음), 보수 도면(PDF)은 그 기록을 뽑는다.
   - 출력 (헤더, 보수 계획 탭에서만): 자재 발주 목록(Excel) (보수 이력: 자재 사용 내역(Excel)) · 보수 도면(PDF). plan/output.js, 누를 때 불러온다.
     저장 방식은 보고서와 같다 (saveFile.js).
   ========================================================= */
import { SHIP, PAINT_LOSS } from '../data/baseline.js';
import { platesOf } from '../data/plates.js';
import { plateLoss } from '../data/criteria.js';
import { stepInfo } from '../data/repairSteps.js';
import { num } from '../format.js';
import { CHEV } from '../panels.js';
import { gradeIcon } from '../gradeUi.js';
import newPng from '../assets/icons/new.png';
import { setupPlanPanels } from './layout.js';
import { LEVELS, DEFAULT_LEVEL, levelOf, levelName, noRepair, historyResult, stateResult, entryLevel, kindOf } from './scenario.js';
import { createRepairDrawing, lookOf, KIND_LABEL } from './drawing.js';
import { clickable, plateWhere, measureRows, reasonText } from './plateInfo.js';
import { pickHandle, saveBlob, shortError, ymd, ABORT } from '../saveFile.js';

export const PAINT_FORMULA=`필요량 = 면적 × 설계 두께 ÷ 고형분 비율 × (1 + 손실률 ${Math.round(PAINT_LOSS*100)}%)`;
export const REPAINT_RULE='재도장 면적 = 재도장 판 전체 + 국부 보수·터치업 지점 면적 (보수 효과 재도장과 같음)';
export const FULL_BELOW_LABEL='수면 아래 전체 재도장';
/* a level's name without the leading "+ " (기준) */
const levelText=lv=>levelName(lv).replace(/^\+ /,'');
/* 기준: 도막 두께 경고·손상 (권장) · 수면 아래 전체 재도장 (switch on only) · 직접 추가한 판 N개 (when there are any) — PDF 1장 · Excel */
export const rangeName=(level,fullBelow,added)=>
  `기준: ${levelText(levelOf(level))}${fullBelow?` · ${FULL_BELOW_LABEL}`:''}${added?` · 직접 추가한 판 ${num(added)}개`:''}`;
/* 보수 이력: the range the past maintenance followed (data/simulator.repairedAt) — the drawing's subtitle, PDF · Excel */
const HISTORY_BASIS=rangeName(DEFAULT_LEVEL,false,0);
export const historyName=()=>HISTORY_BASIS;
const GROUP_SHOW=3;   // 최종 보수 목록: rows shown per group before "더 보기" (as the 진단 보수 목록)
/* 최종 보수 목록 위치: the FR range white and bold, the rest grey (as the 진단 보수 목록) */
const locHtml=p=>{const [fr,...rest]=plateWhere(p).split('·');return `<b>${fr}</b>·${rest.join('·')}`;};
/* the 추가한 판 group's icon (put in by hand: plates of mixed judgements) */
const NEW_ICON=`<img class="gi gi-new" src="${newPng}" alt="" aria-hidden="true" draggable="false">`;
/* 보수 이력: the work done, in words — 강판 교체·보강 + 재도장 … */
export const WORK_KINDS=['steel','paint','local'];
export const workText=w=>[w.steel&&KIND_LABEL.steel,w.paint==='full'&&KIND_LABEL.paint,w.paint==='local'&&'국부 보수'].filter(Boolean).join(' + ');
const kv=p=>`<dl class="sp-kv">${measureRows(p).map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
/* 보수 물량 및 효과 "(N% 감소)": % less than without repair (null = not less) — the screen and the 보수 도면 PDF */
const cut=(before,after)=>before>0&&after<before?Math.round((before-after)/before*100):null;
export const effectCuts=(store,res)=>{const none=noRepair(store);return {friction:cut(none.friction,res.friction),nextWarn:cut(none.nextWarn,res.nextWarn)};};

export function createPlanView(root,store,{toast}){
  const $=s=>root.querySelector(s);
  // range: the one 보수 범위 state (scenario.stateResult) — level · 수면 아래 전체 재도장 · the plates put in by hand.
  // The drawing, 보수 물량 및 효과, 최종 보수 목록 and the outputs all compute from it; nothing else holds a plan
  const state={range:{level:DEFAULT_LEVEL,fullBelow:false,added:new Set()},side:'plate',sel:null,revealed:null,open:new Set(),dock:null,pop:null,
    unseen:false,flash:null};   // unseen: a plate put in since 최종 보수 목록 was last opened · flash: its row, until shown
  const slider=$('#rgSlider'),fullBelow=$('#rgFullBelow'),effBody=$('#paneEffect .pane-body'),sideBody=$('#paneSide .pane-body'),sideFoot=$('#paneSide .side-foot'),drawBody=$('#paneDraw .pane-body');
  const panels=setupPlanPanels(root);   // 보수 도면 maximize · the others fold (plan/layout.js)

  /* ---------- the plan being looked at ---------- */
  /* 보수 이력: a docking other than the current one is read only — what was repaired then */
  const history=()=>store.dockKey!=='current';
  /* the plan and its numbers, read from state.range each time: {plan, base, added, repaint, steel, …} (scenario.stateResult)
     · 보수 이력: the repairs done then (historyResult: {plan, …}) */
  const current=()=>history()?historyResult(store):stateResult(store,state.range);
  const basePlan=()=>history()?current().plan:current().base;
  /* a 보수 대상 the 판 정보 tab shows: in the plan (보수 계획: with a repair step) */
  const target=p=>!!p&&current().plan.has(p.id)&&(history()||clickable(p));
  /* a plate the user may put in or take out: 주의 이상 (a repair step), outside the range (never in 보수 이력) */
  const selectable=p=>!history()&&!!p&&clickable(p)&&!basePlan().has(p.id);
  const added=()=>history()?new Set():current().added;
  /* put a selectable plate in, or take it out again (popup, 판 정보 button, list checkbox) — the state only; render() recomputes */
  function toggle(id){
    if(!selectable(platesOf(store).byId.get(id)))return;
    const a=state.range.added;if(a.has(id))a.delete(id);else a.add(id);
  }
  /* a plate pressed on the drawing: a 보수 대상 → 판 정보 · a plate that may be put in (회색 점선) → the popup, 판 정보 stays */
  function pick(id,box){
    const p=platesOf(store).byId.get(id);
    if(target(p)){state.sel=id;state.side='plate';render();}
    else if(selectable(p))openPop(p,box);
  }
  /* most serious first: the lowest step, then the largest steel loss · 보수 이력: steel, then repaint, then local */
  const maxLoss=p=>p.records.reduce((m,r)=>Math.max(m,plateLoss(r)),0);
  const bySeverity=(a,b)=>a.step-b.step||maxLoss(b)-maxLoss(a);
  const byWork=(a,b)=>{const {plan}=current();return WORK_KINDS.indexOf(kindOf(plan.get(a.id)))-WORK_KINDS.indexOf(kindOf(plan.get(b.id)))||maxLoss(b)-maxLoss(a);};
  const mostSerious=()=>platesOf(store).plates.filter(target).sort(history()?byWork:bySeverity)[0]?.id??null;

  /* ---------- 보수 범위 설정: five points on a track; the orange thumb sits on the chosen one and can be dragged ---------- */
  slider.innerHTML='<div class="rg-track" aria-hidden="true"><i class="rg-fill"></i></div><i class="rg-thumb" aria-hidden="true"></i>'
    +LEVELS.map(l=>`<span class="rg-pt" data-level="${l.level}"><i class="rg-dot" aria-hidden="true"></i><b>${levelName(l)}</b><small>${l.sub.join('<br>')}</small></span>`).join('');
  const track=slider.querySelector('.rg-track'),fill=slider.querySelector('.rg-fill'),thumb=slider.querySelector('.rg-thumb');
  const posOf=level=>(level-1)/(LEVELS.length-1),levelAt=p=>Math.round(p*(LEVELS.length-1))+1;
  /* the thumb and the coloured track at p (0–1: a level, or between two while dragging) — the track runs from the first point's
     centre (10%) to the last's (90%); points passed white, the nearest one's name orange; the names and 설명 of the levels
     the range takes (up to the nearest) shown, the rest faded (0.2 s, style.css) */
  function placeThumb(p){
    thumb.style.left=`${10+p*80}%`;fill.style.clipPath=`inset(0 ${(1-p)*100}% 0 0)`;
    const near=levelAt(p);
    slider.querySelectorAll('.rg-pt').forEach(el=>{const n=+el.dataset.level;el.classList.toggle('sel',n===near);el.classList.toggle('on',posOf(n)<p-1e-6);
      el.classList.toggle('in',n<=near);});
  }
  function renderRange(){
    const {level}=state.range,lv=levelOf(level);
    placeThumb(posOf(level));
    slider.setAttribute('aria-valuenow',String(level));
    slider.setAttribute('aria-valuetext',`${lv.level}단계 ${levelName(lv)}`);
    fullBelow.checked=state.range.fullBelow;
  }
  /* a new level starts again from the range: the plates put in by hand are dropped */
  function setLevel(n){
    n=Math.min(LEVELS.length,Math.max(1,n));if(n===state.range.level)return;
    state.range.level=n;state.range.added=new Set();state.flash=null;render();
  }
  slider.addEventListener('click',e=>{const pt=e.target.closest('.rg-pt');if(pt){setLevel(+pt.dataset.level);slider.focus();}});
  slider.addEventListener('keydown',e=>{
    const {level}=state.range,n=e.key==='ArrowRight'||e.key==='ArrowUp'?level+1:e.key==='ArrowLeft'||e.key==='ArrowDown'?level-1
      :e.key==='Home'?1:e.key==='End'?LEVELS.length:null;
    if(n==null)return;e.preventDefault();setLevel(n);});
  // drag: the thumb follows the pointer along the track; let go → the nearest level (it slides there)
  let drag=null;
  const pAt=x=>{const b=track.getBoundingClientRect();return Math.min(1,Math.max(0,(x-b.left)/b.width));};
  thumb.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();thumb.setPointerCapture(e.pointerId);
    drag={p:posOf(state.range.level)};slider.classList.add('dragging');slider.focus();});
  thumb.addEventListener('pointermove',e=>{if(!drag)return;drag.p=pAt(e.clientX);placeThumb(drag.p);});
  const drop=()=>{if(!drag)return;const n=levelAt(drag.p);drag=null;slider.classList.remove('dragging');
    if(n!==state.range.level)setLevel(n);else renderRange();};
  thumb.addEventListener('pointerup',drop);thumb.addEventListener('pointercancel',drop);
  fullBelow.addEventListener('change',()=>{state.range.fullBelow=fullBelow.checked;render();});

  /* ---------- 보수 물량 및 효과: 2 × 2 — (N% 감소) against no repair, in the side text's colour
     (보수 이력: 강판 교체 · 재도장 · 마찰 저항 — no prediction for a docking already past) ---------- */
  /* a value that changed: out (0.1 s) then the new one in (0.15 s) — 동작 줄이기: at once. A change while it runs takes the latest */
  const EF_OUT=100,EF_IN=150,still=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  function swapValue(p,html){
    if(p.efHtml===html)return;p.efHtml=html;
    if(still()){p.getAnimations().forEach(a=>a.cancel());p.efOut=null;p.innerHTML=html;return;}
    if(p.efOut)return;   // already going out: shows p.efHtml when it is
    const from=+getComputedStyle(p).opacity;   // mid fade-in: out from where it is
    p.getAnimations().forEach(a=>a.cancel());
    const out=p.efOut=p.animate([{opacity:from},{opacity:0}],{duration:EF_OUT*from,easing:'ease-in',fill:'forwards'});
    out.onfinish=()=>{p.efOut=null;p.innerHTML=p.efHtml;out.cancel();p.animate([{opacity:0},{opacity:1}],{duration:EF_IN,easing:'ease-out'});};
  }
  function renderEffect(){
    const res=current();
    const steel=['강판 교체',`<b>${num(res.steelN)}</b><i>판</i><span class="ef-sub">· ${num(res.steel,1)} t</span>`];
    const paint=['재도장',`<b>${num(res.repaint)}</b><i>m²</i><span class="ef-sub">· 도료 ${num(res.paint)} L</span>`];
    const {nextWarn:warnCut,friction:frCut}=effectCuts(store,res);
    const friction=['마찰 저항',`<b>${num(res.friction,1)}</b><i>%</i>${frCut!=null?`<span class="ef-cmp">(${num(frCut)}% 감소)</span>`:''}`];
    const cells=history()?[steel,paint,friction]
      :[steel,paint,friction,['다음 도킹 경고 예상',`<b>${num(res.nextWarn)}</b><i>건</i>${warnCut!=null?`<span class="ef-cmp">(${num(warnCut)}% 감소)</span>`:''}`]];
    // the same cells (보수 계획 or 보수 이력 as before): only the values change, fading · otherwise built anew
    const ps=[...effBody.querySelectorAll('.ef-c p')],labels=[...effBody.querySelectorAll('.ef-c small')].map(s=>s.textContent);
    if(labels.join()===cells.map(c=>c[0]).join()){cells.forEach(([,html],i)=>swapValue(ps[i],html));return;}
    effBody.innerHTML=`<div class="ef">${cells.map(([label])=>`<div class="ef-c"><small>${label}</small><p></p></div>`).join('')}</div>`;
    effBody.querySelectorAll('.ef-c p').forEach((p,i)=>{p.efHtml=cells[i][1];p.innerHTML=cells[i][1];});
  }

  /* ---------- 보수 정보: 판 정보 | 최종 보수 목록 ---------- */
  function renderPlate(){
    const p=state.sel&&platesOf(store).byId.get(state.sel);
    sideFoot.hidden=true;
    if(!target(p)){sideBody.innerHTML='<p class="sp-none">도면이나 최종 보수 목록에서 판을 고르세요.</p>';return;}
    const head=`<div class="sp-h"><b>${p.id}</b><span>${plateWhere(p)}</span></div>`;
    // 보수 이력 too: the values found then (before the repair) and why the plate was in the range
    const why=p.step!=null?reasonText(p):{text:'정비 전·후 두께가 달라요.',action:workText(current().plan.get(p.id))},put=selectable(p);   // put: put in by hand
    sideBody.innerHTML=`<div class="sp">${head}${kv(p)}
      <div class="sp-box sp-why"><b>보수 대상인 이유</b><p>${why.text} → ${why.action}</p></div>
      ${put?'':'<p class="sp-fixed">보수 목록에 포함된 판</p>'}
    </div>`;
    // put in by hand: the exclude button at the panel's bottom · in the range: the grey note above (it cannot be taken out)
    if(put){sideFoot.innerHTML=`<button class="sp-inc" data-inc="${p.id}">보수 목록에서 제외</button>`;sideFoot.hidden=false;}
  }
  /* the plates in the plan: put in by hand (추가한 판, the NEW icon) first, then by the level that takes them in (its judgement icon)
     · 보수 이력: by the work done (its colour) */
  function listGroups(){
    const {plan}=current(),P=platesOf(store).plates.filter(target);
    if(history()){P.sort(byWork);
      return WORK_KINDS.map(k=>({key:k,name:KIND_LABEL[k],swatch:k,P:P.filter(p=>kindOf(plan.get(p.id))===k)})).filter(g=>g.P.length);}
    const base=basePlan();P.sort(bySeverity);
    const inBase=P.filter(p=>base.has(p.id)),at=new Map(inBase.map(p=>[p.id,entryLevel(store,p)]));
    return [{key:'hand',name:KIND_LABEL.added,hand:true,P:P.filter(p=>!base.has(p.id))},
      ...LEVELS.map(l=>({key:`L${l.level}`,name:l.group,grade:l.grade,P:inBase.filter(p=>at.get(p.id)===l.level)}))].filter(g=>g.P.length);
  }
  const groupIcon=g=>g.hand?NEW_ICON:g.swatch?`<i class="tl-sw sw-${g.swatch}" aria-hidden="true"></i>`:gradeIcon(g.grade);
  const rowWork=p=>history()?workText(current().plan.get(p.id)):stepInfo(p.step).action;
  function renderList(){
    sideFoot.hidden=true;
    const groups=listGroups(),keep=sideBody.querySelector('.tl')?.scrollTop||0,flash=state.flash;state.flash=null;
    // a new selection inside a folded part unfolds its group (a re-render alone keeps the folding)
    if(state.sel!==state.revealed){state.revealed=state.sel;
      for(const g of groups){const i=g.P.findIndex(p=>p.id===state.sel);if(i>=GROUP_SHOW)state.open.add(g.key);}}
    sideBody.innerHTML=groups.length?`<div class="tl">${groups.map(g=>{const unfolded=state.open.has(g.key);
      return `<section><h4>${groupIcon(g)}<b>${g.name}</b><span><span class="n">${num(g.P.length)}</span>판</span></h4><ul>${g.P.map((p,i)=>
        `<li class="tl-row${p.id===state.sel?' sel':''}${p.id===flash?' flash':''}" data-id="${p.id}" role="button" tabindex="0"${i>=GROUP_SHOW&&!unfolded?' hidden':''}>
          <b>${p.id}</b><span class="tl-loc">${locHtml(p)}</span><span class="tl-act">${rowWork(p)}</span>${g.hand?`<input type="checkbox" checked data-inc="${p.id}" aria-label="${p.id} 보수 목록에 포함">`:''}</li>`).join('')}
        ${g.P.length>GROUP_SHOW?`<li class="zg-more${unfolded?'':' down'}" data-key="${g.key}" role="button" tabindex="0" aria-expanded="${unfolded}"><span>${unfolded?'접기':`더 보기 (<span class="n">+${num(g.P.length-GROUP_SHOW)}</span>판)`}</span>${CHEV}</li>`:''}</ul></section>`;}).join('')}</div>`
      :`<p class="sp-none">${history()?'이 도킹에서 보수한 판이 없습니다.':'보수 대상 판이 없습니다.'}</p>`;
    const tl=sideBody.querySelector('.tl');if(tl)tl.scrollTop=keep;
    sideBody.querySelector('.tl-row.flash')?.scrollIntoView({block:'nearest'});   // the plate just put in: 1.5 s of light orange (style.css)
  }
  function renderSide(){
    if(state.side==='list'||!added().size)state.unseen=false;   // seen, or nothing put in any more
    root.querySelector('[data-side="list"]').innerHTML='최종 보수 목록'+(state.unseen?'<i class="tab-dot" aria-label="새로 추가한 판"></i>':'');
    const total=state.side==='list'?platesOf(store).plates.filter(target).length:null;
    $('#sideCount').hidden=total==null;if(total!=null)$('#sideCount').innerHTML=`총 <span class="n">${num(total)}</span>판`;
    root.querySelectorAll('[data-side]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.side===state.side)));
    if(state.side==='plate')renderPlate();else renderList();
  }
  root.querySelectorAll('[data-side]').forEach(b=>b.addEventListener('click',()=>{if(state.side!==b.dataset.side){state.side=b.dataset.side;renderSide();}}));
  /* the list: a row selects its plate and goes back to 판 정보 · 더 보기 / 접기 · 추가한 판 rows: the check ·
     판 정보: the exclude button (a plate taken out is no 보수 대상 any more: 판 정보 asks for another) */
  function act(el){
    const inc=el.closest('[data-inc]');if(inc){toggle(inc.dataset.inc);render();return;}
    const more=el.closest('.zg-more');
    if(more){const k=more.dataset.key;if(state.open.has(k))state.open.delete(k);else state.open.add(k);renderList();
      sideBody.querySelector(`.zg-more[data-key="${k}"]`)?.focus();return;}
    const row=el.closest('.tl-row');
    if(row){state.sel=row.dataset.id;state.side='plate';render();}
  }
  sideBody.addEventListener('click',e=>act(e.target));
  sideFoot.addEventListener('click',e=>act(e.target));
  sideBody.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.closest('.tl-row,.zg-more')){e.preventDefault();act(e.target);}});

  /* ---------- 보수 도면 (S.SHELL 전개도) ---------- */
  drawBody.innerHTML='<div class="rd-stage"><div class="rd-pop" role="dialog" aria-label="추가할 수 있는 판" hidden></div></div><div class="rd-legend" aria-label="범례"></div>';
  const stage=$('.rd-stage'),pop=$('.rd-pop'),legend=$('.rd-legend');
  const drawing=createRepairDrawing(stage,{onPick:pick});
  /* 보수 범위: the three works · 추가한 판 · 추가 가능: 주의 판 (보수 이력: 보수한 판 — the three works) */
  const sw=(k,t)=>`<span><i class="sw-${k}"></i>${t}</span>`,grp=t=>`<span class="lg-grp">${t}</span>`;
  const legendHtml=()=>history()?grp('보수한 판')+WORK_KINDS.map(k=>sw(k,KIND_LABEL[k])).join('')
    :grp('보수 범위')+WORK_KINDS.map(k=>sw(k,KIND_LABEL[k])).join('')+sw('added',KIND_LABEL.added)+grp('추가 가능')+sw('cand',KIND_LABEL.cand);
  const looks=()=>({plan:current().plan,added:added(),cands:!history()});
  function drawNow(){drawing.set({plates:platesOf(store).plates,...looks(),sel:state.sel,pickable:p=>target(p)||selectable(p)});}
  /* the popup of a plate that may be put in, beside it on the drawing (box: the plate on the canvas, px) */
  function openPop(p,box){
    state.pop=p.id;
    pop.innerHTML=`<div class="sp-h"><b>${p.id}</b><span>${plateWhere(p)}</span></div>${kv(p)}
      <p class="rd-pop-act"><span>예상 조치</span><b>${stepInfo(p.step).action}</b></p>
      <button class="sp-inc" data-add="${p.id}">보수 목록에 추가</button>`;
    pop.hidden=false;
    // right of the plate, or left when it would run out of the drawing; kept inside vertically
    const W=stage.clientWidth,H=stage.clientHeight,pw=pop.offsetWidth,ph=pop.offsetHeight,gap=8;
    const left=box.x+box.w+gap+pw<=W?box.x+box.w+gap:Math.max(gap,box.x-gap-pw);
    pop.style.left=`${left}px`;pop.style.top=`${Math.min(Math.max(gap,box.y+box.h/2-ph/2),H-ph-gap)}px`;
    pop.querySelector('button').focus();
  }
  function closePop(){if(state.pop==null)return;state.pop=null;pop.hidden=true;}
  pop.addEventListener('click',e=>{const b=e.target.closest('[data-add]');if(!b)return;
    const id=b.dataset.add;closePop();toggle(id);state.sel=id;state.side='plate';state.unseen=true;state.flash=id;render();});   // 주황 now, the 판 정보 shows it
  // outside the popup (a new press on a 회색 점선 plate opens its own) or Esc: close
  document.addEventListener('pointerdown',e=>{if(state.pop!=null&&!pop.contains(e.target))closePop();},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.pop!=null){e.preventDefault();closePop();}},true);   // before the maximize Esc (layout.js)

  /* ---------- the whole screen: 보수 계획 or 보수 이력 ---------- */
  /* the subtitle: what can still be put in */
  const anyToAdd=()=>platesOf(store).plates.some(p=>selectable(p)&&!current().plan.has(p.id));
  function syncMode(){
    const h=history();
    panels.setHistory(h);   // no 보수 범위 설정: 보수 도면 full height on the left
    if(!xlsxOut.busy)xlsxBtn.textContent=xlsxOut.label();   // 자재 발주 목록 · 보수 이력: 자재 사용 내역
    legend.innerHTML=legendHtml();
  }
  function render(){
    closePop();
    if(!history())renderRange();renderEffect();renderSide();drawNow();
    $('#drawSub').textContent=history()?HISTORY_BASIS
      :anyToAdd()?'회색 점선 테두리 판을 선택하여 보수 목록에 추가하세요':'더 이상 추가 가능한 판이 없어요';
  }

  /* ---------- outputs (header buttons, outside this screen's root, shown only on 보수 계획: body.view-plan):
     the file handle first (user gesture), then the module and the file.
     The state at the press, copied (later changes do not reach a file being made) — output.js computes the plan from it again ---------- */
  const snapshot=()=>{const h=history(),{level,fullBelow,added:a}=state.range;
    return {store,history:h,docTitle:h?'자재 사용 내역':'자재 발주 목록',range:{level,fullBelow,added:new Set(a)}};};
  /* label · file · what may be functions (the Excel: 자재 발주 목록 or, 보수 이력, 자재 사용 내역) */
  const val=v=>typeof v==='function'?v():v;
  function output(button,{label,busyText,file,type,make,what}){
    const o={busy:false,label:()=>val(label)};
    button.addEventListener('click',async()=>{
      if(o.busy)return;
      const now=new Date(),name=`${val(file)}_${SHIP.hull}_${ymd(now)}.${type.ext}`,snap=snapshot();
      const handle=await pickHandle(name,type.picker);if(handle===ABORT)return;
      o.busy=true;button.textContent=busyText;button.setAttribute('aria-busy','true');let stage='make',w=val(what);
      try{const mod=await import('./output.js'),blob=await mod[make](snap,now);stage='save';
        toast(`${w}을 저장했습니다·${await saveBlob(handle,blob,name)}`,4000);}
      catch(e){console.error(`[DR.DOCK] ${w} ${stage==='make'?'생성':'저장'} 실패`,e);
        toast(`${w}을 ${stage==='make'?'만들지':'저장하지'} 못했습니다·${shortError(e)}`,8000);}
      finally{o.busy=false;button.textContent=o.label();button.setAttribute('aria-busy','false');}
    });
    return o;
  }
  const xlsxBtn=document.getElementById('xlsxBtn');
  const xlsxOut=output(xlsxBtn,{label:()=>history()?'자재 사용 내역(Excel)':'자재 발주 목록(Excel)',busyText:'Excel 만드는 중…',
    file:()=>history()?'DR.DOCK_MaterialUsage':'DR.DOCK_MaterialList',make:'materialsXlsx',what:()=>history()?'자재 사용 내역':'자재 발주 목록',
    type:{ext:'xlsx',picker:{description:'Excel 통합 문서',accept:{'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':['.xlsx']}}}});
  output(document.getElementById('planPdfBtn'),{label:'보수 도면(PDF)',busyText:'보수 도면 만드는 중…',file:'DR.DOCK_RepairPlan',make:'repairPlanPdf',what:'보수 도면',
    type:{ext:'pdf',picker:{description:'PDF 문서',accept:{'application/pdf':['.pdf']}}}});

  return {
    get state(){return state;},
    /* the screen was opened, or its docking's data changed while open: a new docking drops the plates put in by hand
       (and switches 보수 계획 ↔ 보수 이력). No 보수 대상 selected (first opening, a new docking) → the most serious one */
    refresh(){
      if(state.dock!==store.dockKey){state.dock=store.dockKey;state.range.added=new Set();state.sel=null;state.open.clear();state.side='plate';}
      syncMode();
      if(!target(platesOf(store).byId.get(state.sel)))state.sel=mostSerious();
      render();
    }
  };
}
