/* =========================================================
   보조 시각화 1: Side Shell 전개도 (SPEC 5.1)
   가로 = 프레임 번호(선미 → 선수), 세로 = 킬 중심선에서의 거스. 위 절반 우현, 가운데 킬 중심선, 아래 절반 좌현.
   로봇 경로(우현 갑판 → 킬 → 좌현 갑판)가 위에서 아래로 진행한다.
   표시: 외판열 경계와 문자, 프레임 눈금(50 단위), 흘수선·빌지 경계, 킬 블록 측정 불가 구역,
         현재 레이어의 이상 지점, 선택 지점, 매핑 중 로봇 위치. 지점을 누르면 메인과 똑같이 선택된다.
   ========================================================= */
import { T, R, FS, FRMAX, G, KEEL_HALF, STRAKE_W, LETTERS, section, girthAtZ, strakeName, signedGirth, recordU,
  KEEL_BLOCKS, BLOCK_SIZE } from './hull.js';
import { OK, judge, LAYER_LABEL, LEVEL_LABEL, formatValue } from './data/criteria.js';
import { heatOf, heatRGB, buildIndex, nearest } from './heatmap.js';
import { ROBOT_MARGIN } from './data/scanPath.js';

const C={bg:'#070C17',shell:'#0E1628',hatch:'rgba(111,124,147,.22)',outline:'#C9D3E3',seam:'#2A3A58',cl:'#6F7C93',
  dwl:'#4A6FB0',bilge:'#6F7C93',tick:'#6F7C93',frLabel:'#FBB584',text:'#A7B3C7',muted:'#6F7C93'};
const MONO='"IBM Plex Mono",ui-monospace,monospace',LBL='"Barlow Condensed","IBM Plex Sans KR",sans-serif';
const M={l:26,r:30,t:12,b:24};   // plot margins (px)
const PICK_PX=9;                  // click / hover tolerance around an anomaly dot

/* per-frame girth of deck edge, waterline and bilge boundaries (zone limits as in hull.zoneOf) */
const F=[];
for(let fr=0;fr<=FRMAX;fr++){const s=section(fr*FS);
  F.push({g:s.gs[G-1],wl:girthAtZ(s,T),b0:girthAtZ(s,0.15),b1:girthAtZ(s,R+0.6)});}
const G_MAX=Math.max(...F.map(f=>f.g));
let nStrakes=0;while(nStrakes<LETTERS.length&&KEEL_HALF+STRAKE_W*nStrakes<G_MAX)nStrakes++;

