/* =========================================================
   보조 시각화 1: S.SHELL 전개도 (SPEC 5.1)
   가로 = 프레임 번호(선미 → 선수), 세로 = 킬 중심선에서의 거스. 위 절반 우현, 가운데 킬 중심선, 아래 절반 좌현.
   로봇 6대: 위 절반은 우현 S1–S3, 아래 절반은 좌현 P1–P3이 선미 → 선수 세 구간을 나눠 맡는다 (baseline.ROBOTS).
   표시(단순화): 선체 외곽선, 가운데 K 선 하나(주황, 왼쪽 K 글자가 라벨), 오른쪽 "우현 / 좌현", 아래 프레임 눈금(100 단위),
         왼쪽 외판열 문자(K부터 세 칸마다), 설계 흘수선(옅은 점선), 킬 블록 측정 불가 구역,
         현재 레이어 히트맵, 선택 지점, 매핑 중 로봇 6대의 위치. 지점을 누르면 메인과 똑같이 선택된다.
   히트맵: 3D와 같은 칠하기(heatmap.createPaint — 도막 두께·강판 두께는 IDW 보간, 도막 손상은 판정 색 고정)를
         저해상도 격자에서 계산해 부드럽게 확대해 칠한다. 선체 외곽선 안, 이상 구역만. 매핑 중에는 0.5초마다 다시 계산한다.
   ========================================================= */
import { T, FS, FRMIN, FRMAX, G, KEEL_HALF, STRAKE_W, LETTERS, section, atGirth, girthAtZ, signedGirth, recordU,
  KEEL_BLOCKS, BLOCK_SIZE, unmeasurable } from './hull.js';
import { COLOR, FS as TYPE, font } from './styles/tokens.js';
import { OK, judge } from './data/criteria.js';
import { buildIndex, nearest, createPaint } from './heatmap.js';
import { ROBOT_MARGIN } from './data/scanPath.js';

const C={bg:COLOR.surface,shell:COLOR.draw.shell,outline:COLOR.draw.outline,keel:COLOR.orange,dwl:COLOR.draw.dwl,tick:COLOR.muted,frLabel:COLOR.peach,text:COLOR.text2};
const LABEL=font(600,TYPE.meta),LETTER=font(400,TYPE.meta),TICK=font(600,TYPE.tick);   // K · 우현/좌현 · strake letters · frame numbers
const M={l:26,r:30,t:12,b:20};   // room around the plot box for the labels (px)
const ASPECT=1.46;                // plot box width : height — kept at any panel size (the default layout's ratio); the box is centred
const PICK_PX=9;                  // click / hover tolerance around an anomaly point
const HEAT_PX=3;                  // heat grid cell (CSS px); drawn scaled up with smoothing
const HEAT_MS=500;                // while mapping: recompute at most this often

/* per-frame girth of the deck edge, the design waterline and the girth bands of the unmeasurable shell (hull.unmeasurable:
   stern gear zone from the keel up; the bulb's nose — around its middle at the tip, thin slivers at its top and bottom further aft),
   found every M_STEP of girth: m = [[g0, g1], …] (FR −6 … 256; Fr(fr) looks one up) */
const M_STEP=0.1,F=[];
for(let fr=FRMIN;fr<=FRMAX;fr++){const X=fr*FS,s=section(X),m=[];let open=null;
  for(let g=0;g<=s.gs[G-1]+1e-6;g+=M_STEP){const p=atGirth(s,Math.min(g,s.gs[G-1])),in_=!!p&&!!unmeasurable(X,p.Z);
    if(in_){if(open)open[1]=g;else m.push(open=[g,g]);}else open=null;}
  F.push({fr,g:s.gs[G-1],wl:girthAtZ(s,T),m});}
export const Fr=fr=>F[Math.max(0,Math.min(F.length-1,Math.round(fr)-FRMIN))];
export const G_MAX=Math.max(...F.map(f=>f.g));
let nStrakes=0;while(nStrakes<LETTERS.length&&KEEL_HALF+STRAKE_W*nStrakes<G_MAX)nStrakes++;

/* ---------- the S.SHELL frame, shared with the 보수 계획 보수 도면 (plan/drawing.js) ----------
   shellBox(w, h): the plot box (CSS px) — the largest ASPECT box that fits inside the canvas less the label margins, centred.
   Everything — outline, heat, markers, ticks, labels — is placed from this box, so nothing stretches with the panel.
   → {bx, by, bw, bh, px(fr), py(u), frOf(x), uOf(y)} */
