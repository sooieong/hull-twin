/* =========================================================
   보고서 차트 (SVG, 인쇄용 흰 바탕): S.SHELL 전개도 (2·3·4장 위치 분포)
   축·단위를 항상 표시한다 (SPEC 6.1).
   ========================================================= */
import { T, R, FS, FRMIN, FRMAX, G, KEEL_HALF, STRAKE_W, LETTERS, section, girthAtZ } from '../hull.js';
import { coverage, createPaint } from '../heatmap.js';
import { COLOR, FONT as TF, rgbOf } from '../styles/tokens.js';   // one font (Pretendard)

export const LV_FILL=COLOR.rp.lvFill;   // 정상 · 주의 · 경고 (대시보드와 같은 판정색)
const MUTED=COLOR.rp.muted,FONT=TF;   // styles/tokens.js

let F=null,GMAX=0;
function frames(){
  if(F)return;F=[];
  for(let fr=FRMIN;fr<=FRMAX;fr++){const s=section(fr*FS);F.push({fr,g:s.gs[G-1],wl:girthAtZ(s,T),b0:girthAtZ(s,0.15),b1:girthAtZ(s,R+0.6)});}
  GMAX=Math.max(...F.map(f=>f.g));
}

/* smooth heat over the plot box (x0, y0, w, h), painted like the dashboard S.SHELL and the 3D pictures (heatmap.createPaint:
   IDW for 도막 두께·강판 두께, fixed damage colours for 도막 손상) on a HEAT_CELL px grid, drawn scaled up with smoothing and a
   light blur → PNG data URI (this SVG becomes an image for the PDF and could not load a file). The measured shell is light grey
   (정상), faded out where the points end (heatmap.coverage); abnormal areas are painted over it */
const HEAT_CELL=2,HEAT_SCALE=2;   // px · the image's pixels per SVG px
function heatImage(records,layer,fr0,fr1,x0,y0,w,h){
  const paint=createPaint(layer,records),nx=Math.ceil(w/HEAT_CELL),ny=Math.ceil(h/HEAT_CELL);
  const small=document.createElement('canvas');small.width=nx;small.height=ny;
  const sc=small.getContext('2d'),img=sc.createImageData(nx,ny),d=img.data,base=rgbOf(COLOR.rp.normalFill),res={};
  for(let i=0;i<nx;i++){const fr=fr0+(i+0.5)/nx*(fr1-fr0),g=F[Math.min(F.length-1,Math.max(0,Math.round(fr)-FRMIN))].g;
    for(let j=0;j<ny;j++){const u=((j+0.5)/ny*2-1)*GMAX;if(Math.abs(u)>g+1)continue;
      paint.at(fr*FS,u,res);const c=coverage(res.w),a=res.a,A=a+c*(1-a);if(A<=0)continue;
      const hc=a>0?res.rgb:base,o=(j*nx+i)*4;
      for(let k=0;k<3;k++)d[o+k]=(hc[k]*a+base[k]*c*(1-a))/A;d[o+3]=A*255;}}
  sc.putImageData(img,0,0);
  const big=document.createElement('canvas');big.width=Math.round(w*HEAT_SCALE);big.height=Math.round(h*HEAT_SCALE);
  const bc=big.getContext('2d');bc.imageSmoothingEnabled=true;bc.imageSmoothingQuality='high';bc.filter=`blur(${HEAT_CELL*HEAT_SCALE*0.6}px)`;
  bc.drawImage(small,0,0,big.width,big.height);
  return `<image href="${big.toDataURL('image/png')}" x="${x0}" y="${y0}" width="${w}" height="${h}" preserveAspectRatio="none"/>`;
}

/* S.SHELL map: frames across, girth down (starboard on top, port below — as on the dashboard)
   smooth heat (heatImage) — measured normal shell light grey, abnormal in the layer's colours */
export function sideShellMap(records,layer,W,H){
  frames();
  const m={l:22,r:30,t:8,b:22},px=fr=>m.l+(fr-FRMIN)/(FRMAX-FRMIN)*(W-m.l-m.r),py=u=>m.t+(u+GMAX)/(2*GMAX)*(H-m.t-m.b);
  const out=[];
  const outline=`M${F.map(f=>`${px(f.fr).toFixed(1)},${py(-f.g).toFixed(1)}`).join('L')}L${F.map(f=>`${px(f.fr).toFixed(1)},${py(f.g).toFixed(1)}`).reverse().join('L')}Z`;
  out.push(`<path d="${outline}" fill="${COLOR.rp.shellFill}"/>`);
  out.push(`<clipPath id="ssClip${layer}"><path d="${outline}"/></clipPath><g clip-path="url(#ssClip${layer})">`);
  out.push(heatImage(records,layer,FRMIN,FRMAX,m.l,m.t,W-m.l-m.r,H-m.t-m.b));
  for(let k=0;k*STRAKE_W+KEEL_HALF<GMAX;k++){const g=KEEL_HALF+STRAKE_W*k;out.push(`<path d="M${m.l} ${py(g)}H${W-m.r}M${m.l} ${py(-g)}H${W-m.r}" stroke="${COLOR.rp.bg}" stroke-width="0.6"/>`);}
  const curve=(key,sd)=>`M${F.map(f=>`${px(f.fr).toFixed(1)},${py(sd*Math.min(f[key],f.g)).toFixed(1)}`).join('L')}`;
  [-1,1].forEach(sd=>{out.push(`<path d="${curve('wl',sd)}" fill="none" stroke="${COLOR.rp.dwl}" stroke-width="1"/>`,
    `<path d="${curve('b1',sd)}" fill="none" stroke="${MUTED}" stroke-width="0.7" stroke-dasharray="3 2"/>`);});
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

