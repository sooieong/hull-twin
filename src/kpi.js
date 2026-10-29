/* =========================================================
   KPI 핵심 지표 패널 + 보수 목록 패널 (SPEC 5.3, private/보수목록_새UI.png): 현재 레이어 기준 요약 타일과 보수 구역 목록.
   요약: 카드 하나를 얇은 세로선으로 3칸 — 최우선 보수 · 경고 · 주의. 세 숫자는 겹치지 않는다 (criteria.gradeOf). 측정 진행률은 헤더에만.
     칸마다 윗줄 판정 아이콘(24px)과 회색 이름을 한 묶음으로 칸 가운데, 아랫줄 숫자 + "건"도 칸 가운데.
     묶음은 칸보다 넓어지지 않는다 (긴 이름은 줄바꿈). 숫자는 세 칸 모두 흰색 굵게.
   목록 패널 헤더: 제목 옆 "총 N건"(현재 레이어).
   목록: 판정별 그룹(최우선 보수 → 경고 → 주의). 그룹마다 위에서 GROUP_SHOW(3)개만 보이고, 넘으면 마지막 항목 아래
     "더 보기 (+N건) ⌄" 줄로 나머지를 펼친다 (펼치면 "접기 ⌃"). 선택한 구역이 접힌 부분에 있으면 그 그룹을 펼친다
     (목록·3D·외판 전개도 어디서 골라도). 그룹 제목 줄 = 아이콘·이름·건수, 건수 옆 작은 ! 버튼 — 올리거나 누르면
     그 그룹의 권장 조치(가장 많은 조치)를 팝오버로 ("권장 조치: …").
     항목은 한 줄(약 32px): 순위(작은 회색) · 위치(프레임 번호만 흰색 굵게, 나머지 회색) · 수치(오른쪽 정렬, 판정색, 고정폭 숫자).
     그룹 조치와 다른 항목만 수치 앞에 회색 태그로 조치를 붙인다. 수치의 뜻은 패널 헤더 건수 옆 ? 팝오버 (VALUE_NOTE).
   기본 선택: 매핑 완료 상태(첫 화면, 매핑이 끝났을 때, 완료 상태에서 레이어를 바꿨을 때)에는 1위 구역의 가장 나쁜 점을
   자동으로 선택한다 (카메라는 그대로). 재매핑하면 선택을 해제한다.
   레이어 전환·매핑 진행에 따라 갱신되고, 항목을 누르면 구역에서 가장 나쁜 점이 선택된다.
   ========================================================= */
import { CRIT, WARN, TOP, gradeName, gradeOf } from './data/criteria.js';
import { refDropPctNum, dropHtml, areaNum, zoneLoc, num } from './format.js';
import { zonesOf, groupAction } from './data/zones.js';
import { gradeIcon } from './gradeUi.js';
import { emptyState, mappingState } from './emptyState.js';
import { CHEV } from './panels.js';

const GROUP_SHOW=3;   // items shown per group before "더 보기"

const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* 오른쪽 수치: 원두께(도막은 설계) 대비 감소율 % — 판정 기준과 같은 기준이라 순위·판정·숫자가 맞는다. 도막 손상은 손상 면적.
   (실제 두께는 상세 패널에 있다) · 수치의 뜻은 목록 맨 아래에 한 번 */
function valueParts(r,layer){
  if(layer==='defect')return {v:areaNum(r.defectArea),u:'m²'};
  return {v:refDropPctNum(r,layer),u:'%'};
}
export const VALUE_NOTE={dft:'수치: 설계 대비 감소율',plate:'수치: 원두께 대비 감소율',defect:'수치: 손상 면적(m²)'};   // ? popover in the list header (main.js)

