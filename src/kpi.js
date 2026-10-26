/* =========================================================
   KPI 패널 (SPEC 5.3, private/KPI_시안_v3.png): 현재 레이어 기준 요약 + 보수 구역 우선순위 목록.
   요약 타일: 측정 진행률 → 최우선 보수(복합) → 심각 → 주의 (2×2). 판정은 타일 배경색으로만 구분한다.
   목록 위: 얇은 구분선 + "보수 대상 N건"(현재 레이어).
   항목: 순위 | 1줄 위치(전체 폭, 넘치면 … · 마우스를 올리면 전체) | 2줄 판정 칩 + 도막+강판 태그, 3줄 권장 조치
         | 2~3줄 오른쪽 감소량(구역에서 가장 나쁜 점) + "이전 대비" (도막 손상은 손상 면적 + "손상 면적").
   기본 선택: 매핑 완료 상태(첫 화면, 매핑이 끝났을 때, 완료 상태에서 레이어를 바꿨을 때)에는 1위 구역의 가장 나쁜 점을
   자동으로 선택한다 (카메라는 그대로). 재매핑하면 선택을 해제한다.
   레이어 전환·매핑 진행에 따라 갱신되고, 항목을 누르면 구역에서 가장 나쁜 점이 선택된다.
   ========================================================= */
import { FS, STRAKE_W } from './hull.js';
import { CRIT, WARN } from './data/criteria.js';
import { LEVEL_LABEL, THICK, dropNum, areaNum, zoneLoc, num, progress } from './format.js';
import { groupZones } from './data/zones.js';
import { SAMPLE_EVERY } from './data/scanPath.js';
import { emptyState, mappingState } from './emptyState.js';

const AREA_PER_POINT=SAMPLE_EVERY*FS*STRAKE_W;   // 측정점 하나가 대표하는 외판 면적 (m²)
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* 오른쪽 큰 값과 그 아래 작은 설명: 이전 도킹 대비 감소량 (도막 µm, 강판 mm) · 도막 손상은 손상 면적
   (현재 / 기준값은 상세 패널 수치 카드에 있으므로 목록에는 넣지 않는다) */
function valueParts(r,layer){
  if(layer==='defect')return {v:areaNum(r.defectArea),u:'m²',sub:'손상 면적'};
  const [prev,cur]=layer==='plate'?[r.platePrev,r.plate]:[r.dftPrev,r.dft];
  return {v:dropNum(prev,cur,layer),u:THICK[layer].unit,sub:'이전 대비'};
}

export function createKpiPanel(root,store,ui){
  root.innerHTML=`<div class="kpi">
    <div class="kpi-sum">
      <div class="tile t-prog"><span class="k">측정 진행률</span><span class="n"><b data-k="prog">0%</b></span>
        <span class="bar" role="progressbar" aria-label="측정 진행률" aria-valuemin="0" aria-valuemax="100"><i></i></span><small data-k="progSub"></small></div>
      <div class="tile t-top"><span class="k">최우선 보수</span><span class="n"><b data-k="top">0</b><i>구역</i></span><small>도막·강판 복합</small></div>
      <div class="tile t-crit"><span class="k">심각</span><span class="n"><b data-k="crit">0</b><i>구역</i></span></div>
      <div class="tile t-warn"><span class="k">주의</span><span class="n"><b data-k="warn">0</b><i>구역</i></span></div>
    </div>
    <div class="kpi-sub"><b>보수 대상 <span data-k="count">0</span>건</b></div>
    <ol class="kpi-list" aria-label="보수 구역 우선순위"></ol>
  </div>`;
  const $k=k=>root.querySelector(`[data-k="${k}"]`),list=root.querySelector('.kpi-list');
  const bar=root.querySelector('.bar');
  const measurable=store.plan.samples.filter(s=>!s.blocked).length,totalArea=areaNum(measurable*AREA_PER_POINT);
  let zones=[],timer=null,lastHtml='';

  function render(){
    const layer=ui.layer,R=store.records;
    zones=groupZones(R,layer);
    // same progress as the header and the mapping notice (robot path); the measured area comes from the points
    const prog=progress(store.progress);
    $k('prog').textContent=prog;bar.firstChild.style.width=prog;bar.setAttribute('aria-valuenow',parseInt(prog,10));
    $k('progSub').textContent=`≈ ${areaNum(R.length*AREA_PER_POINT)} / ${totalArea} m²`;
    $k('top').textContent=zones.filter(z=>z.compound).length;
    $k('crit').textContent=zones.filter(z=>z.level===CRIT).length;
    $k('warn').textContent=zones.filter(z=>z.level===WARN).length;
    $k('count').textContent=num(zones.length);
    // nothing to list: the shared notice (mapping / paused), or after a finished run with nothing abnormal
    const empty=zones.length?null:mappingState(store,'보수 대상')||emptyState('탐지된 이상이 없습니다');
    list.classList.toggle('is-empty',!!empty);
    const html=empty?`<li class="kpi-empty">${empty}</li>`
      :zones.map((z,i)=>{
      const r=z.worst,v=valueParts(r,layer),where=esc(zoneLoc(z));
      return `<li class="z lvl${z.level}" data-id="${r.id}" tabindex="0" role="button" aria-label="${i+1}순위 ${where} ${LEVEL_LABEL[z.level]}${z.compound?' 도막+강판':''} ${esc(z.action)} ${v.sub} ${v.v} ${v.u}">
        <span class="rk">${i+1}</span>
        <div class="zb">
          <div class="zl" title="${where}">${where}</div>
          <div class="zr">
            <div class="zi">
              <div class="zm"><span class="lv lv${z.level}">${LEVEL_LABEL[z.level]}</span>${z.compound?'<span class="cx">도막+강판</span>':''}</div>
              <div class="act">→ ${esc(z.action)}</div>
            </div>
            <div class="zv"><div class="dv"><b>${esc(v.v)}</b><i>${v.u}</i></div><span>${v.sub}</span></div>
          </div>
        </div></li>`;}).join('');
    if(html!==lastHtml){list.innerHTML=html;lastHtml=html;}   // unchanged while mapping finds nothing new: keep the DOM (hover, clicks)
    syncSel(false);
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
  function syncSel(scroll){
    list.querySelectorAll('.z').forEach((el,i)=>{const on=!!zones[i]&&zones[i].ids.has(ui.selId);el.classList.toggle('sel',on);
      if(on&&scroll)el.scrollIntoView({block:'nearest'});});
  }
  const pick=el=>{const li=el.closest('.z');if(li)ui.select(+li.dataset.id,{fly:true});};
  list.addEventListener('pointerdown',e=>{if(e.button===0)pick(e.target);});
  list.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick(e.target);}});

  // mapping start/stop: redraw at once; the stream of new measurements while mapping: throttled
  // pose: the progress tile and the mapping notice follow the robot
  store.subscribe(k=>{if(k.has('state')){clearTimeout(timer);timer=null;render();onState();}else if(k.has('records')||k.has('pose'))schedule();});
  ui.subscribe((k,o)=>{
    if(k==='layer'){render();list.scrollTop=0;if(store.mapState==='done')selectTop();else syncSel(false);}
    if(k==='select')syncSel(!(o&&o.auto));});
  render();
  if(store.mapState==='done')selectTop();
}
