/* =========================================================
   보고서 차트 (SVG, 인쇄용 흰 바탕): S.SHELL 외판 전개도, 히스토그램, 판정 비율 막대
   축·단위·기준선(주의·경고 경계)을 항상 표시한다 (SPEC 6.1).
   ========================================================= */
import { T, R, FS, FRMIN, FRMAX, G, KEEL_HALF, STRAKE_W, LETTERS, section, girthAtZ, recordU } from '../hull.js';
import { OK, judge, isTop } from '../data/criteria.js';
import { GRADE_ICON, GRADE_ICON_DATA } from '../gradeUi.js';
import { heatOf, heatRGB } from '../heatmap.js';
import { COLOR, FONT as TF } from '../styles/tokens.js';
import { GRID } from '../data/baseline.js';

export const LV_FILL=COLOR.rp.lvFill;   // 정상 · 주의 · 경고 (대시보드와 같은 판정색)
const INK=COLOR.rp.text,MUTED=COLOR.rp.muted,GRIDC=COLOR.rp.line,FONT=TF.ui,MONO=TF.mono;   // styles/tokens.js
const rgb=c=>`rgb(${c.map(Math.round).join(',')})`;

let F=null,GMAX=0;
function frames(){
  if(F)return;F=[];
  for(let fr=FRMIN;fr<=FRMAX;fr++){const s=section(fr*FS);F.push({fr,g:s.gs[G-1],wl:girthAtZ(s,T),b0:girthAtZ(s,0.15),b1:girthAtZ(s,R+0.6)});}
  GMAX=Math.max(...F.map(f=>f.g));
}

/* S.SHELL map: frames across, girth down (starboard on top, port below — as on the dashboard)
   mode 'value': every measurement point painted (normal = light grey, abnormal = judgement colour)
   mode 'markers': defects only, with the dashboard's icons — 최우선 보수 = 사이렌, 도막 떨어짐 = 경고, 스크래치 = 주의 (PNG, gradeUi.js) */
export function sideShellMap(records,layer,W,H,mode='value'){
  frames();
  const m={l:22,r:30,t:8,b:22},px=fr=>m.l+(fr-FRMIN)/(FRMAX-FRMIN)*(W-m.l-m.r),py=u=>m.t+(u+GMAX)/(2*GMAX)*(H-m.t-m.b);
  const out=[];
  const outline=`M${F.map(f=>`${px(f.fr).toFixed(1)},${py(-f.g).toFixed(1)}`).join('L')}L${F.map(f=>`${px(f.fr).toFixed(1)},${py(f.g).toFixed(1)}`).reverse().join('L')}Z`;
  out.push(`<path d="${outline}" fill="${COLOR.rp.shellFill}"/>`);
  out.push(`<clipPath id="ssClip${layer}${mode}"><path d="${outline}"/></clipPath><g clip-path="url(#ssClip${layer}${mode})">`);
  if(mode==='value'){
    const cw=Math.max(1,px(GRID/FS)-px(0)),ch=Math.max(1,py(GRID)-py(0));   // one 1.1 m grid cell per point
    for(const r of records){const u=recordU(r),j=judge(r,layer);
      out.push(`<rect x="${(px(r.X/FS)-cw/2).toFixed(1)}" y="${(py(u)-ch/2).toFixed(1)}" width="${cw.toFixed(1)}" height="${ch.toFixed(1)}" fill="${j.level===OK?COLOR.rp.normalFill:rgb(heatRGB(heatOf(r,layer)))}"/>`);}
  }
  for(let k=0;k*STRAKE_W+KEEL_HALF<GMAX;k++){const g=KEEL_HALF+STRAKE_W*k;out.push(`<path d="M${m.l} ${py(g)}H${W-m.r}M${m.l} ${py(-g)}H${W-m.r}" stroke="${COLOR.rp.bg}" stroke-width="0.6"/>`);}
  const curve=(key,sd)=>`M${F.map(f=>`${px(f.fr).toFixed(1)},${py(sd*Math.min(f[key],f.g)).toFixed(1)}`).join('L')}`;
  [-1,1].forEach(sd=>{out.push(`<path d="${curve('wl',sd)}" fill="none" stroke="${COLOR.rp.dwl}" stroke-width="1"/>`,
    `<path d="${curve('b1',sd)}" fill="none" stroke="${MUTED}" stroke-width="0.7" stroke-dasharray="3 2"/>`);});
  if(mode==='markers'){
    // each icon once as a data URI (this SVG becomes an image for the PDF and could not load a file), then <use> per point
    const s=8,id=g=>`mk${g}${layer}`;
    out.push(`<defs>${[1,2,3].map(g=>`<image id="${id(g)}" href="${GRADE_ICON_DATA[g]||GRADE_ICON[g]}" width="${s}" height="${s}"/>`).join('')}</defs>`);
    const dmg=records.filter(r=>r.defect).map(r=>({r,g:isTop(r,'defect')?3:judge(r,'defect').level})).sort((a,b)=>a.g-b.g);   // worst on top
    for(const {r,g} of dmg)out.push(`<use href="#${id(g)}" x="${(px(r.X/FS)-s/2).toFixed(1)}" y="${(py(recordU(r))-s/2).toFixed(1)}"/>`);
  }
  out.push('</g>');
  out.push(`<path d="${outline}" fill="none" stroke="${COLOR.rp.shellLine}" stroke-width="1"/>`);
  out.push(`<path d="M${m.l-3} ${py(0)}H${W-m.r+3}" stroke="${MUTED}" stroke-width="0.8" stroke-dasharray="8 2 2 2"/>`);
  const tx=(x,y,t,o='')=>`<text x="${x}" y="${y}" font-family="${FONT}" font-size="9" fill="${MUTED}" ${o}>${t}</text>`;
  for(let fr=0;fr<=FRMAX;fr+=50)out.push(`<path d="M${px(fr)} ${H-m.b}v3" stroke="${MUTED}"/>`,tx(px(fr),H-m.b+12,fr,'text-anchor="middle"'));
  out.push(tx(m.l-4,H-m.b+12,'FR','text-anchor="end"'),tx(W-m.r+4,py(-GMAX/2),'우현'),tx(W-m.r+4,py(GMAX/2),'좌현'),tx(W-m.r+4,py(0)+3,'C.L.'));
  out.push(tx(m.l-4,py(0)+3,'K','text-anchor="end"'));
  for(let k=0;k<LETTERS.length&&KEEL_HALF+STRAKE_W*k<GMAX;k+=2){const g=KEEL_HALF+STRAKE_W*(k+0.5);out.push(tx(m.l-4,py(-g)+3,LETTERS[k],'text-anchor="end"'),tx(m.l-4,py(g)+3,LETTERS[k],'text-anchor="end"'));}
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">${out.join('')}</svg>`;
}

