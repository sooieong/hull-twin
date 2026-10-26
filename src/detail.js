/* =========================================================
   보조 시각화 2: 상세 (SPEC 5.2, 10.5, 10.6) — 선택한 측정점에 따라 바뀐다.
   매핑 중(중지 포함)에 고른 지점이 없으면 가장 최근에 측정된 이상 지점(현재 레이어 기준)을 자동으로 보여준다.
   사용자가 지점을 고르면 그 지점을 계속 보여준다.
   위치·판정 정보는 KPI 목록에 있으므로 여기에는 그림과 수치 카드만 둔다. 어떤 지점인지는 패널 헤더에 작게 표시한다.
   - 도막 두께 · 강판 두께: 단면 비교 그림 (private/두께비교_예시.png 구성)이 남는 높이를 채운다.
     이전 도킹 두께 = 점선, 현재 = 실선, 기준값(원두께·설계) = 가는 회색 선, 아래 치수선, 오른쪽 감소량, 아래 수치 카드 4칸
   - 도막 손상: 실제 손상 사진을 잘리지 않게 전체 표시(contain), 누르면 라이트박스. 사진이 없으면 "사진 없음" (가짜 이미지는 만들지 않는다)
   ========================================================= */
import { judge, isCompound, actionFor, LEVEL_LABEL, DEFECT_LABEL } from './data/criteria.js';
import { ZONES, ZONE_LABELS } from './hull.js';
import { thickness, sectionSvg, THEME } from './sectionSvg.js';

const LV_COLOR=THEME.dark.level;   // 정상 · 주의 · 심각 (히트맵 계열, UI 오렌지와 구분)
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const zoneLabel=z=>ZONE_LABELS[ZONES.indexOf(z)]||z;

const ICON_PHOTO='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3l2-2.5h6L17 7h3v12H4z"/><circle cx="12" cy="13" r="3.5"/><path d="M3 3l18 18"/></svg>';
const ICON_OK='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="m8 12.3 2.7 2.7 5.3-5.6"/></svg>';
const ICON_PICK='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>';
const state=(icon,t,s)=>`<div class="dt-state">${icon}<b>${t}</b>${s?`<span>${s}</span>`:''}</div>`;

/* photo lightbox: closes on the backdrop, the close button or Esc */
function createLightbox(){
  const lb=document.createElement('div');lb.className='lightbox';lb.hidden=true;
  lb.setAttribute('role','dialog');lb.setAttribute('aria-modal','true');lb.setAttribute('aria-label','손상 사진 크게 보기');
  lb.innerHTML='<figure><img alt=""><figcaption></figcaption></figure><button class="lb-close" aria-label="닫기" title="닫기">×</button>';
  document.body.appendChild(lb);
  let opener=null;
  const close=()=>{if(lb.hidden)return;lb.hidden=true;if(opener)opener.focus();};
  lb.addEventListener('click',e=>{if(e.target===lb||e.target.closest('.lb-close'))close();});
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!lb.hidden){close();e.preventDefault();}},true);
  return {open(src,alt,caption,from){const img=lb.querySelector('img');img.src=src;img.alt=alt;lb.querySelector('figcaption').textContent=caption;
    opener=from;lb.hidden=false;lb.querySelector('.lb-close').focus();}};
}

