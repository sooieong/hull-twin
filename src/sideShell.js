/* =========================================================
   보조 시각화 1: S.SHELL 외판 전개도 (SPEC 5.1)
   가로 = 프레임 번호(선미 → 선수), 세로 = 킬 중심선에서의 거스. 위 절반 우현, 가운데 킬 중심선, 아래 절반 좌현.
   로봇 경로(우현 갑판 → 킬 → 좌현 갑판)가 위에서 아래로 진행한다.
   표시(단순화): 선체 외곽선, 가운데 K 선 하나(주황, 왼쪽 K 글자가 라벨), 오른쪽 "우현 / 좌현", 아래 프레임 눈금(100 단위),
         왼쪽 외판열 문자(K부터 세 칸마다), 설계 흘수선(옅은 점선), 킬 블록 측정 불가 구역,
         현재 레이어 히트맵, 선택 지점, 매핑 중 로봇 위치. 지점을 누르면 메인과 똑같이 선택된다.
   히트맵: 3D와 같은 IDW 보간(heatmap.js)을 저해상도 격자에서 계산해 부드럽게 확대해 칠한다.
         선체 외곽선 안, 이상 구역만 (색: 앰버 → 레드). 매핑 중에는 0.5초마다 다시 계산한다.
   ========================================================= */
import { T, FS, FRMAX, G, KEEL_HALF, STRAKE_W, LETTERS, section, girthAtZ, signedGirth, recordU,
  KEEL_BLOCKS, BLOCK_SIZE } from './hull.js';
import { OK, judge } from './data/criteria.js';
import { heatOf, heatRGB, heatAlpha, buildIndex, idw, nearest } from './heatmap.js';
import { ROBOT_MARGIN } from './data/scanPath.js';

const C={bg:'#070C17',shell:'#0E1628',outline:'#C9D3E3',keel:'#F37321',dwl:'rgba(122,150,200,.5)',tick:'#6F7C93',frLabel:'#FBB584',text:'#A7B3C7'};
const MONO='"IBM Plex Mono",ui-monospace,monospace',LBL='"Barlow Condensed","IBM Plex Sans KR",sans-serif',SIDE_FONT='500 10px "IBM Plex Sans KR",sans-serif';
const M={l:26,r:30,t:12,b:20};   // plot margins (px)
const PICK_PX=9;                  // click / hover tolerance around an anomaly point
const HEAT_PX=3;                  // heat grid cell (CSS px); drawn scaled up with smoothing
const HEAT_MS=500;                // while mapping: recompute at most this often

/* per-frame girth of the deck edge and the design waterline */
const F=[];
for(let fr=0;fr<=FRMAX;fr++){const s=section(fr*FS);F.push({g:s.gs[G-1],wl:girthAtZ(s,T)});}
const G_MAX=Math.max(...F.map(f=>f.g));
let nStrakes=0;while(nStrakes<LETTERS.length&&KEEL_HALF+STRAKE_W*nStrakes<G_MAX)nStrakes++;

