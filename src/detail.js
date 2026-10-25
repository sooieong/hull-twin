/* =========================================================
   보조 시각화 2: 상세 (SPEC 5.2, 10.5, 10.6) — 선택한 측정점에 따라 바뀐다.
   위치·판정 정보는 KPI 목록에 있으므로 여기에는 그림과 수치 카드만 둔다. 어떤 지점인지는 패널 헤더에 작게 표시한다.
   - 도막 두께 · 강판 두께: 단면 비교 그림 (private/두께비교_예시.png 구성)이 남는 높이를 채운다.
     이전 도킹 두께 = 점선, 현재 = 실선, 기준값(원두께·설계) = 가는 회색 선, 아래 치수선, 오른쪽 감소량, 아래 수치 카드 4칸
   - 도막 손상: 실제 손상 사진을 잘리지 않게 전체 표시(contain), 누르면 라이트박스. 사진이 없으면 "사진 없음" (가짜 이미지는 만들지 않는다)
   ========================================================= */
import { judge, isCompound, actionFor, LEVEL_LABEL, DEFECT_LABEL, ratioPct, lossPct } from './data/criteria.js';
import { ZONES, ZONE_LABELS } from './hull.js';

export const PREV_DOCK='2023.09';                 // 이전 도킹 (헤더 도킹 선택 목록과 같은 값)
const EXAG=1.6;                                   // 두께 차이 과장 배율 (그림 전용)
const LV_COLOR=['#8FA3BF','#FFB224','#FF5A4E'];   // 정상 · 주의 · 심각 (히트맵 계열, UI 오렌지와 구분)
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const zoneLabel=z=>ZONE_LABELS[ZONES.indexOf(z)]||z;
const MINUS='−';

function thickness(r,layer){
  if(layer==='plate')return {title:'강판 두께',unit:'mm',dp:1,ref:r.plateOrig,prev:r.platePrev,cur:r.plate,refLabel:'원두께',
    material:'#3A4558',cards:[['원두께',r.plateOrig],[`이전 (${PREV_DOCK})`,r.platePrev],['현재',r.plate,1],['감소율 (원두께 대비)',lossPct(r),1]]};
  return {title:'도막 두께',unit:'µm',dp:0,ref:r.dftDesign,prev:r.dftPrev,cur:r.dft,refLabel:'설계',
    material:'#4A3A1E',cards:[['설계 (NDFT)',r.dftDesign],[`이전 (${PREV_DOCK})`,r.dftPrev],['현재',r.dft,1],['설계 대비',ratioPct(r),1]]};
}

/* rough text width (px): Hangul ≈ 1 em, other characters ≈ 0.6 em */
const textW=(t,fs)=>[...t].reduce((w,ch)=>w+(/[\u3131-\uD7A3]/.test(ch)?1:0.6),0)*fs;

/* section drawing (px, W × H). The section takes all the width left after the labels (left: reference value,
   right: the reduction note) and all the height; line weights, labels and the dimension text scale with the space (k ≥ 1). */
