/* =========================================================
   보조 시각화 2: 상세 (SPEC 5.2, 10.5, 10.6) — 선택한 측정점에 따라 바뀐다.
   매핑 중(중지 포함)에 고른 지점이 없으면 가장 최근에 측정된 이상 지점(현재 레이어 기준)을 자동으로 보여준다.
   아직 이상이 없으면 공통 빈 상태 안내(emptyState.js)를 보여준다. 사용자가 지점을 고르면 그 지점을 계속 보여준다.
   매핑 완료 상태의 기본 선택(KPI 1위)은 KPI 패널이 정한다.
   위치·판정 정보는 KPI 목록에 있으므로 여기에는 그림과 수치 카드만 둔다.
   - 도막 두께 · 강판 두께 (private/시안_v4_수정.png): 왼쪽 단면 그림 + 치수선 3개(sectionSvg.js)가 패널 높이를 채운다.
     오른쪽 칸: 카드 2개 — "원두께 대비"(도막은 "설계 대비") 줄어든 두께(판정색), "1차 리도킹 대비" 줄어든 두께(주황, 조금 작게).
     비교할 이전 도킹이 없는 기록(1차 리도킹 보기)은 "원두께(설계) 대비" 카드 하나만.
     "○○ 대비"는 화면 전체에서 줄어든 양(부호 포함)만 뜻한다.
   - 도막 손상: 두께 레이어와 같은 배치 — 왼쪽 손상 사진(cover로 꽉 채움, 누르면 라이트박스에서 전체), 오른쪽 카드 2개
     "종류"(도막 떨어짐 / 스크래치, 판정색) · "AI 신뢰도"(레코드의 aiConfidence, %). 사진이 없으면 "사진 없음" (가짜 이미지는 만들지 않는다)
   ========================================================= */
import { judge, isTop, gradeOf, CRIT } from './data/criteria.js';
import { DEFECT_LABEL, recLoc, area, dropHtml, numHtml } from './format.js';
import { thickness, sectionSvg, THEME } from './sectionSvg.js';
import { emptyState, mappingState, PICK_HINT } from './emptyState.js';

const LV_COLOR=THEME.dark.level,PREV_COLOR=LV_COLOR[1];   // 1차 리도킹 대비: 주황   // 정상 · 주의 · 경고 (히트맵 계열, UI 오렌지와 구분)
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

const ICON_PHOTO='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3l2-2.5h6L17 7h3v12H4z"/><circle cx="12" cy="13" r="3.5"/><path d="M3 3l18 18"/></svg>';
const ICON_OK='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="m8 12.3 2.7 2.7 5.3-5.6"/></svg>';
const ICON_PICK='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>';
const state=(icon,t,s)=>emptyState(t,s,{icon});
const FIG_ASPECT=1.1;   // section figure width : height (the default layout's ratio)
const SIDE_W=128;       // px: the side cards' column at its widest in the normal layout (style.css .dt-side) — the maximised cards scale from it

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
  return {open(src,alt,caption,from){const img=lb.querySelector('img');img.src=src;img.alt=alt;lb.querySelector('figcaption').innerHTML=numHtml(caption);
    opener=from;lb.hidden=false;lb.querySelector('.lb-close').focus();}};
}