export function shellBox(w,h){
  const aw=Math.max(1,w-M.l-M.r),ah=Math.max(1,h-M.t-M.b);let bw,bh;
  if(aw/ah>ASPECT){bh=ah;bw=ah*ASPECT;}else{bw=aw;bh=aw/ASPECT;}
  const bx=(w-bw-M.l-M.r)/2+M.l,by=(h-bh-M.t-M.b)/2+M.t;
  return {bx,by,bw,bh,px:fr=>bx+(fr-FRMIN)/(FRMAX-FRMIN)*bw,py:u=>by+(u+G_MAX)/(2*G_MAX)*bh,
    frOf:x=>FRMIN+(x-bx)/bw*(FRMAX-FRMIN),uOf:y=>(y-by)/bh*2*G_MAX-G_MAX};
}
/* the shell outline (deck edge to deck edge) as a path */
export function shellOutline({px,py}){
  const p=new Path2D();
  F.forEach((f,i)=>i?p.lineTo(px(f.fr),py(-f.g)):p.moveTo(px(f.fr),py(-f.g)));
  for(let i=F.length-1;i>=0;i--)p.lineTo(px(F[i].fr),py(F[i].g));p.closePath();
  return p;
}
/* over the content: design waterline, keel line, outline, strake letters, 우현/좌현, frame ticks and numbers */
export function drawShellLines(c,{bx,by,bw,bh,px,py},shellPath){
  c.save();c.clip(shellPath);c.strokeStyle=C.dwl;c.lineWidth=1;c.setLineDash([2,3]);
  [-1,1].forEach(sd=>{c.beginPath();F.forEach((f,i)=>{const y=py(sd*Math.min(f.wl,f.g));i?c.lineTo(px(f.fr),y):c.moveTo(px(f.fr),y);});c.stroke();});
  c.restore();c.setLineDash([]);
  c.strokeStyle=C.keel;c.lineWidth=1;c.beginPath();c.moveTo(bx-4,py(0));c.lineTo(bx+bw+4,py(0));c.stroke();   // K: a little thinner than the outline
  c.strokeStyle=C.outline;c.lineWidth=1.3;c.stroke(shellPath);
  c.textBaseline='middle';
  // strake letters on the left: K, then every third strake (C, F, J, …)
  c.textAlign='right';c.font=LABEL;c.fillStyle=C.keel;c.fillText('K',bx-6,py(0));
  c.font=LETTER;c.fillStyle=C.text;
  for(let k=2;k<nStrakes;k+=3){const g=KEEL_HALF+STRAKE_W*(k+0.5);[-1,1].forEach(sd=>c.fillText(LETTERS[k],bx-6,py(sd*g)));}
  c.textAlign='left';c.font=LABEL;c.fillStyle=C.text;
  c.fillText('우현',bx+bw+4,py(-G_MAX/2));c.fillText('좌현',bx+bw+4,py(G_MAX/2));
  // frame ticks every 5 frames (longer every 10), numbers every 10 frames — or every 50 / 100 when the pane is too narrow for them
  c.strokeStyle=C.tick;c.lineWidth=1;c.beginPath();
  for(let fr=Math.ceil(FRMIN/5)*5;fr<=FRMAX;fr+=5){c.moveTo(px(fr),by+bh);c.lineTo(px(fr),by+bh+(fr%10?2:4));}c.stroke();
  const step=[10,50,100].find(n=>px(n)-px(0)>=26)||100;
  c.textAlign='center';c.textBaseline='top';c.font=TICK;c.fillStyle=C.frLabel;
  for(let fr=0;fr<=FRMAX;fr+=step)c.fillText(String(fr),px(fr),by+bh+5);
}
export const SHELL_FONTS=[LABEL,LETTER,TICK];