export function createSideShell(body,store,ui){
  body.innerHTML='<canvas class="ss-cv" aria-label="Side Shell 전개도: 가로 프레임 번호, 세로 외판열. 위 우현, 아래 좌현. 이상 지점을 누르면 선택합니다."></canvas><div class="ss-read" aria-live="polite"></div>';
  const cv=body.querySelector('canvas'),ctx=cv.getContext('2d'),read=body.querySelector('.ss-read');
  const base=document.createElement('canvas'),bctx=base.getContext('2d');
  let w=0,h=0,dpr=1,dots=[],allIx=buildIndex([]),robot=null,raf=0,timer=null;

  const px=fr=>M.l+fr/FRMAX*(w-M.l-M.r);
  const py=u=>M.t+(u+G_MAX)/(2*G_MAX)*(h-M.t-M.b);
  const frOf=x=>(x-M.l)/(w-M.l-M.r)*FRMAX;
  const uOf=y=>(y-M.t)/(h-M.t-M.b)*2*G_MAX-G_MAX;

  /* static drawing: shell outline, seams, boundaries, labels */
  function drawBase(){
    base.width=cv.width;base.height=cv.height;const c=bctx;c.setTransform(dpr,0,0,dpr,0,0);
    c.fillStyle=C.bg;c.fillRect(0,0,w,h);
    // outside the shell: light hatch, like a shell expansion drawing
    c.save();c.beginPath();c.rect(M.l,M.t,w-M.l-M.r,h-M.t-M.b);c.clip();
    c.strokeStyle=C.hatch;c.lineWidth=1;c.beginPath();for(let x=-h;x<w;x+=7){c.moveTo(x,h);c.lineTo(x+h,0);}c.stroke();c.restore();
    const outline=()=>{c.beginPath();F.forEach((f,fr)=>fr?c.lineTo(px(fr),py(-f.g)):c.moveTo(px(fr),py(-f.g)));
      for(let fr=FRMAX;fr>=0;fr--)c.lineTo(px(fr),py(F[fr].g));c.closePath();};
    outline();c.fillStyle=C.shell;c.fill();
    // strake seams (only inside the shell)
    c.save();outline();c.clip();
    c.strokeStyle=C.seam;c.lineWidth=1;c.beginPath();
    for(let k=0;k<=nStrakes;k++){const g=KEEL_HALF+STRAKE_W*k;[-1,1].forEach(sd=>{c.moveTo(M.l,py(sd*g));c.lineTo(w-M.r,py(sd*g));});}c.stroke();
    // frame grid every 10, stronger every 50
    for(let fr=10;fr<=FRMAX;fr+=10){c.strokeStyle=fr%50?'rgba(42,58,88,.45)':'rgba(111,124,147,.55)';c.beginPath();c.moveTo(px(fr),M.t);c.lineTo(px(fr),h-M.b);c.stroke();}
    // zone boundaries: bilge (dashed) and design waterline
    const curve=(key,sd)=>{c.beginPath();F.forEach((f,fr)=>{const y=py(sd*Math.min(f[key],f.g));fr?c.lineTo(px(fr),y):c.moveTo(px(fr),y);});c.stroke();};
    c.setLineDash([3,3]);c.strokeStyle=C.bilge;[-1,1].forEach(sd=>{curve('b0',sd);curve('b1',sd);});
    c.setLineDash([]);c.strokeStyle=C.dwl;c.lineWidth=1.4;[-1,1].forEach(sd=>curve('wl',sd));
    // keel / side block contact areas: not measurable
    c.fillStyle='rgba(138,150,170,.35)';
    KEEL_BLOCKS.forEach(b=>{const hx=(BLOCK_SIZE.dx/2+ROBOT_MARGIN)/FS,hy=BLOCK_SIZE.dy/2+ROBOT_MARGIN,fr=b.X/FS;
      c.fillRect(px(fr-hx),py(b.Y-hy),Math.max(1,px(fr+hx)-px(fr-hx)),py(b.Y+hy)-py(b.Y-hy));});
    c.restore();
    // keel CL: port / starboard switch
    c.strokeStyle=C.cl;c.lineWidth=1;c.setLineDash([10,3,2,3]);c.beginPath();c.moveTo(M.l-4,py(0));c.lineTo(w-M.r+4,py(0));c.stroke();c.setLineDash([]);
    outline();c.strokeStyle=C.outline;c.lineWidth=1.3;c.stroke();
    // labels
    c.textBaseline='middle';
    c.font=`500 9px ${MONO}`;c.fillStyle=C.text;c.textAlign='right';
    const bandPx=py(STRAKE_W)-py(0),every=bandPx<9?2:1;
    c.fillText('K',M.l-6,py(0));
    for(let k=0;k<nStrakes;k+=every){const g=KEEL_HALF+STRAKE_W*(k+0.5);[-1,1].forEach(sd=>c.fillText(LETTERS[k],M.l-6,py(sd*g)));}
    c.textAlign='left';c.font=`600 11px ${LBL}`;c.fillStyle=C.text;
    c.fillText('S',w-M.r+8,py(-G_MAX/2));c.fillText('P',w-M.r+8,py(G_MAX/2));
    c.font=`9px "IBM Plex Sans KR",sans-serif`;c.fillStyle=C.muted;
    c.fillText('우현',w-M.r+4,py(-G_MAX/2)+13);c.fillText('좌현',w-M.r+4,py(G_MAX/2)+13);
    c.font=`9px ${MONO}`;c.fillStyle=C.muted;c.fillText('C.L.',w-M.r+6,py(0)-8);
    c.font=`500 9px ${MONO}`;c.fillStyle=C.dwl;c.textAlign='left';
    const fw=Math.round(FRMAX*0.97);c.fillText('DWL',px(fw)-22,py(-F[fw].wl)-6);
    const fb=Math.round(FRMAX*0.5);c.fillStyle=C.bilge;c.textAlign='center';c.fillText('BILGE',px(fb),py(-(F[fb].b0+F[fb].b1)/2));
    c.textAlign='center';c.textBaseline='top';c.font=`600 10px ${LBL}`;
    for(let fr=0;fr<=FRMAX;fr+=50){c.fillStyle=C.frLabel;c.fillText(String(fr),px(fr),h-M.b+5);}
    c.font=`9px ${MONO}`;c.fillStyle=C.muted;c.textAlign='left';c.fillText('FR',2,h-M.b+6);
    c.textAlign='right';c.fillText('AFT → FWD',w-M.r,h-M.b+14);
  }

  function rebuildDots(){
    const layer=ui.layer,R=store.records;
    dots=[];const all=[];
    for(const r of R){const u=recordU(r);all.push({X:r.fr,u,r});const j=judge(r,layer);if(j.level===OK)continue;
      dots.push({X:r.fr,u,r,level:j.level,rgb:heatRGB(heatOf(r,layer))});}
    dots.sort((a,b)=>a.level-b.level);   // severe on top
    allIx=buildIndex(all);   // index on (FR, u)
  }

  function draw(){
    if(!w)return;
    ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(base,0,0);ctx.setTransform(dpr,0,0,dpr,0,0);
    for(const d of dots){ctx.fillStyle=`rgb(${d.rgb.map(Math.round).join(',')})`;ctx.beginPath();
      ctx.arc(px(d.X),py(d.u),d.level>1?3:2.4,0,Math.PI*2);ctx.fill();}
    const sel=ui.selId!=null&&store.get(ui.selId);
    if(sel){const x=px(sel.fr),y=py(recordU(sel));
      ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=1;ctx.setLineDash([2,3]);ctx.beginPath();
      ctx.moveTo(x,M.t);ctx.lineTo(x,h-M.b);ctx.moveTo(M.l,y);ctx.lineTo(w-M.r,y);ctx.stroke();ctx.setLineDash([]);
      [[7.5,'#fff'],[5.5,'#000'],[2.2,'#fff']].forEach(([rad,col])=>{ctx.fillStyle=col;ctx.beginPath();ctx.arc(x,y,rad,0,Math.PI*2);ctx.fill();});
      const label=`FR ${sel.fr} · ${sel.strake}(${sel.side})`;ctx.font=`600 11px ${LBL}`;
      const tw=ctx.measureText(label).width+10,lx=Math.min(Math.max(M.l,x-tw/2),w-M.r-tw),ly=y-11<M.t+14?y+11:y-25;
      ctx.fillStyle='rgba(3,6,12,.9)';ctx.fillRect(lx,ly,tw,15);ctx.strokeStyle='#fff';ctx.strokeRect(lx+.5,ly+.5,tw-1,14);
      ctx.fillStyle='#fff';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(label,lx+5,ly+8);}
    if(robot){const x=px(robot.X/FS),y=py(robot.u),ph=(performance.now()/1000)%1.4/1.4;
      ctx.strokeStyle=`rgba(255,255,255,${0.7*(1-ph)})`;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,6+ph*9,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle='#000';ctx.fillRect(x-4.5,y-4.5,9,9);ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.strokeRect(x-4.5,y-4.5,9,9);}
  }
  function animate(){draw();raf=robot?requestAnimationFrame(animate):0;}

  function resize(){
    const r=cv.getBoundingClientRect();dpr=Math.min(window.devicePixelRatio||1,2);
    w=Math.max(1,Math.round(r.width));h=Math.max(1,Math.round(r.height));cv.width=w*dpr;cv.height=h*dpr;
    drawBase();draw();
  }
  new ResizeObserver(resize).observe(cv);
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(resize);

  /* hover readout + click selection (anomaly dot first, else nearest measurement within 3 m) */
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
    if(!t.inside){read.textContent='';return;}
    const r=t.dot&&t.dot.r,pos=r?`FR ${r.fr} · ${r.strake}(${r.side})`:`FR ${Math.round(t.fr)} · ${strakeName(Math.abs(t.u))}(${t.u<0?'S':'P'})`;
    read.textContent=t.dot?`${pos} · ${LAYER_LABEL[ui.layer]} ${formatValue(t.dot.r,ui.layer)} · ${LEVEL_LABEL[t.dot.level]}`:pos;
  });
  cv.addEventListener('pointerleave',()=>{read.textContent='';cv.style.cursor='';});
  cv.addEventListener('click',e=>{const t=hit(e);if(t.rec)ui.select(t.rec.id);});

  const refresh=()=>{rebuildDots();draw();};
  store.subscribe(k=>{
    if(k.has('state')){clearTimeout(timer);timer=null;rebuildDots();}
    else if(k.has('records')&&!timer)timer=setTimeout(()=>{timer=null;refresh();},200);
    if(k.has('pose')||k.has('state')){
      const p=store.mapState==='mapping'?store.pose:null;
      robot=p?{X:p.X,u:signedGirth(p.X,p.Y,p.Z,p.side)}:null;
      if(robot&&!raf)raf=requestAnimationFrame(animate);else if(!robot)draw();
    }
  });
  ui.subscribe(k=>{if(k==='layer')refresh();if(k==='select')draw();});
  refresh();
}