export function createDetailPanel(body,store,ui){
  let timer=null;const lightbox=createLightbox();
  const robotEl=body.closest('.pane').querySelector('#dtRobot');   // panel header: the robot that measured the point shown
  /* right-hand card: small grey title, value below (a number in the shared .num-drop style, or a word) */
  const sideCard=(title,value,cls='')=>`<div class="dt-card ${cls}"><span>${title}</span>${value}</div>`;
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
    const layer=ui.layer,r=shownRecord();
    // no record: the user's pick not measured yet, the mapping notice (nothing abnormal yet), or the pick hint
    const empty=r?null:!mapping()?state(ICON_PICK,PICK_HINT):ui.selId!=null?state(ICON_PICK,'아직 측정되지 않은 지점입니다','로봇이 지나가면 이 지점의 값이 표시됩니다')
      :mappingState(store,'상세 정보');
    if(last&&last.r===r&&last.layer===layer&&last.empty===empty)return;
    last={r,layer,empty};
    if(robotEl)robotEl.textContent=r&&r.robot?`측정 로봇 ${r.robot}`:'';
    if(!r){body.innerHTML=empty;return;}
    const {level}=judge(r,layer),top=isTop(r,layer);
    const colorLevel=Math.min(gradeOf(level,top),CRIT);   // 최우선 보수 is drawn in the 경고 colour, like its chip
    if(layer==='defect'){
      const has=!!r.defect,caption=has?`${DEFECT_LABEL[r.defect]}·${area(r.defectArea)}·${recLoc(r)}`:'';
      const media=!has?state(ICON_OK,'손상 없음','이 지점에서 발견된 도막 손상이 없습니다')
        // a wide cell: filled (cover, centred) · a tall one: the whole photo in a frame of its own ratio, centred (fitPhoto)
        :r.photo?`<button class="dt-img" title="크게 보기" aria-label="사진 크게 보기"><img src="${esc(r.photo)}" alt="${esc(DEFECT_LABEL[r.defect])} 사진·${recLoc(r)}"></button>`
        :state(ICON_PHOTO,'사진 없음','이 손상에 연결된 사진이 없습니다');
      const kind=`<b class="dt-word"${has?` style="color:${LV_COLOR[colorLevel]}"`:''}>${has?esc(DEFECT_LABEL[r.defect]):'없음'}</b>`;
      const conf=has&&r.aiConfidence!=null?dropHtml(r.aiConfidence,'%'):'<b class="dt-word">—</b>';
      body.innerHTML=`<div class="dt"><div class="dt-main"><div class="dt-media">${media}</div>
        <div class="dt-side">${sideCard('종류',kind,'kind')}${sideCard('AI 신뢰도',conf,'ai')}</div></div></div>`;
      sizeSide();
      const btn=body.querySelector('.dt-img'),img=btn&&btn.querySelector('img');
      if(img){
        img.addEventListener('error',()=>{img.closest('.dt-media').innerHTML=state(ICON_PHOTO,'사진 없음','사진 파일을 불러올 수 없습니다');},{once:true});
        if(img.complete&&img.naturalWidth)fitPhoto();else img.addEventListener('load',fitPhoto,{once:true});
        btn.addEventListener('click',()=>lightbox.open(r.photo,img.alt,caption,btn));
      }
      return;
    }
    const m=thickness(r,layer),card=([k,v,u],cls,color)=>`<div class="dt-card ${cls}"><span>${k}</span>${dropHtml(v,u,color)}</div>`;
    body.innerHTML=`<div class="dt"><div class="dt-main"><div class="dt-fig"></div>
      <div class="dt-side">${card(m.side[0],'ref',LV_COLOR[colorLevel])}${m.side[1]?card(m.side[1],'prev',PREV_COLOR):''}</div></div></div>`;
    sizeSide();drawFig(m,colorLevel);
  }
  const isMax=()=>!!body.closest('.pane.max');
  /* damage photo (re-run on every resize):
     - not maximised and the cell wider than tall: the frame fills the cell, the photo covers it from its centre
     - otherwise (maximised, S.SHELL folded): the frame takes the photo's ratio at the largest size that fits; the cell centres it */
  function fitPhoto(){
    const btn=body.querySelector('.dt-img'),img=btn&&btn.querySelector('img');if(!img||!img.naturalWidth)return;
    const cell=btn.parentElement,cw=cell.clientWidth,ch=cell.clientHeight,ratio=img.naturalWidth/img.naturalHeight,fill=cw>ch&&!isMax();
    const W=fill?cw:Math.min(cw,ch*ratio),H=fill?ch:W/ratio;
    btn.style.width=`${Math.floor(W)}px`;btn.style.height=`${Math.floor(H)}px`;
  }
  /* maximised: the side cards' column is ~20% of the panel (CSS); --k = its width / the normal column's, which scales the
     cards' height, padding and type (style.css .pane.max .dt-side) */
  function sizeSide(){
    const side=body.querySelector('.dt-side');if(!side)return;
    if(isMax())side.style.setProperty('--k',(side.clientWidth/SIDE_W).toFixed(3));else side.style.removeProperty('--k');
  }
  /* the section figure keeps FIG_ASPECT at any panel size: the largest such box in the cell, centred (sectionSvg fills what it gets) */
  function drawFig(m,level){
    const fig=body.querySelector('.dt-fig');if(!fig)return;
    const cw=fig.clientWidth,ch=fig.clientHeight,W=Math.round(Math.min(cw,ch*FIG_ASPECT)),H=Math.round(W/FIG_ASPECT);
    fig.innerHTML=W>40&&H>60?sectionSvg(m,level,W,H):'';
  }
  new ResizeObserver(()=>{const r=last&&last.r;sizeSide();if(r&&last.layer==='defect')fitPhoto();if(r&&last.layer!=='defect')drawFig(thickness(r,ui.layer),Math.min(gradeOf(judge(r,ui.layer).level,isTop(r,ui.layer)),CRIT));}).observe(body);
  // the mapping notice carries the progress, so robot moves (pose) refresh it too while nothing is shown
  store.subscribe(k=>{if(k.has('state')){clearTimeout(timer);timer=null;render();}
    else if((k.has('records')||k.has('pose')&&last&&!last.r)&&!timer)timer=setTimeout(()=>{timer=null;render();},250);});
  ui.subscribe(k=>{if(k==='layer'||k==='select')render();});
  render();
}