export function createDetailPanel(body,store,ui,subEl){
  let timer=null;const lightbox=createLightbox();
  function cards(list,level){
    // numbers in the mono face, words (종류, 판정, 조치) in the UI face so they can wrap
    return `<div class="dt-cards">${list.map(([k,v,hl])=>`<div class="dt-card"><span>${esc(k)}</span><b class="${/^[\d—]/.test(String(v))?'':'tx'}"${hl?` style="color:${LV_COLOR[level]}"`:''}>${esc(v)}</b></div>`).join('')}</div>`;
  }
  const mapping=()=>store.mapState==='mapping'||store.mapState==='paused';
  /* latest abnormal measurement of the layer (records are kept in arrival order) */
  function latestAbnormal(layer){
    const R=store.records;
    for(let i=R.length-1;i>=0;i--)if(judge(R[i],layer).level>0)return R[i];
    return null;
  }
  /* the record shown: the user's pick, or while mapping with no pick, the latest abnormal one */
  const shownRecord=()=>ui.selId!=null?store.get(ui.selId)||null:mapping()?latestAbnormal(ui.layer):null;
  let last=null;   // {r,layer,mode}: skip identical redraws so the photo/figure does not flicker during mapping
  function render(){
    const layer=ui.layer,r=shownRecord(),auto=ui.selId==null&&!!r;
    const mode=r?'r':ui.selId!=null&&mapping()?'pending':'empty';
    if(last&&last.r===r&&last.layer===layer&&last.mode===mode)return;
    last={r,layer,mode};
    subEl.textContent=r?`FR ${r.fr} · ${r.strake}(${r.side})${auto?' · 최근 이상':''}`:'';
    if(!r){body.innerHTML=mode==='pending'
      ?state(ICON_PICK,'아직 측정되지 않은 지점입니다','로봇이 지나가면 이 지점의 값이 표시됩니다')
      :state(ICON_PICK,'보수 우선순위 목록에서 지점을 선택하세요');return;}
    const {level}=judge(r,layer),action=actionFor(r,layer,level,isCompound(r));
    if(layer==='defect'){
      const has=!!r.defect,caption=has?`${DEFECT_LABEL[r.defect]} · ${r.defectArea} m² · FR ${r.fr} 외판열 ${r.strake}(${r.side}) · ${zoneLabel(r.zone)}`:'';
      const media=!has?state(ICON_OK,'손상 없음','이 지점에서 발견된 도막 손상이 없습니다')
        :r.photo?`<button class="dt-img" title="크게 보기" aria-label="사진 크게 보기"><img src="${esc(r.photo)}" alt="${esc(DEFECT_LABEL[r.defect])} 사진 · FR ${r.fr} 외판열 ${r.strake}(${r.side})"></button>`
        :state(ICON_PHOTO,'사진 없음','이 손상에 연결된 사진이 없습니다');
      body.innerHTML=`<div class="dt"><div class="dt-media">${media}</div>
        ${cards([['종류',has?DEFECT_LABEL[r.defect]:'없음'],['면적',has?`${r.defectArea} m²`:'—',1],['판정',LEVEL_LABEL[level],1],['권장 조치',action||'—',1]],level)}</div>`;
      const btn=body.querySelector('.dt-img'),img=btn&&btn.querySelector('img');
      if(img){
        img.addEventListener('error',()=>{img.closest('.dt-media').innerHTML=state(ICON_PHOTO,'사진 없음','사진 파일을 불러올 수 없습니다');},{once:true});
        btn.addEventListener('click',()=>lightbox.open(r.photo,img.alt,caption,btn));
      }
      return;
    }
    const m=thickness(r,layer);
    body.innerHTML=`<div class="dt"><div class="dt-fig"></div>${cards(m.cards.map(([k,v,hl])=>[k,typeof v==='number'?`${v.toFixed(m.dp)} ${m.unit}`:v,hl]),level)}</div>`;
    drawFig(m,level);
  }
  function drawFig(m,level){
    const fig=body.querySelector('.dt-fig');if(!fig)return;
    const W=Math.round(fig.clientWidth),H=Math.round(fig.clientHeight);
    fig.innerHTML=W>40&&H>60?sectionSvg(m,level,W,H):'';
  }
  new ResizeObserver(()=>{const r=last&&last.r;if(r&&last.layer!=='defect')drawFig(thickness(r,ui.layer),judge(r,ui.layer).level);}).observe(body);
  store.subscribe(k=>{if(k.has('state')){clearTimeout(timer);timer=null;render();}else if(k.has('records')&&!timer)timer=setTimeout(()=>{timer=null;render();},250);});
  ui.subscribe(k=>{if(k==='layer'||k==='select')render();});
  render();
}
