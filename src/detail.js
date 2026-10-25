/* =========================================================
   보조 시각화 2: 상세 (SPEC 5.2) — 선택한 측정점에 따라 바뀐다.
   - 도막 두께 · 강판 두께: 단면 비교 그림 (private/두께비교_예시.png 구성)
     이전 도킹 두께 = 점선, 현재 = 실선, 기준값(원두께·설계) = 가는 회색 선, 아래 치수선, 오른쪽 감소량, 아래 수치 카드 4칸
   - 도막 손상: 실제 손상 사진 + 종류·면적·위치·권장 조치. 사진이 없으면 "사진 없음" 상태 (가짜 이미지는 만들지 않는다)
   ========================================================= */
import { ZONES, ZONE_LABELS } from './hull.js';
import { OK, judge, isCompound, actionFor, LEVEL_LABEL, DEFECT_LABEL, dftRatio, plateLoss } from './data/criteria.js';

export const PREV_DOCK='2023.09';                 // 이전 도킹 (헤더 도킹 선택 목록과 같은 값)
const EXAG=1.6;                                   // 두께 차이 과장 배율 (그림 전용)
const LV_COLOR=['#8FA3BF','#FFB224','#FF5A4E'];   // 정상 · 주의 · 심각 (히트맵 계열, UI 오렌지와 구분)
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const zoneLabel=z=>ZONE_LABELS[ZONES.indexOf(z)]||z;
const MINUS='−';

function thickness(r,layer){
  if(layer==='plate')return {eyebrow:'PLATE THICKNESS',title:'강판 두께',unit:'mm',dp:1,ref:r.plateOrig,prev:r.platePrev,cur:r.plate,refLabel:'원두께',
    material:'#3A4558',cards:[['원두께',r.plateOrig],[`이전 (${PREV_DOCK})`,r.platePrev],['현재',r.plate,1],['감소율 (원두께 대비)',`${(plateLoss(r)*100).toFixed(1)}%`,1]]};
  return {eyebrow:'COATING THICKNESS',title:'도막 두께',unit:'µm',dp:0,ref:r.dftDesign,prev:r.dftPrev,cur:r.dft,refLabel:'설계',
    material:'#4A3A1E',cards:[['설계 (NDFT)',r.dftDesign],[`이전 (${PREV_DOCK})`,r.dftPrev],['현재',r.dft,1],['설계 대비',`${Math.round(dftRatio(r)*100)}%`,1]]};
}