export function createSideShell(body,store,ui){
  body.innerHTML='<canvas class="ss-cv" aria-label="S.SHELL 전개도: 가로 프레임 번호, 세로 외판열. 위 우현, 아래 좌현. 이상 지점을 누르면 선택합니다."></canvas>';
  const cv=body.querySelector('canvas'),ctx=cv.getContext('2d');
  // static layers: under the heat (background, shell fill, keel blocks) and over it (lines, labels)
  const under=document.createElement('canvas'),over=document.createElement('canvas'),heat=document.createElement('canvas');
  let w=0,h=0,dpr=1,dots=[],allIx=buildIndex([]),paint=createPaint('plate'),shellPath=null,heatClip=null,robots=null,raf=0,timer=null;
  let box=shellBox(1,1),bx=0,by=0,bw=1,bh=1;
  function layout(){box=shellBox(w,h);({bx,by,bw,bh}=box);}

  const px=fr=>box.px(fr),py=u=>box.py(u),frOf=x=>box.frOf(x),uOf=y=>box.uOf(y);

  function drawBase(){
    shellPath=shellOutline(box);
    // areas that cannot be measured (keel block contact, 수동 측정): not drawn — only the heat leaves them out (heatClip)
    heatClip=new Path2D();heatClip.rect(0,0,w,h);
    KEEL_BLOCKS.forEach(b=>{const hx=(BLOCK_SIZE.dx/2+ROBOT_MARGIN)/FS,hy=BLOCK_SIZE.dy/2+ROBOT_MARGIN,fr=b.X/FS;
      heatClip.rect(px(fr-hx),py(b.Y-hy),Math.max(1,px(fr+hx)-px(fr-hx)),py(b.Y+hy)-py(b.Y-hy));});
    // 수동 측정 areas: each run of frames with the same number of bands as one polygon per band and side — no overlaps for the even-odd clip
    for(let i=0;i<F.length;){const n=F[i].m.length;if(!n){i++;continue;}let j=i;while(j+1<F.length&&F[j+1].m.length===n)j++;const run=F.slice(i,j+1);
      for(let q=0;q<n;q++)[-1,1].forEach(sd=>{const a=run.flatMap(f=>[[px(f.fr-0.5),py(sd*f.m[q][0])],[px(f.fr+0.5),py(sd*f.m[q][0])]]),b=run.flatMap(f=>[[px(f.fr-0.5),py(sd*f.m[q][1])],[px(f.fr+0.5),py(sd*f.m[q][1])]]).reverse();
        [...a,...b].forEach(([x,y],k)=>k?heatClip.lineTo(x,y):heatClip.moveTo(x,y));heatClip.closePath();});i=j+1;}
    // under: background and the whole shell fill
    under.width=over.width=cv.width;under.height=over.height=cv.height;
    let c=under.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);
    c.fillStyle=C.bg;c.fillRect(0,0,w,h);c.fillStyle=C.shell;c.fill(shellPath);
    // over: design waterline, keel line, outline, labels
    c=over.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);
    drawShellLines(c,box,shellPath);
  }

  /* heat field: the current layer's paint (heatmap.createPaint, as in 3D) at every grid cell inside the shell, abnormal only */
  function rebuildHeat(){
    if(!w)return;
    const nx=Math.max(2,Math.ceil(bw/HEAT_PX)),ny=Math.max(2,Math.ceil(bh/HEAT_PX)),o={};
    heat.width=nx;heat.height=ny;const hc=heat.getContext('2d'),img=hc.createImageData(nx,ny),d=img.data;
    for(let i=0;i<nx;i++){
      const fr=FRMIN+(i+0.5)/nx*(FRMAX-FRMIN),g=Fr(fr).g,X=fr*FS;
      for(let j=0;j<ny;j++){
        const u=((j+0.5)/ny*2-1)*G_MAX;if(Math.abs(u)>g)continue;
        paint.at(X,u,o);if(o.a<=0)continue;
        const k=(j*nx+i)*4;d[k]=o.rgb[0];d[k+1]=o.rgb[1];d[k+2]=o.rgb[2];d[k+3]=o.a*255;
      }
    }
    hc.putImageData(img,0,0);
  }

  function rebuildData(){
    const layer=ui.layer,R=store.records;
    dots=[];const all=[];
    for(const r of R){const u=recordU(r),fr=r.X/FS;all.push({X:fr,u,r});
      const j=judge(r,layer);if(j.level!==OK)dots.push({X:fr,u,r,level:j.level});}
    dots.sort((a,b)=>a.level-b.level);   // hover / click: the worse of two close points wins
    allIx=buildIndex(all);   // click: (FR, u)
    paint=createPaint(layer,R);   // heat: (X m, u m), as in 3D
    rebuildHeat();
  }

  function draw(){
    if(!w)return;
    ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(under,0,0);ctx.setTransform(dpr,0,0,dpr,0,0);
    // scaled up with smoothing and a light blur, so the low-res cells read as one soft surface
    ctx.save();ctx.clip(shellPath);ctx.clip(heatClip,'evenodd');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.filter=`blur(${HEAT_PX*0.6}px)`;   // inside the shell, outside the unmeasurable areas
    ctx.drawImage(heat,bx,by,bw,bh);ctx.restore();
    ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(over,0,0);ctx.setTransform(dpr,0,0,dpr,0,0);
    const sel=ui.selId!=null&&store.get(ui.selId);
    if(sel){const x=px(sel.fr),y=py(recordU(sel));
      ctx.strokeStyle=COLOR.draw.crosshair;ctx.lineWidth=1;ctx.setLineDash([2,3]);ctx.beginPath();
      ctx.moveTo(x,by);ctx.lineTo(x,by+bh);ctx.moveTo(bx,y);ctx.lineTo(bx+bw,y);ctx.stroke();ctx.setLineDash([]);
      [[7.5,COLOR.draw.marker],[5.5,COLOR.k100],[2.2,COLOR.draw.marker]].forEach(([rad,col])=>{ctx.fillStyle=col;ctx.beginPath();ctx.arc(x,y,rad,0,Math.PI*2);ctx.fill();});}
    if(robots){const ph=(performance.now()/1000)%1.4/1.4;
      for(const rb of robots){const x=px(rb.X/FS),y=py(rb.u);
        ctx.strokeStyle=COLOR.draw.marker;ctx.globalAlpha=0.7*(1-ph);ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,6+ph*9,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
        ctx.fillStyle=COLOR.k100;ctx.fillRect(x-4.5,y-4.5,9,9);ctx.strokeStyle=COLOR.draw.marker;ctx.lineWidth=1.5;ctx.strokeRect(x-4.5,y-4.5,9,9);}}
  }
  function animate(){draw();raf=robots?requestAnimationFrame(animate):0;}

  function resize(){
    const r=cv.getBoundingClientRect();dpr=Math.min(window.devicePixelRatio||1,2);
    w=Math.max(1,Math.round(r.width));h=Math.max(1,Math.round(r.height));cv.width=w*dpr;cv.height=h*dpr;
    layout();drawBase();rebuildHeat();draw();
  }
  new ResizeObserver(resize).observe(cv);
  // the drawing caches its text: draw again once the web font is in (a canvas does not repaint by itself)
  if(document.fonts){document.fonts.ready.then(resize);document.fonts.addEventListener('loadingdone',resize);
    Promise.all(SHELL_FONTS.map(f=>document.fonts.load(f))).then(resize,()=>{});}

  /* click selection (anomaly point first, else nearest measurement within 3 m); no hover readout — the cursor only marks a point */
  function hit(e){
    const b=cv.getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top,fr=frOf(x),u=uOf(y);
    if(fr<FRMIN||fr>FRMAX||Math.abs(u)>Fr(fr).g)return {inside:false};
    const d=nearestScreen(dots,x,y,PICK_PX),near=d?null:nearest(allIx,fr,u,3);   // (FR, u) ≈ metres: 1 frame = 0.85 m
    return {fr,u,inside:true,dot:d,rec:d?d.r:near&&near.r};
  }
  function nearestScreen(list,x,y,maxPx){let best=null,bd=maxPx*maxPx;
    for(const d of list){const dx=px(d.X)-x,dy=py(d.u)-y,q=dx*dx+dy*dy;if(q<=bd){bd=q;best=d;}}return best;}
  cv.addEventListener('pointermove',e=>{
    const t=hit(e);cv.style.cursor=t.dot?'pointer':'crosshair';
  });
  cv.addEventListener('pointerleave',()=>{cv.style.cursor='';});
  cv.addEventListener('click',e=>{const t=hit(e);if(t.rec)ui.select(t.rec.id,{fly:true});});

  const refresh=()=>{rebuildData();draw();};
  store.subscribe(k=>{
    if(k.has('state')){clearTimeout(timer);timer=null;refresh();}
    else if(k.has('records')&&!timer)timer=setTimeout(()=>{timer=null;refresh();},HEAT_MS);
    if(k.has('pose')||k.has('state')){
      const p=store.mapState==='mapping'||store.mapState==='paused'?store.pose:null;
      robots=p&&p.robots?p.robots.map(r=>({X:r.X,u:signedGirth(r.X,r.Y,r.Z,r.side)})):null;   // all six (baseline.ROBOTS)
      if(robots&&!raf)raf=requestAnimationFrame(animate);else if(!robots)draw();
    }
  });
  ui.subscribe(k=>{if(k==='layer')refresh();if(k==='select')draw();});
  refresh();
}