/* histogram: values (%), bins of `step`, threshold lines {v, label, color}; bars coloured by judgement band */
export function histogram(values,{W,H,min,max,step,xLabel,thresholds,bandOf}){
  const m={l:38,r:10,t:16,b:32},n=Math.ceil((max-min)/step),bins=new Array(n).fill(0);
  values.forEach(v=>{const i=Math.min(n-1,Math.max(0,Math.floor((v-min)/step)));bins[i]++;});
  const top=Math.max(...bins),yMax=Math.ceil(top/50)*50||10,px=v=>m.l+(v-min)/(max-min)*(W-m.l-m.r),py=c=>H-m.b-c/yMax*(H-m.t-m.b);
  const o=[];
  for(let c=0;c<=yMax;c+=yMax/5){o.push(`<path d="M${m.l} ${py(c)}H${W-m.r}" stroke="${GRIDC}"/>`,`<text x="${m.l-5}" y="${py(c)+3}" font-family="${MONO}" font-size="9" fill="${MUTED}" text-anchor="end">${Math.round(c)}</text>`);}
  bins.forEach((c,i)=>{const x0=px(min+i*step),x1=px(min+(i+1)*step);if(c)o.push(`<rect x="${x0+0.6}" y="${py(c)}" width="${Math.max(0.5,x1-x0-1.2)}" height="${H-m.b-py(c)}" fill="${LV_FILL[bandOf(min+(i+0.5)*step)]}"/>`);});
  for(let v=min;v<=max;v+=step*2)o.push(`<path d="M${px(v)} ${H-m.b}v4" stroke="${MUTED}"/>`,`<text x="${px(v)}" y="${H-m.b+14}" font-family="${MONO}" font-size="9" fill="${MUTED}" text-anchor="middle">${v}</text>`);
  o.push(`<path d="M${m.l} ${H-m.b}H${W-m.r}M${m.l} ${m.t}V${H-m.b}" stroke="${INK}" stroke-width="1"/>`);
  thresholds.forEach(t=>o.push(`<path d="M${px(t.v)} ${m.t-4}V${H-m.b}" stroke="${t.color}" stroke-width="1.4" stroke-dasharray="4 3"/>`,
    `<text x="${px(t.v)+4}" y="${m.t+6}" font-family="${FONT}" font-size="10" font-weight="600" fill="${t.color}">${t.label}</text>`));
  o.push(`<text x="${(m.l+W-m.r)/2}" y="${H-4}" font-family="${FONT}" font-size="10" fill="${MUTED}" text-anchor="middle">${xLabel}</text>`,
    `<text x="10" y="${(m.t+H-m.b)/2}" font-family="${FONT}" font-size="10" fill="${MUTED}" text-anchor="middle" transform="rotate(-90 10 ${(m.t+H-m.b)/2})">측정점 수</text>`);
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">${o.join('')}</svg>`;
}

/* stacked judgement bar with percentages */
export function ratioBar(counts,W=300,H=14){
  const total=counts.reduce((a,b)=>a+b,0)||1;let x=0;const o=[];
  counts.forEach((c,i)=>{const w=c/total*W;if(w>0)o.push(`<rect x="${x}" y="0" width="${w}" height="${H}" fill="${LV_FILL[i]}"/>`);x+=w;});
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">${o.join('')}</svg>`;
}