/* section drawing (px, W × H) */
function sectionSvg(m,level,W,H){
  const col=LV_COLOR[level],cx=W/2,fmt=v=>v.toFixed(m.dp);
  const wRef=Math.min(W*0.5,260);
  const wOf0=v=>wRef*Math.min(1.2,Math.max(0.2,1-EXAG*(m.ref-v)/m.ref));
  const dim0=`${m.cur.toFixed(m.dp)} ${m.unit}`,tw0=dim0.length*7.4+14,narrow=wOf0(m.cur)<tw0+16;   // dimension text below the line when the gap is small
  const yLab=12,y1=22,top=30,bot=Math.max(top+30,H-(narrow?40:30)),dimY=bot+16;
  const wOf=wOf0,wp=wOf(m.prev),wc=wOf(m.cur),L=w=>cx-w/2,Rt=w=>cx+w/2;
  const drop=m.prev-m.cur,dropTxt=drop>=0?`감소 ${MINUS}${fmt(drop)} ${m.unit}`:`증가 +${fmt(-drop)} ${m.unit}`;
  const outer=Math.max(wp,wc,wRef),annX=Rt(outer)+8,dim=dim0,tw=tw0;
  const arrow=(x,dir)=>`<path d="M${x} ${dimY}l${-dir*6} -3.5v7z" fill="${col}"/>`;
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${m.title} 단면: 이전 ${fmt(m.prev)}, 현재 ${fmt(m.cur)} ${m.unit}, ${m.refLabel} ${fmt(m.ref)}">
    <defs><pattern id="dtHatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="rgba(255,255,255,.12)" stroke-width="1.2"/></pattern></defs>
    <rect x="${L(wp)}" y="${top}" width="${wp}" height="${bot-top}" fill="${col}" fill-opacity=".16"/>
    <rect x="${L(wc)}" y="${top}" width="${wc}" height="${bot-top}" fill="${m.material}"/>
    <rect x="${L(wc)}" y="${top}" width="${wc}" height="${bot-top}" fill="url(#dtHatch)"/>
    <g stroke="#6F7C93" stroke-width="1"><line x1="${L(wRef)}" y1="${top-4}" x2="${L(wRef)}" y2="${bot+8}"/><line x1="${Rt(wRef)}" y1="${top-4}" x2="${Rt(wRef)}" y2="${bot+8}"/></g>
    <g stroke="#C9D3E3" stroke-width="1.6" stroke-dasharray="2 3"><line x1="${L(wp)}" y1="${y1}" x2="${L(wp)}" y2="${bot}"/><line x1="${Rt(wp)}" y1="${y1}" x2="${Rt(wp)}" y2="${bot}"/></g>
    <g stroke="${col}" stroke-width="2.4"><line x1="${L(wc)}" y1="${y1}" x2="${L(wc)}" y2="${dimY+5}"/><line x1="${Rt(wc)}" y1="${y1}" x2="${Rt(wc)}" y2="${dimY+5}"/></g>
    <g font-size="11.5" font-family="IBM Plex Sans KR,sans-serif">
      <text x="${L(wp)-5}" y="${yLab}" text-anchor="end" fill="#C9D3E3">이전</text>
      ${wc<70?`<text x="${cx}" y="${yLab}" text-anchor="middle" fill="${col}">현재</text>`
        :`<text x="${L(wc)+5}" y="${yLab}" fill="${col}">현재</text><text x="${Rt(wc)-5}" y="${yLab}" text-anchor="end" fill="${col}">현재</text>`}
      <text x="${Rt(wp)+5}" y="${yLab}" fill="#C9D3E3">이전</text>
      <text x="${L(wRef)-6}" y="${bot+8}" text-anchor="end" font-size="10.5" fill="#6F7C93">${m.refLabel} ${fmt(m.ref)}</text>
      <text x="${annX}" y="${(top+bot)/2-2}" fill="${col}" font-size="12">${dropTxt}</text>
      <text x="${annX}" y="${(top+bot)/2+13}" fill="#6F7C93" font-size="10.5">이전 대비</text>
    </g>
    ${narrow?`<line x1="${L(wc)}" y1="${dimY}" x2="${Rt(wc)}" y2="${dimY}" stroke="${col}" stroke-width="1.2"/>`
      :`<g stroke="${col}" stroke-width="1.2"><line x1="${L(wc)}" y1="${dimY}" x2="${cx-tw/2}" y2="${dimY}"/><line x1="${cx+tw/2}" y1="${dimY}" x2="${Rt(wc)}" y2="${dimY}"/></g>${arrow(L(wc),-1)}${arrow(Rt(wc),1)}`}
    <text x="${cx}" y="${narrow?dimY+18:dimY+4.5}" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-weight="500" font-size="13" fill="#E8EDF6">${dim}</text>
  </svg>`;
}

const ICON_PHOTO='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3l2-2.5h6L17 7h3v12H4z"/><circle cx="12" cy="13" r="3.5"/><path d="M3 3l18 18"/></svg>';
const ICON_OK='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="m8 12.3 2.7 2.7 5.3-5.6"/></svg>';
const ICON_PICK='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>';
const state=(icon,t,s)=>`<div class="dt-state">${icon}<b>${t}</b><span>${s}</span></div>`;

export function createDetailPanel(body,store,ui,titleEl){
  let timer=null;
  function cards(list,level){
    // numbers in the mono face, words (종류, 조치) in the UI face so they can wrap
    return `<div class="dt-cards">${list.map(([k,v,hl])=>`<div class="dt-card"><span>${esc(k)}</span><b class="${/^[\d—]/.test(String(v))?'':'tx'}"${hl?` style="color:${LV_COLOR[level]}"`:''}>${esc(v)}</b></div>`).join('')}</div>`;
  }
  function head(eyebrow,title,r,level,action){
    const chip=`<span class="lv lv${level}">${LEVEL_LABEL[level]}${action?' · '+esc(action):''}</span>`;
    return `<div class="dt-head"><span class="eyebrow">${eyebrow}</span><div class="dt-title"><b>${title}</b>${chip}${level>OK&&isCompound(r)?'<span class="dt-cx">복합</span>':''}</div>
      <div class="dt-loc">FR ${r.fr} · 외판열 ${r.strake}(${r.side}) · ${esc(zoneLabel(r.zone))} · X ${r.X.toFixed(2)} Y ${r.Y.toFixed(2)} Z ${r.Z.toFixed(2)} m</div></div>`;
  }
  function render(){
    const layer=ui.layer;titleEl.textContent=layer==='defect'?'손상 사진':'두께 비교';
    const r=ui.selId!=null?store.get(ui.selId):null;
    if(!r){body.innerHTML=ui.selId!=null&&store.mapState==='mapping'
      ?state(ICON_PICK,'아직 측정되지 않은 지점입니다','로봇이 지나가면 이 지점의 값이 표시됩니다')
      :state(ICON_PICK,'지점을 선택하세요','메인 히트맵, Side Shell 도면, KPI 목록에서 선택할 수 있습니다');return;}
    const {level}=judge(r,layer),action=actionFor(r,layer,level,isCompound(r));
    if(layer==='defect'){
      const has=!!r.defect;
      const media=!has?state(ICON_OK,'손상 없음','이 지점에서 발견된 도막 손상이 없습니다')
        :r.photo?`<a class="dt-img" href="${esc(r.photo)}" target="_blank" rel="noopener" title="원본 사진 열기"><img src="${esc(r.photo)}" alt="${DEFECT_LABEL[r.defect]} 사진 · FR ${r.fr} 외판열 ${r.strake}(${r.side})"></a>`
        :state(ICON_PHOTO,'사진 없음','이 손상에 연결된 사진이 없습니다');
      body.innerHTML=`<div class="dt">${head('COATING DAMAGE','도막 손상',r,level,action)}<div class="dt-media">${media}</div>
        ${cards([['종류',has?DEFECT_LABEL[r.defect]:'없음'],['면적',has?`${r.defectArea} m²`:'—',1],['위치',zoneLabel(r.zone)],['권장 조치',action||'—',1]],level)}</div>`;
      const img=body.querySelector('.dt-img img');
      if(img)img.addEventListener('error',()=>{img.closest('.dt-media').innerHTML=state(ICON_PHOTO,'사진 없음','사진 파일을 불러올 수 없습니다');},{once:true});
      return;
    }
    const m=thickness(r,layer);
    body.innerHTML=`<div class="dt">${head(m.eyebrow,m.title,r,level,action)}<div class="dt-fig"></div>${cards(m.cards.map(([k,v,hl])=>[k,typeof v==='number'?`${v.toFixed(m.dp)} ${m.unit}`:v,hl]),level)}</div>`;
    drawFig(m,level);
  }
  function drawFig(m,level){
    const fig=body.querySelector('.dt-fig');if(!fig)return;
    const W=Math.round(fig.clientWidth),H=Math.round(fig.clientHeight);
    fig.innerHTML=W>40&&H>60?sectionSvg(m,level,W,H):'';
  }
  new ResizeObserver(()=>{const r=ui.selId!=null&&store.get(ui.selId);if(r&&ui.layer!=='defect')drawFig(thickness(r,ui.layer),judge(r,ui.layer).level);}).observe(body);
  store.subscribe(k=>{if((k.has('records')||k.has('state'))&&!timer)timer=setTimeout(()=>{timer=null;render();},250);});
  ui.subscribe(k=>{if(k==='layer'||k==='select')render();});
  render();
}
