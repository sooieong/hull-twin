/* =========================================================
   KPI 패널 (SPEC 5.3): 현재 레이어 기준 요약 + 보수 구역 우선순위 목록.
   레이어 전환·매핑 진행에 따라 갱신되고, 항목을 누르면 구역에서 가장 나쁜 점이 선택된다.
   ========================================================= */
import { FS, STRAKE_W } from './hull.js';
import { CRIT, WARN, LAYER_LABEL, LEVEL_LABEL, DEFECT_LABEL, dftRatio, plateLoss } from './data/criteria.js';
import { groupZones } from './data/zones.js';
import { SAMPLE_EVERY } from './data/scanPath.js';

const AREA_PER_POINT=SAMPLE_EVERY*FS*STRAKE_W;   // 측정점 하나가 대표하는 외판 면적 (m²)
const SIDE={S:'우현',P:'좌현',PS:'좌우현'};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* 큰 숫자 + 단위 + 기준값/비율 */
function valueParts(r,layer){
  if(layer==='dft')return {v:r.dft,u:'µm',ref:`/ ${r.dftDesign} · ${Math.round(dftRatio(r)*100)}%`};
  if(layer==='plate')return {v:r.plate.toFixed(1),u:'mm',ref:`/ ${r.plateOrig.toFixed(1)} · −${(plateLoss(r)*100).toFixed(1)}%`};
  return {v:r.defectArea,u:'m²',ref:DEFECT_LABEL[r.defect]||''};
}

export function createKpiPanel(root,store,ui){
  root.innerHTML=`<div class="kpi">
    <div class="kpi-sum">
      <div class="tile t-crit"><span class="k">심각</span><span class="n"><b data-k="crit">0</b><i>구역</i></span><small data-k="critPts"></small></div>
      <div class="tile t-warn"><span class="k">주의</span><span class="n"><b data-k="warn">0</b><i>구역</i></span><small data-k="warnPts"></small></div>
      <div class="tile"><span class="k">측정 진행률</span><span class="n"><b data-k="prog">0</b><i>%</i></span><small data-k="progSub"></small></div>
      <div class="tile t-top"><span class="k">최우선 보수</span><span class="n"><b data-k="top">0</b><i>구역</i></span><small>도막·강판 복합</small></div>
    </div>
    <div class="kpi-head"><span class="ttl">보수 우선순위</span><span class="lay" data-k="layer"></span><span class="cnt" data-k="count"></span></div>
    <ol class="kpi-list" aria-label="보수 구역 우선순위"></ol>
  </div>`;
  const $k=k=>root.querySelector(`[data-k="${k}"]`),list=root.querySelector('.kpi-list');
  const measurable=store.plan.samples.filter(s=>!s.blocked).length;
  let zones=[],timer=null;

  function render(){
    const layer=ui.layer,R=store.records;
    zones=groupZones(R,layer);
    const pts=[0,0,0];zones.forEach(z=>pts[z.level]+=z.count);
    $k('crit').textContent=zones.filter(z=>z.level===CRIT).length;$k('critPts').textContent=`측정점 ${pts[CRIT]}`;
    $k('warn').textContent=zones.filter(z=>z.level===WARN).length;$k('warnPts').textContent=`측정점 ${pts[WARN]}`;
    $k('prog').textContent=Math.floor(R.length/measurable*100);
    $k('progSub').textContent=`≈ ${Math.round(R.length*AREA_PER_POINT).toLocaleString()} m²`;
    $k('top').textContent=zones.filter(z=>z.compound).length;
    $k('layer').textContent=LAYER_LABEL[layer];$k('count').textContent=`${zones.length}구역`;
    if(!zones.length){
      list.innerHTML=`<li class="empty">${store.mapState==='mapping'?'아직 발견된 이상 구역이 없습니다':'이상 구역이 없습니다'}</li>`;return;}
    list.innerHTML=zones.map((z,i)=>{
      const r=z.worst,v=valueParts(r,layer);
      const fr=z.frMin===z.frMax?`FR ${z.frMin}`:`FR ${z.frMin}–${z.frMax}`;
      const st=z.strakeMin===z.strakeMax?z.strakeMin:`${z.strakeMin}–${z.strakeMax}`;
      return `<li class="z lvl${z.level}${z.ids.has(ui.selId)?' sel':''}" data-id="${r.id}" tabindex="0" role="button" aria-label="${i+1}순위 ${fr} ${st} ${SIDE[z.side]} ${LEVEL_LABEL[z.level]}">
        <span class="rk">${i+1}</span>
        <div class="zb">
          <div class="zl"><b>${fr}</b><span>${st} · ${SIDE[z.side]}</span><span class="lv lv${z.level}">${LEVEL_LABEL[z.level]}</span></div>
          <div class="zv"><b>${esc(v.v)}</b><i>${v.u}</i><span>${esc(v.ref)}</span></div>
          <div class="zm"><span>${esc(z.zone)} · ${z.count}점</span>${z.compound?'<span class="cx">복합</span>':''}<span class="act">${esc(z.action)}</span></div>
        </div></li>`;}).join('');
  }
  function schedule(){if(timer)return;timer=setTimeout(()=>{timer=null;render();},250);}
  function syncSel(scroll){
    list.querySelectorAll('.z').forEach((el,i)=>{const on=!!zones[i]&&zones[i].ids.has(ui.selId);el.classList.toggle('sel',on);
      if(on&&scroll)el.scrollIntoView({block:'nearest'});});
  }
  const pick=el=>{const li=el.closest('.z');if(li)ui.select(+li.dataset.id);};
  list.addEventListener('click',e=>pick(e.target));
  list.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick(e.target);}});

  store.subscribe(k=>{if(k.has('records')||k.has('state'))schedule();});
  ui.subscribe(k=>{if(k==='layer'){render();list.scrollTop=0;syncSel(true);}if(k==='select')syncSel(true);});
  render();
}