export function createSideShell(body,store,ui){
  body.innerHTML='<canvas class="ss-cv" aria-label="S.SHELL 외판 전개도: 가로 프레임 번호, 세로 외판열. 위 우현, 아래 좌현. 이상 지점을 누르면 선택합니다."></canvas>';
  const cv=body.querySelector('canvas'),ctx=cv.getContext('2d');
  // static layers: under the heat (background, shell fill, keel blocks) and over it (lines, labels)
  const under=document.createElement('canvas'),over=document.createElement('canvas'),heat=document.createElement('canvas');
  let w=0,h=0,dpr=1,dots=[],allIx=buildIndex([]),heatIx=buildIndex([]),shellPath=null,robot=null,raf=0,timer=null;

  const px=fr=>M.l+fr/FRMAX*(w-M.l-M.r);
  const py=u=>M.t+(u+G_MAX)/(2*G_MAX)*(h-M.t-M.b);
  const frOf=x=>(x-M.l)/(w-M.l-M.r)*FRMAX;
  const uOf=y=>(y-M.t)/(h-M.t-M.b)*2*G_MAX-G_MAX;

  function drawBase(){
    shellPath=new Path2D();
    F.forEach((f,fr)=>fr?shellPath.lineTo(px(fr),py(-f.g)):shellPath.moveTo(px(fr),py(-f.g)));
    for(let fr=FRMAX;fr>=0;fr--)shellPath.lineTo(px(fr),py(F[fr].g));shellPath.closePath();
    // under: background, shell fill, keel / side block contact areas (not measurable)
    under.width=over.width=cv.width;under.height=over.height=cv.height;
    let c=under.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);
    c.fillStyle=C.bg;c.fillRect(0,0,w,h);c.fillStyle=C.shell;c.fill(shellPath);
    c.save();c.clip(shellPath);c.fillStyle='rgba(138,150,170,.35)';
    KEEL_BLOCKS.forEach(b=>{const hx=(BLOCK_SIZE.dx/2+ROBOT_MARGIN)/FS,hy=BLOCK_SIZE.dy/2+ROBOT_MARGIN,fr=b.X/FS;
      c.fillRect(px(fr-hx),py(b.Y-hy),Math.max(1,px(fr+hx)-px(fr-hx)),py(b.Y+hy)-py(b.Y-hy));});
    c.restore();
    // over: design waterline, keel line, outline, labels
    c=over.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);
    c.save();c.clip(shellPath);c.strokeStyle=C.dwl;c.lineWidth=1;c.setLineDash([2,3]);
    [-1,1].forEach(sd=>{c.beginPath();F.forEach((f,fr)=>{const y=py(sd*Math.min(f.wl,f.g));fr?c.lineTo(px(fr),y):c.moveTo(px(fr),y);});c.stroke();});
    c.restore();c.setLineDash([]);
    c.strokeStyle=C.keel;c.lineWidth=1;c.beginPath();c.moveTo(M.l-4,py(0));c.lineTo(w-M.r+4,py(0));c.stroke();   // K: a little thinner than the outline
    c.strokeStyle=C.outline;c.lineWidth=1.3;c.stroke(shellPath);
    c.textBaseline='middle';
    // strake letters on the left: K, then every third strake (C, F, J, …)
    c.textAlign='right';c.font=SIDE_FONT;c.fillStyle=C.keel;c.fillText('K',M.l-6,py(0));
    c.font=`500 9px ${MONO}`;c.fillStyle=C.text;
    for(let k=2;k<nStrakes;k+=3){const g=KEEL_HALF+STRAKE_W*(k+0.5);[-1,1].forEach(sd=>c.fillText(LETTERS[k],M.l-6,py(sd*g)));}
    c.textAlign='left';c.font=SIDE_FONT;c.fillStyle=C.text;
    c.fillText('우현',w-M.r+4,py(-G_MAX/2));c.fillText('좌현',w-M.r+4,py(G_MAX/2));
    // frame ticks and numbers every 100
    c.strokeStyle=C.tick;c.lineWidth=1;c.beginPath();
    for(let fr=0;fr<=FRMAX;fr+=100){c.moveTo(px(fr),h-M.b);c.lineTo(px(fr),h-M.b+4);}c.stroke();
    c.textAlign='center';c.textBaseline='top';c.font=`600 10px ${LBL}`;c.fillStyle=C.frLabel;
    for(let fr=0;fr<=FRMAX;fr+=100)c.fillText(String(fr),px(fr),h-M.b+5);
  }

  /* heat field: IDW of the current layer at every grid cell inside the shell, abnormal only (same as 3D) */
  function rebuildHeat(){
    if(!w)return;
    const pw=w-M.l-M.r,ph=h-M.t-M.b,nx=Math.max(2,Math.ceil(pw/HEAT_PX)),ny=Math.max(2,Math.ceil(ph/HEAT_PX));
    heat.width=nx;heat.height=ny;const hc=heat.getContext('2d'),img=hc.createImageData(nx,ny),d=img.data;
    for(let i=0;i<nx;i++){
      const fr=(i+0.5)/nx*FRMAX,g=F[Math.min(FRMAX,Math.round(fr))].g,X=fr*FS;
      for(let j=0;j<ny;j++){
        const u=((j+0.5)/ny*2-1)*G_MAX;if(Math.abs(u)>g)continue;
        const v=idw(heatIx,X,u),a=heatAlpha(v);if(a<=0)continue;
        const rgb=heatRGB(v),o=(j*nx+i)*4;d[o]=rgb[0];d[o+1]=rgb[1];d[o+2]=rgb[2];d[o+3]=a*255;
      }
    }
    hc.putImageData(img,0,0);
  }

  function rebuildData(){
    const layer=ui.layer,R=store.records;
    dots=[];const all=[],hs=[];
    for(const r of R){const u=recordU(r),hv=heatOf(r,layer);all.push({X:r.fr,u,r});hs.push({X:r.X,u,h:hv});
      const j=judge(r,layer);if(j.level!==OK)dots.push({X:r.fr,u,r,level:j.level});}
    dots.sort((a,b)=>a.level-b.level);   // hover / click: the worse of two close points wins
    allIx=buildIndex(all);   // click: (FR, u)
    heatIx=buildIndex(hs);   // heat: (X m, u m), as in 3D
    rebuildHeat();
  }

  function draw(){
    if(!w)return;
    ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(under,0,0);ctx.setTransform(dpr,0,0,dpr,0,0);
    // scaled up with smoothing and a light blur, so the low-res cells read as one soft surface
    ctx.save();ctx.clip(shellPath);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.filter=`blur(${HEAT_PX*0.6}px)`;
    ctx.drawImage(heat,M.l,M.t,w-M.l-M.r,h-M.t-M.b);ctx.restore();
    ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(over,0,0);ctx.setTransform(dpr,0,0,dpr,0,0);
    const sel=ui.selId!=null&&store.get(ui.selId);
    if(sel){const x=px(sel.fr),y=py(recordU(sel));
      ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=1;ctx.setLineDash([2,3]);ctx.beginPath();
      ctx.moveTo(x,M.t);ctx.lineTo(x,h-M.b);ctx.moveTo(M.l,y);ctx.lineTo(w-M.r,y);ctx.stroke();ctx.setLineDash([]);
      [[7.5,'#fff'],[5.5,'#000'],[2.2,'#fff']].forEach(([rad,col])=>{ctx.fillStyle=col;ctx.beginPath();ctx.arc(x,y,rad,0,Math.PI*2);ctx.fill();});}
    if(robot){const x=px(robot.X/FS),y=py(robot.u),ph=(performance.now()/1000)%1.4/1.4;
      ctx.strokeStyle=`rgba(255,255,255,${0.7*(1-ph)})`;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,6+ph*9,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle='#000';ctx.fillRect(x-4.5,y-4.5,9,9);ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.strokeRect(x-4.5,y-4.5,9,9);}
  }
  function animate(){draw();raf=robot?requestAnimationFrame(animate):0;}

  function resize(){
    const r=cv.getBoundingClientRect();dpr=Math.min(window.devicePixelRatio||1,2);
    w=Math.max(1,Math.round(r.width));h=Math.max(1,Math.round(r.height));cv.width=w*dpr;cv.height=h*dpr;
    drawBase();rebuildHeat();draw();
  }
  new ResizeObserver(resize).observe(cv);
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(resize);

  /* click selection (anomaly point first, else nearest measurement within 3 m); no hover readout — the cursor only marks a point */
  function hit(e){
    const b=cv.getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top,fr=frOf(x),u=uOf(y);
    if(fr<0||fr>FRMAX||Math.abs(u)>F[Math.round(fr)].g)return {inside:false};
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
      robot=p?{X:p.X,u:signedGirth(p.X,p.Y,p.Z,p.side)}:null;
      if(robot&&!raf)raf=requestAnimationFrame(animate);else if(!robot)draw();
    }
  });
  ui.subscribe(k=>{if(k==='layer')refresh();if(k==='select')draw();});
  refresh();
}
