/* =========================================================
   두께 단면 비교 그림 (private/두께비교_예시.png 구성) — 상세 패널(어두운 테마)과 보고서(흰 바탕)가 함께 쓴다.
   이전 도킹 두께 = 점선, 현재 = 실선, 기준값(원두께·설계) = 가는 회색 선, 아래 치수선, 오른쪽 감소량.
   단면은 라벨 자리를 뺀 폭과 높이를 모두 쓰고, 선 굵기·글자는 공간에 맞춰 커진다 (k ≥ 1).
   ========================================================= */
import { THICK, thick, thickNum, drop, designRatio, lossRatio } from './format.js';

export const PREV_DOCK='2023.09';   // 이전 도킹 (헤더 도킹 선택 목록과 같은 값)
const EXAG=1.6;                     // 두께 차이 과장 배율 (그림 전용)

export const THEME={
  dark:{level:['#8FA3BF','#FFB224','#FF5A4E'],label:'#C9D3E3',muted:'#6F7C93',dim:'#E8EDF6',hatch:'rgba(255,255,255,.12)',
    material:{plate:'#3A4558',dft:'#4A3A1E'}},
  light:{level:['#8A93A3','#E09A00','#C42A1B'],label:'#3A4252',muted:'#6B7385',dim:'#14181F',hatch:'rgba(0,0,0,.14)',
    material:{plate:'#C3C9D2',dft:'#EAD3A2'}}
};

/* 측정점 하나의 단면 모델 (cards: 표시용 문자열) */
export function thickness(r,layer){
  const t=v=>thick(v,layer);
  if(layer==='plate')return {layer,title:'강판 두께',unit:THICK.plate.unit,ref:r.plateOrig,prev:r.platePrev,cur:r.plate,refLabel:THICK.plate.ref,
    cards:[['원두께',t(r.plateOrig)],[`이전 (${PREV_DOCK})`,t(r.platePrev)],['현재',t(r.plate),1],['감소율 (원두께 대비)',lossRatio(r),1]]};
  return {layer,title:'도막 두께',unit:THICK.dft.unit,ref:r.dftDesign,prev:r.dftPrev,cur:r.dft,refLabel:THICK.dft.ref,
    cards:[['설계 (NDFT)',t(r.dftDesign)],[`이전 (${PREV_DOCK})`,t(r.dftPrev)],['현재',t(r.dft),1],['설계 대비',designRatio(r),1]]};
}

/* rough text width (px): Hangul ≈ 1 em, other characters ≈ 0.6 em */
const textW=(t,fs)=>[...t].reduce((w,ch)=>w+(/[ㄱ-힣]/.test(ch)?1:0.6),0)*fs;
let uid=0;

