/* =========================================================
   두께 단면 비교 그림 (private/두께비교_예시.png 구성) — 상세 패널(어두운 테마)과 보고서(흰 바탕)가 함께 쓴다.
   기준(원두께, 도막은 설계) = 회색 실선, 1차 리도킹 = 점선, 현재 = 판정색 실선. 선 위치는 항상 실제 값 크기대로
   (도막은 1차 리도킹 때 다시 칠해 1차가 설계보다 두꺼울 수 있다).
   위쪽 라벨은 두지 않는다 — 선의 의미는 아래 치수선 라벨이 알려 준다. 그림은 맨 위부터 시작한다.
   아래 치수선 3개를 값이 작은 순서로 쌓는다: 현재(가장 크게, 판정색) · 1차 · 기준. 글자가 선 안에 안 들어가면 오른쪽 바깥에
   (아래로 지나가는 다른 치수 보조선 위에 바탕색을 깔고), 그림 밖으로 나가면 선 아래 가운데에 쓴다.
   그림은 주어진 폭과 높이를 모두 쓰고, 선 굵기·글자는 공간에 맞춰 커진다 (k ≥ opts.minK, 기본 1).
   opts.dims: 그릴 치수선 (기본 ['cur','prev','ref']) — 보고서의 작은 그림은 ['cur']만 그리고 캡션에 값을 쓴다.
   ========================================================= */
import { THICK, thick, thickNum, dropNum } from './format.js';

const EXAG=1.6;                     // 두께 차이 과장 배율 (그림 전용)

export const THEME={
  dark:{bg:'#0A1120',level:['#8FA3BF','#F2B53A','#FF5A5F'],label:'#C9D3E3',muted:'#6F7C93',dim:'#E8EDF6',hatch:'rgba(255,255,255,.12)',
    material:{plate:'#3A4558',dft:'#4A3A1E'}},
  light:{bg:'#FFFFFF',level:['#8A93A3','#C98A12','#E23D4B']   /* amber darkened to read on white */,label:'#3A4252',muted:'#6B7385',dim:'#14181F',hatch:'rgba(0,0,0,.14)',
    material:{plate:'#C3C9D2',dft:'#EAD3A2'}}
};

/* 측정점 하나의 단면 모델. side: 오른쪽 카드 [제목, 숫자, 단위] — "○○ 대비"는 줄어든 양(부호 포함) */
export function thickness(r,layer){
  const m=layer==='plate'?{layer,title:'강판 두께',unit:THICK.plate.unit,ref:r.plateOrig,prev:r.platePrev,cur:r.plate,refLabel:THICK.plate.ref}
    :{layer,title:'도막 두께',unit:THICK.dft.unit,ref:r.dftDesign,prev:r.dftPrev,cur:r.dft,refLabel:THICK.dft.ref};
  m.side=[[`${m.refLabel} 대비`,dropNum(m.ref,m.cur,layer),m.unit],['1차 리도킹 대비',dropNum(m.prev,m.cur,layer),m.unit]];
  return m;
}

/* rough text width (px): Hangul ≈ 1 em, other characters ≈ 0.6 em */
const textW=(t,fs)=>[...t].reduce((w,ch)=>w+(/[ㄱ-힣]/.test(ch)?1:0.6),0)*fs;
let uid=0;