function sectionSvg(m,level,W,H){
  const k=Math.max(1,Math.min(2.2,W/380,H/200)),col=LV_COLOR[level],fmt=v=>v.toFixed(m.dp);
  const fs=11.5*k,fsDim=13*k,dim=`${fmt(m.cur)} ${m.unit}`,tw=dim.length*fsDim*0.6+14*k;
  const drop=m.prev-m.cur,dropTxt=drop>=0?`감소 ${MINUS}${fmt(drop)} ${m.unit}`:`증가 +${fmt(-drop)} ${m.unit}`;
  const rel=v=>Math.min(1.2,Math.max(0.2,1-EXAG*(m.ref-v)/m.ref)),outerRel=Math.max(1,rel(m.prev),rel(m.cur));
  const padL=Math.max(textW(`${m.refLabel} ${fmt(m.ref)}`,10.5*k),textW('이전',fs))+12*k;
  const padR=Math.max(textW(dropTxt,12*k),textW('이전 대비',10.5*k),textW('이전',fs))+14*k;
  const wRef=Math.max(40,(W-padL-padR)/outerRel),cx=padL+wRef*outerRel/2;
  const wOf=v=>wRef*rel(v);
  const wp=wOf(m.prev),wc=wOf(m.cur),narrow=wc<tw+16*k,L=w=>cx-w/2,Rt=w=>cx+w/2;   // narrow: dimension text below the line
  const yLab=fs+2,y1=yLab+10*k,top=y1+8*k,bot=Math.max(top+30,H-(narrow?40:30)*k),dimY=bot+16*k;
  const annX=Rt(Math.max(wp,wc,wRef))+8*k,a=6*k,arrow=(x,dir)=>`<path d="M${x} ${dimY}l${-dir*a} ${-a*0.6}v${a*1.2}z" fill="${col}"/>`;
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${m.title} 단면: 이전 ${fmt(m.prev)}, 현재 ${fmt(m.cur)} ${m.unit}, ${m.refLabel} ${fmt(m.ref)}">
    <defs><pattern id="dtHatch" width="${7*k}" height="${7*k}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="${7*k}" stroke="rgba(255,255,255,.12)" stroke-width="${1.2*k}"/></pattern></defs>
    <rect x="${L(wp)}" y="${top}" width="${wp}" height="${bot-top}" fill="${col}" fill-opacity=".16"/>
    <rect x="${L(wc)}" y="${top}" width="${wc}" height="${bot-top}" fill="${m.material}"/>
    <rect x="${L(wc)}" y="${top}" width="${wc}" height="${bot-top}" fill="url(#dtHatch)"/>
    <g stroke="#6F7C93" stroke-width="${k}"><line x1="${L(wRef)}" y1="${top-4*k}" x2="${L(wRef)}" y2="${bot+8*k}"/><line x1="${Rt(wRef)}" y1="${top-4*k}" x2="${Rt(wRef)}" y2="${bot+8*k}"/></g>
    <g stroke="#C9D3E3" stroke-width="${1.6*k}" stroke-dasharray="${2*k} ${3*k}"><line x1="${L(wp)}" y1="${y1}" x2="${L(wp)}" y2="${bot}"/><line x1="${Rt(wp)}" y1="${y1}" x2="${Rt(wp)}" y2="${bot}"/></g>
    <g stroke="${col}" stroke-width="${2.4*k}"><line x1="${L(wc)}" y1="${y1}" x2="${L(wc)}" y2="${dimY+5*k}"/><line x1="${Rt(wc)}" y1="${y1}" x2="${Rt(wc)}" y2="${dimY+5*k}"/></g>
    <g font-size="${fs}" font-family="IBM Plex Sans KR,sans-serif">
      <text x="${L(wp)-5*k}" y="${yLab}" text-anchor="end" fill="#C9D3E3">이전</text>
      ${wc<70*k?`<text x="${cx}" y="${yLab}" text-anchor="middle" fill="${col}">현재</text>`
        :`<text x="${L(wc)+5*k}" y="${yLab}" fill="${col}">현재</text><text x="${Rt(wc)-5*k}" y="${yLab}" text-anchor="end" fill="${col}">현재</text>`}
      <text x="${Rt(wp)+5*k}" y="${yLab}" fill="#C9D3E3">이전</text>
      <text x="${L(wRef)-6*k}" y="${bot+8*k}" text-anchor="end" font-size="${10.5*k}" fill="#6F7C93">${m.refLabel} ${fmt(m.ref)}</text>
      <text x="${annX}" y="${(top+bot)/2-2*k}" fill="${col}" font-size="${12*k}">${dropTxt}</text>
      <text x="${annX}" y="${(top+bot)/2+13*k}" fill="#6F7C93" font-size="${10.5*k}">이전 대비</text>
    </g>
    ${narrow?`<line x1="${L(wc)}" y1="${dimY}" x2="${Rt(wc)}" y2="${dimY}" stroke="${col}" stroke-width="${1.2*k}"/>`
      :`<g stroke="${col}" stroke-width="${1.2*k}"><line x1="${L(wc)}" y1="${dimY}" x2="${cx-tw/2}" y2="${dimY}"/><line x1="${cx+tw/2}" y1="${dimY}" x2="${Rt(wc)}" y2="${dimY}"/></g>${arrow(L(wc),-1)}${arrow(Rt(wc),1)}`}
    <text x="${cx}" y="${narrow?dimY+18*k:dimY+fsDim*0.35}" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-weight="500" font-size="${fsDim}" fill="#E8EDF6">${dim}</text>
  </svg>`;
}

const ICON_PHOTO='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3l2-2.5h6L17 7h3v12H4z"/><circle cx="12" cy="13" r="3.5"/><path d="M3 3l18 18"/></svg>';
const ICON_OK='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="m8 12.3 2.7 2.7 5.3-5.6"/></svg>';
const ICON_PICK='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>';
const state=(icon,t,s)=>`<div class="dt-state">${icon}<b>${t}</b><span>${s}</span></div>`;

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
  function render(){
    const layer=ui.layer,r=ui.selId!=null?store.get(ui.selId):null;
    subEl.textContent=r?`FR ${r.fr} · ${r.strake}(${r.side})`:'';
    if(!r){body.innerHTML=ui.selId!=null&&(store.mapState==='mapping'||store.mapState==='paused')
      ?state(ICON_PICK,'아직 측정되지 않은 지점입니다','로봇이 지나가면 이 지점의 값이 표시됩니다')
      :state(ICON_PICK,'지점을 선택하세요','메인 히트맵, Side Shell 도면, KPI 목록에서 선택할 수 있습니다');return;}
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
  new ResizeObserver(()=>{const r=ui.selId!=null&&store.get(ui.selId);if(r&&ui.layer!=='defect')drawFig(thickness(r,ui.layer),judge(r,ui.layer).level);}).observe(body);
  store.subscribe(k=>{if(k.has('state')){clearTimeout(timer);timer=null;render();}else if(k.has('records')&&!timer)timer=setTimeout(()=>{timer=null;render();},250);});
  ui.subscribe(k=>{if(k==='layer'||k==='select')render();});
  render();
}