/* opts.note=false: no reduction note on the right (small figures; the caption carries it) */
export function sectionSvg(m,level,W,H,theme=THEME.dark,maxK=2.2,opts={}){
  const note=opts.note!==false;
  const k=Math.max(1,Math.min(maxK,W/380,H/200)),col=theme.level[level],fmt=v=>thickNum(v,m.layer),pid=`secHatch${++uid}`;
  const fs=11.5*k,fsDim=13*k,dim=thick(m.cur,m.layer),tw=dim.length*fsDim*0.6+14*k;
  const dropTxt=drop(m.prev,m.cur,m.layer);   // −253 µm (signed)
  const rel=v=>Math.min(1.2,Math.max(0.2,1-EXAG*(m.ref-v)/m.ref)),outerRel=Math.max(1,rel(m.prev),rel(m.cur));
  const padL=Math.max(textW(`${m.refLabel} ${fmt(m.ref)}`,10.5*k),textW('이전',fs))+12*k;
  const padR=(note?Math.max(textW(dropTxt,12*k),textW('이전 대비',10.5*k)):0)+textW('이전',fs)+14*k;
  const wRef=Math.max(40,(W-padL-padR)/outerRel),cx=padL+wRef*outerRel/2;
  const wOf=v=>wRef*rel(v);
  const wp=wOf(m.prev),wc=wOf(m.cur),narrow=wc<tw+16*k,L=w=>cx-w/2,Rt=w=>cx+w/2;   // narrow: dimension text below the line
  const yLab=fs+2,y1=yLab+10*k,top=y1+8*k,bot=Math.max(top+30,H-(narrow?40:30)*k),dimY=bot+16*k;
  const annX=Rt(Math.max(wp,wc,wRef))+8*k,a=6*k,arrow=(x,dir)=>`<path d="M${x} ${dimY}l${-dir*a} ${-a*0.6}v${a*1.2}z" fill="${col}"/>`;
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${m.title} 단면: 이전 ${thick(m.prev,m.layer)}, 현재 ${dim}, ${m.refLabel} ${thick(m.ref,m.layer)}">
    <defs><pattern id="${pid}" width="${7*k}" height="${7*k}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="${7*k}" stroke="${theme.hatch}" stroke-width="${1.2*k}"/></pattern></defs>
    <rect x="${L(wp)}" y="${top}" width="${wp}" height="${bot-top}" fill="${col}" fill-opacity=".16"/>
    <rect x="${L(wc)}" y="${top}" width="${wc}" height="${bot-top}" fill="${theme.material[m.layer]}"/>
    <rect x="${L(wc)}" y="${top}" width="${wc}" height="${bot-top}" fill="url(#${pid})"/>
    <g stroke="${theme.muted}" stroke-width="${k}"><line x1="${L(wRef)}" y1="${top-4*k}" x2="${L(wRef)}" y2="${bot+8*k}"/><line x1="${Rt(wRef)}" y1="${top-4*k}" x2="${Rt(wRef)}" y2="${bot+8*k}"/></g>
    <g stroke="${theme.label}" stroke-width="${1.6*k}" stroke-dasharray="${2*k} ${3*k}"><line x1="${L(wp)}" y1="${y1}" x2="${L(wp)}" y2="${bot}"/><line x1="${Rt(wp)}" y1="${y1}" x2="${Rt(wp)}" y2="${bot}"/></g>
    <g stroke="${col}" stroke-width="${2.4*k}"><line x1="${L(wc)}" y1="${y1}" x2="${L(wc)}" y2="${dimY+5*k}"/><line x1="${Rt(wc)}" y1="${y1}" x2="${Rt(wc)}" y2="${dimY+5*k}"/></g>
    <g font-size="${fs}" font-family="IBM Plex Sans KR,sans-serif">
      <text x="${L(wp)-5*k}" y="${yLab}" text-anchor="end" fill="${theme.label}">이전</text>
      ${wc<70*k?`<text x="${cx}" y="${yLab}" text-anchor="middle" fill="${col}">현재</text>`
        :`<text x="${L(wc)+5*k}" y="${yLab}" fill="${col}">현재</text><text x="${Rt(wc)-5*k}" y="${yLab}" text-anchor="end" fill="${col}">현재</text>`}
      <text x="${Rt(wp)+5*k}" y="${yLab}" fill="${theme.label}">이전</text>
      <text x="${L(wRef)-6*k}" y="${bot+8*k}" text-anchor="end" font-size="${10.5*k}" fill="${theme.muted}">${m.refLabel} ${fmt(m.ref)}</text>
      ${note?`<text x="${annX}" y="${(top+bot)/2-2*k}" fill="${col}" font-size="${12*k}">${dropTxt}</text>
      <text x="${annX}" y="${(top+bot)/2+13*k}" fill="${theme.muted}" font-size="${10.5*k}">이전 대비</text>`:''}
    </g>
    ${narrow?`<line x1="${L(wc)}" y1="${dimY}" x2="${Rt(wc)}" y2="${dimY}" stroke="${col}" stroke-width="${1.2*k}"/>`
      :`<g stroke="${col}" stroke-width="${1.2*k}"><line x1="${L(wc)}" y1="${dimY}" x2="${cx-tw/2}" y2="${dimY}"/><line x1="${cx+tw/2}" y1="${dimY}" x2="${Rt(wc)}" y2="${dimY}"/></g>${arrow(L(wc),-1)}${arrow(Rt(wc),1)}`}
    <text x="${cx}" y="${narrow?dimY+18*k:dimY+fsDim*0.35}" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-weight="500" font-size="${fsDim}" fill="${theme.dim}">${dim}</text>
  </svg>`;
}