export function sectionSvg(m,level,W,H,theme=THEME.dark,maxK=2.2,opts={}){
  const k=Math.max(opts.minK||1,Math.min(maxK,W/380,H/230)),col=theme.level[level],pid=`secHatch${++uid}`;
  const fsCur=13*k,fsDim=11*k,MONO='IBM Plex Mono,monospace';
  const rel=v=>Math.min(1.25,Math.max(0.2,1-EXAG*(m.ref-v)/m.ref));
  const lines=[{key:'ref',v:m.ref,label:m.refLabel},{key:'prev',v:m.prev,label:'1차'},{key:'cur',v:m.cur,label:'현재'}];
  lines.forEach(l=>{const cur=l.key==='cur';l.fs=cur?fsCur:fsDim;
    l.text=cur?`현재 ${thick(l.v,m.layer)}`:`${l.label} ${thickNum(l.v,m.layer)}`;l.tw=textW(l.text,l.fs);});
  const outerRel=Math.max(...lines.map(l=>rel(l.v)));

  // horizontal: room on the left for the outside labels; on the right also for dimension texts that do not fit inside their line
  const padL=8*k;   // no labels outside the lines any more: a small margin
  let padR=padL,wRef=0;
  const dimSet=new Set(opts.dims||['cur','prev','ref']),shown=lines.filter(l=>dimSet.has(l.key));
  const maxPadR=W*0.32;   // beyond this a label goes under its line instead of widening the margin
  for(let i=0;i<3;i++){
    wRef=Math.max(30,(W-padL-padR)/outerRel);
    const need=shown.map(l=>{const w=wRef*rel(l.v);return l.tw+28*k<=w?0:l.tw+8*k-(wRef*outerRel-w)/2;}).filter(n=>n<=maxPadR);
    padR=Math.max(padL,...need);
  }
  wRef=Math.max(30,(W-padL-padR)/outerRel);
  const cx=padL+wRef*outerRel/2,L=w=>cx-w/2,Rt=w=>cx+w/2;
  lines.forEach(l=>{l.w=wRef*rel(l.v);l.place=l.tw+28*k<=l.w?'in':Rt(l.w)+7*k+l.tw<=W-2?'right':'below';});
  const [ref,prev,cur]=lines;

  // vertical: two label rows, the section band, then the dimension rows (smallest value on top)
  const top=6*k;   // the lines start a little above the band
  const rows=[...shown].sort((a,b)=>a.v-b.v);rows.forEach(l=>{l.h=(l.key==='cur'?2:2.1)*l.fs+(l.place==='below'?1.1*l.fs:0);});
  const dimsH=rows.reduce((s,l)=>s+l.h,0)+6*k,bot=Math.max(top+30*k,H-dimsH);
  let y=bot+4*k;rows.forEach(l=>{l.y=y+(l.place==='below'?l.fs:l.h/2);y+=l.h;});
  lines.forEach(l=>{if(!dimSet.has(l.key))l.y=bot-3*k;});   // no dimension row: the line stops at the band

  const wOut=Math.max(ref.w,prev.w);   // lost material: from the thicker of the original / 1st redocking down to now
  const vline=(x,y1,y2,attrs)=>`<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" ${attrs}/>`;
  const pair=(l,y1,attrs)=>vline(L(l.w),y1,l.y+3*k,attrs)+vline(Rt(l.w),y1,l.y+3*k,attrs);
  const a=5.5*k,arrow=(x,yy,dir,c)=>`<path d="M${x} ${yy}l${-dir*a} ${-a*0.6}v${a*1.2}z" fill="${c}"/>`;
  const dim=l=>{
    const c=l.key==='cur'?col:theme.muted,tc=l.key==='cur'?col:theme.label,sw=(l.key==='cur'?1.4:1)*k,x0=L(l.w),x1=Rt(l.w),gap=l.tw/2+7*k;
    const ln=l.place==='in'?`<line x1="${x0}" y1="${l.y}" x2="${cx-gap}" y2="${l.y}"/><line x1="${cx+gap}" y1="${l.y}" x2="${x1}" y2="${l.y}"/>`
      :`<line x1="${x0}" y1="${l.y}" x2="${x1}" y2="${l.y}"/>`;
    const tx=l.place==='in'?cx:l.place==='right'?x1+7*k:cx,ty=l.place==='below'?l.y+l.fs*1.15:l.y;
    // outside on the right: other dimension lines' extension lines pass behind the text, so it gets a backing
    const back=l.place==='right'?`<rect x="${tx-3*k}" y="${ty-l.fs*0.7}" width="${l.tw+6*k}" height="${l.fs*1.4}" fill="${theme.bg}"/>`:'';
    return `<g stroke="${c}" stroke-width="${sw}">${ln}</g>${arrow(x0,l.y,-1,c)}${arrow(x1,l.y,1,c)}${back}
      <text x="${tx}" y="${ty}" text-anchor="${l.place==='right'?'start':'middle'}" dominant-baseline="central" font-family="${MONO}"
        font-size="${l.fs}" font-weight="${l.key==='cur'?600:400}" fill="${tc}">${l.text}</text>`;
  };
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${m.title} 단면: ${m.refLabel} ${thick(m.ref,m.layer)}, 1차 리도킹 ${thick(m.prev,m.layer)}, 현재 ${thick(m.cur,m.layer)}">
    <defs><pattern id="${pid}" width="${7*k}" height="${7*k}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="${7*k}" stroke="${theme.hatch}" stroke-width="${1.2*k}"/></pattern></defs>
    <rect x="${L(wOut)}" y="${top}" width="${wOut}" height="${bot-top}" fill="${col}" fill-opacity=".16"/>
    <rect x="${L(cur.w)}" y="${top}" width="${cur.w}" height="${bot-top}" fill="${theme.material[m.layer]}"/>
    <rect x="${L(cur.w)}" y="${top}" width="${cur.w}" height="${bot-top}" fill="url(#${pid})"/>
    ${pair(ref,top-4*k,`stroke="${theme.muted}" stroke-width="${1.4*k}"`)}
    ${pair(prev,top-4*k,`stroke="${theme.label}" stroke-width="${1.6*k}" stroke-dasharray="${2*k} ${3*k}"`)}
    ${pair(cur,top-4*k,`stroke="${col}" stroke-width="${2.4*k}"`)}
    ${rows.map(dim).join('')}
  </svg>`;
}