/* tilesRoot: KPI 핵심 지표 패널 본문 · listRoot: 보수 대상 패널 본문 · countEl: 보수 대상 패널 헤더의 "총 N건" */
export function createKpiPanel(tilesRoot,listRoot,countEl,store,ui){
  const cell=(cls,g,key)=>`<div class="kc ${cls}"><div class="kc-h"><span class="kc-name">${gradeIcon(g)}<span data-g="${g}"></span></span></div><div class="kc-n"><b data-k="${key}">0</b><i>건</i></div></div>`;
  tilesRoot.innerHTML=`<div class="kpi-card">${cell('t-top',TOP,'top')}${cell('t-crit',CRIT,'crit')}${cell('t-warn',WARN,'warn')}</div>`;
  listRoot.innerHTML='<ol class="kpi-list" aria-label="보수 목록"></ol>';
  const $k=k=>tilesRoot.querySelector(`[data-k="${k}"]`),list=listRoot.querySelector('.kpi-list');
  let zones=[],timer=null,lastHtml='';
  const open=new Set();   // unfolded groups, per layer: 'dft:3' …

  function render(){
    const layer=ui.layer;
    zones=zonesOf(store,layer);
    tilesRoot.querySelectorAll('[data-g]').forEach(el=>{el.textContent=gradeName(+el.dataset.g,layer);});   // 도막 손상: 최우선 보수 / 도막 떨어짐 / 스크래치   // 최우선 보수 → 경고 → 주의, 각 안에서 수치 큰 순 (zones.js)
    const grades=zones.map(z=>gradeOf(z.level,z.top));
    $k('top').textContent=zones.filter(z=>z.top).length;
    $k('crit').textContent=grades.filter(g=>g===CRIT).length;
    $k('warn').textContent=grades.filter(g=>g===WARN).length;
    countEl.innerHTML=`총 <span class="n">${num(zones.length)}</span>건`;
    // nothing to list: the shared notice (mapping / paused), or after a finished run with nothing abnormal
    const empty=zones.length?null:mappingState(store,'보수 대상')||emptyState('탐지된 이상이 없습니다');
    list.classList.toggle('is-empty',!!empty);
    let html='';
    if(empty)html=`<li class="kpi-empty">${empty}</li>`;
    else{
      // zones come grouped already (최우선 보수 → 경고 → 주의); the rank runs on across the groups
      let i=0;
      for(const g of [TOP,CRIT,WARN]){
        const items=zones.filter(z=>gradeOf(z.level,z.top)===g);if(!items.length)continue;
        const act=groupAction(items),name=gradeName(g,layer),key=`${layer}:${g}`,unfolded=open.has(key);
        html+=`<li class="zg-head g${g}"><span class="zgi">${gradeIcon(g)}</span><b>${name}</b><span class="zg-n"><span class="n">${num(items.length)}</span>건</span>`
          +`<button class="help-btn sm act-btn" data-g="${g}" data-act="${esc(act)}" aria-expanded="false" aria-controls="actPop" aria-label="${name} 권장 조치">!</button></li>`;
        items.forEach((z,n)=>{
          const v=valueParts(z.worst,layer),[fr,...rest]=zoneLoc(z).split('·'),where=esc(zoneLoc(z)),own=z.action!==act;
          html+=`<li class="z lvl${Math.min(g,CRIT)}" data-id="${z.worst.id}" data-key="${key}"${n>=GROUP_SHOW&&!unfolded?' hidden':''} tabindex="0" role="button" aria-label="${++i}순위 ${where} ${name} ${esc(z.action)} ${v.v}${v.u}">
            <span class="rk">${i}</span><span class="zl" title="${where}"><b>${esc(fr)}</b>·${esc(rest.join('·'))}</span>
            ${own?`<span class="ztag">${esc(z.action)}</span>`:''}<span class="dv">${dropHtml(v.v,v.u)}</span></li>`;
        });
        if(items.length>GROUP_SHOW)html+=`<li class="zg-more${unfolded?'':' down'}" data-key="${key}" role="button" tabindex="0" aria-expanded="${unfolded}">`
          +`<span>${unfolded?'접기':`더 보기 (<span class="n">+${num(items.length-GROUP_SHOW)}</span>건)`}</span>${CHEV}</li>`;   // one text item in the flex row
      }
    }
    if(html!==lastHtml){list.innerHTML=html;lastHtml=html;if(actFor!==null)openAct(actBtn(actFor),actPinned);}   // unchanged while mapping finds nothing new: keep the DOM (hover, clicks)
    syncSel(false,false);
  }
  function schedule(){if(timer)return;timer=setTimeout(()=>{timer=null;render();},250);}
  /* default selection: rank 1 (or nothing) — {auto} so no panel scrolls the page or moves the camera */
  const selectTop=()=>ui.select(zones.length?zones[0].worst.id:null,{auto:true});
  let prevState=store.mapState;
  function onState(){
    const s=store.mapState,p=prevState;prevState=s;
    if(s==='mapping'&&p!=='mapping'&&p!=='paused')ui.select(null,{auto:true});   // fresh run (resume comes from 'paused')
    else if(s==='done'&&p!=='done')selectTop();
  }
  /* reveal: a new selection inside a folded part unfolds its group (a re-render alone keeps the user's folding) */
  function syncSel(scroll,reveal=true){
    let target=null;
    list.querySelectorAll('.z').forEach((el,i)=>{const on=!!zones[i]&&zones[i].ids.has(ui.selId);el.classList.toggle('sel',on);if(on)target=el;});
    if(target&&target.hidden&&reveal){open.add(target.dataset.key);render();target=list.querySelector('.z.sel');}
    if(target&&scroll&&!target.hidden)target.scrollIntoView({block:'nearest'});
  }
  function toggleGroup(key,focus){
    if(open.has(key))open.delete(key);else open.add(key);
    render();if(focus){const b=list.querySelector(`.zg-more[data-key="${key}"]`);if(b)b.focus();}
  }
  const pick=el=>{const li=el.closest('.z');if(li)ui.select(+li.dataset.id,{fly:true});};
  list.addEventListener('pointerdown',e=>{if(e.button===0)pick(e.target);});
  list.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('.act-btn')){e.preventDefault();
    const more=e.target.closest('.zg-more');if(more)toggleGroup(more.dataset.key,true);else pick(e.target);}});
  list.addEventListener('click',e=>{const more=e.target.closest('.zg-more');if(more)toggleGroup(more.dataset.key,false);});

  /* group action popover: the ! next to a group's count — shown while hovered, or pinned open by a click
     (another click, an outside press, Esc or scrolling the list closes it). Follows its group across re-renders. */
  const actPop=document.getElementById('actPop'),actTxt=document.getElementById('actTxt');
  let actFor=null,actPinned=false;   // grade of the group whose action is open
  const actBtn=g=>list.querySelector(`.act-btn[data-g="${g}"]`);
  function openAct(btn,pin){
    if(!btn){closeAct();return;}
    list.querySelectorAll('.act-btn[aria-expanded="true"]').forEach(b=>{if(b!==btn)b.setAttribute('aria-expanded','false');});
    actFor=btn.dataset.g;actPinned=pin;btn.setAttribute('aria-expanded','true');
    actTxt.textContent=`권장 조치: ${btn.dataset.act}`;actPop.hidden=false;
    const b=btn.getBoundingClientRect(),h=actPop.offsetHeight;   // below the button, above it when there is no room
    actPop.style.left=Math.max(8,Math.min(b.left-12,innerWidth-actPop.offsetWidth-8))+'px';
    actPop.style.top=(b.bottom+8+h>innerHeight-8?b.top-8-h:b.bottom+8)+'px';
  }
  function closeAct(){
    if(actFor===null)return;
    const b=actBtn(actFor);if(b)b.setAttribute('aria-expanded','false');
    actFor=null;actPinned=false;actPop.hidden=true;
  }
  list.addEventListener('mouseover',e=>{const b=e.target.closest('.act-btn');if(b&&!actPinned)openAct(b,false);});
  list.addEventListener('mouseout',e=>{const b=e.target.closest('.act-btn');if(b&&!actPinned&&!b.contains(e.relatedTarget))closeAct();});
  list.addEventListener('click',e=>{const b=e.target.closest('.act-btn');if(!b)return;
    if(actPinned&&actFor===b.dataset.g)closeAct();else openAct(b,true);});
  list.addEventListener('scroll',closeAct,{passive:true});
  document.addEventListener('pointerdown',e=>{if(actPinned&&!e.target.closest('#actPop,.act-btn'))closeAct();});
  // capture + handled: Esc closes only the popover (a maximized panel stays maximized)
  window.addEventListener('keydown',e=>{if(e.key!=='Escape'||actFor===null)return;
    const b=actBtn(actFor),pinned=actPinned;closeAct();if(b&&pinned)b.focus();e.preventDefault();},true);

  // mapping start/stop: redraw at once; the stream of new measurements while mapping: throttled
  store.subscribe(k=>{if(k.has('state')){clearTimeout(timer);timer=null;render();onState();}else if(k.has('records'))schedule();});
  ui.subscribe((k,o)=>{
    if(k==='layer'){render();list.scrollTop=0;if(store.mapState==='done')selectTop();else syncSel(false,false);}
    if(k==='select')syncSel(!(o&&o.auto));});
  render();
  if(store.mapState==='done')selectTop();
}
