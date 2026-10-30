/* =========================================================
   보수 도면 (SPEC 12.6, 13.5, 13 수정 — 시안 private/보수도면_노란색안_v2.png, 노랑 대신 시그니처 주황):
   S.SHELL 외판 전개도와 같은 외곽선·눈금·K선 (sideShell.js) 위에 판 격자를 옅게 그리고, 판을 단색으로 칠한다. 빗금은 없다.
     보수 범위의 판: 회색이 많이 섞인 조치별 단색 (tokens COLOR.plan: 강판 교체·보강 · 재도장 · 국부 보수·터치업)
     추가한 판: 조치와 상관없이 시그니처 주황 단색
     추가할 수 있는 주의 판: 색 없이 아주 옅은 회색 채움 + 회색 점선 테두리
     지금 고른 판 (오른쪽 판 정보 탭): 흰색 굵은 테두리 (안쪽에 어두운 선 — 주황 판 위에서도 보인다)
   보수 이력 (지난 도킹, plan/view.js): 그때 보수한 판을 조치별 색으로 — 추가·추가 가능 판은 없다.
   누를 수 있는 판은 data.pickable(p)인 판뿐이다 (보수 계획: 보수 단계 1–7 · 보수 이력: 그때 보수한 판).
   그 밖의 판은 커서·강조·툴팁이 없다. 판을 누르면 onPick(id, box) — box = 캔버스 안 판의 자리 (px), 추가 팝업을 그 옆에 띄운다
   (plan/view.js).
   판의 색이 바뀌면 (단계·스위치·추가한 판) 이전 그림에서 0.25초 동안 넘어간다 — 동작 줄이기 설정이면 바로 바뀐다.
   ========================================================= */
import { FS, FRMIN, FRMAX } from '../hull.js';
import { COLOR } from '../styles/tokens.js';
import { shellBox, shellOutline, drawShellLines, Fr, SHELL_FONTS } from '../sideShell.js';
import { kindOf } from './scenario.js';
import { plateLoc, clickable, stepReason } from './plateInfo.js';

export { plateLoc };
export const KIND_LABEL={steel:'강판 교체·보강',paint:'재도장',local:'국부 보수·터치업',added:'직접 추가한 판',cand:'주의 판',changed:'선택한 판',out:'계획 제외'};
/* fills by look: 보수 범위의 조치 · 추가한 판 · 추가 가능 (the 보수 도면 PDF too, plan/output.js) */
export const FILL={steel:COLOR.plan.steel,paint:COLOR.plan.paint,local:COLOR.plan.local,added:COLOR.orange,cand:COLOR.plan.candFill};
/* the look of a plate: 'added' | 'steel' | 'paint' | 'local' (in the plan) · 'cand' (may be put in) · null */
export function lookOf(p,{plan,added,cands}){
  const w=plan.get(p.id);
  if(w)return added.has(p.id)?'added':kindOf(w);
  return cands&&clickable(p)?'cand':null;
}
const FADE=250;   // ms: the plate colours from the last picture to the new one
const still=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createRepairDrawing(body,{onPick}){
  body.insertAdjacentHTML('beforeend','<canvas class="ss-cv rd-cv" aria-label="보수 도면: 가로 프레임 번호, 세로 외판열. 위 우현, 아래 좌현. 판을 누르면 오른쪽 판 정보에 보입니다."></canvas><div class="tip" hidden></div>');
  const cv=body.querySelector('.rd-cv'),ctx=cv.getContext('2d'),tip=body.querySelector('.tip');
  let w=0,h=0,dpr=1,box=shellBox(1,1),shell=null,hover=null;
  let data={plates:[],plan:new Map(),added:new Set(),cands:true,sel:null,pickable:clickable};
  // the colour change: the picture before it (an offscreen copy) laid over the new one, fading out
  let looks='',fade=null,raf=0;const before=document.createElement('canvas');
  const rect=p=>{const x0=box.px(p.x0/FS),x1=box.px(p.x1/FS),y0=box.py(p.uLo),y1=box.py(p.uHi);return [x0,y0,x1-x0,y1-y0];};

  function draw(){
    if(!w)return;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.fillStyle=COLOR.surface;ctx.fillRect(0,0,w,h);ctx.fillStyle=COLOR.draw.shell;ctx.fill(shell);
    ctx.save();ctx.clip(shell);
    // plate grid (faint)
    ctx.strokeStyle=COLOR.line;ctx.lineWidth=1;
    for(const p of data.plates){const [x,y,rw,rh]=rect(p);ctx.strokeRect(x+0.5,y+0.5,rw,rh);}
    // plates: solid fills, a 1px gap to the grid so neighbours stay apart; 추가 가능: faint fill + dashed grey outline
    ctx.lineWidth=1;ctx.strokeStyle=COLOR.plan.candLine;ctx.setLineDash([3,2]);
    for(const p of data.plates){const look=lookOf(p,data);if(!look)continue;
      const [x,y,rw,rh]=rect(p);ctx.fillStyle=FILL[look];ctx.fillRect(x+1,y+1,rw-1,rh-1);
      if(look==='cand')ctx.strokeRect(x+1.5,y+1.5,rw-2,rh-2);}
    ctx.setLineDash([]);ctx.restore();
    drawShellLines(ctx,box,shell);
    // hover, then the selected plate (white, a dark line inside so it reads on the orange)
    if(hover){const [x,y,rw,rh]=rect(hover);ctx.strokeStyle=COLOR.peach;ctx.lineWidth=1;ctx.strokeRect(x+0.5,y+0.5,rw-1,rh-1);}
    const sel=data.sel&&data.plates.find(p=>p.id===data.sel);
    if(sel){const [x,y,rw,rh]=rect(sel);ctx.strokeStyle=COLOR.text;ctx.lineWidth=2.5;ctx.strokeRect(x-1,y-1,rw+2,rh+2);
      ctx.strokeStyle=COLOR.k100;ctx.lineWidth=1;ctx.strokeRect(x+1,y+1,rw-2,rh-2);}
    if(fade!=null){ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1-Math.min(1,(performance.now()-fade)/FADE);ctx.drawImage(before,0,0);ctx.globalAlpha=1;}
  }
  /* the picture as it is now (mid-fade too) → before, then fade it out over the new one */
  function startFade(){
    before.width=cv.width;before.height=cv.height;before.getContext('2d').drawImage(cv,0,0);
    fade=performance.now();if(!raf)raf=requestAnimationFrame(tick);
  }
  function tick(now){raf=0;if(fade==null)return;if(now-fade>=FADE)fade=null;draw();if(fade!=null)raf=requestAnimationFrame(tick);}

  function resize(){
    const r=cv.getBoundingClientRect();if(!r.width||!r.height)return;dpr=Math.min(window.devicePixelRatio||1,2);fade=null;
    w=Math.round(r.width);h=Math.round(r.height);cv.width=w*dpr;cv.height=h*dpr;
    box=shellBox(w,h);shell=shellOutline(box);draw();
  }
  new ResizeObserver(resize).observe(cv);
  if(document.fonts){document.fonts.ready.then(resize);Promise.all(SHELL_FONTS.map(f=>document.fonts.load(f))).then(resize,()=>{});}

  /* the pickable plate under the pointer (inside the shell outline) */
  function hit(e){
    const b=cv.getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top,fr=box.frOf(x),u=box.uOf(y);
    if(fr<FRMIN||fr>FRMAX||Math.abs(u)>Fr(fr).g)return null;
    const X=fr*FS,p=data.plates.find(p=>X>=p.x0&&X<p.x1&&u>=p.uLo&&u<p.uHi);
    return p&&data.pickable(p)?p:null;
  }
  /* P-C12 · 강판 교체·보강 / 강판 감소율 29.2% · 경고 */
  function showTip(p,e){
    if(!p){tip.hidden=true;return;}
    const look=lookOf(p,data),what=look==='cand'?'추가 가능한 주의 판':look==='added'?`${KIND_LABEL.added} · ${KIND_LABEL[kindOf(data.plan.get(p.id))]}`:KIND_LABEL[look];
    tip.innerHTML=`<div class="t1">${p.id}<em> · ${what}</em></div>${p.step?`<div class="t2">${stepReason(p)}</div>`:''}`;
    const b=body.getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top;
    tip.hidden=false;tip.style.left=x+'px';tip.style.top=y+'px';tip.style.transform=x>b.width-260?'translate(calc(-100% - 14px),14px)':'translate(14px,14px)';
  }
  cv.addEventListener('pointermove',e=>{const p=hit(e);cv.style.cursor=p?'pointer':'';
    if(p!==hover){hover=p;draw();}showTip(p,e);});
  cv.addEventListener('pointerleave',()=>{hover=null;tip.hidden=true;cv.style.cursor='';draw();});
  cv.addEventListener('click',e=>{const p=hit(e);if(!p)return;tip.hidden=true;
    const [x,y,rw,rh]=rect(p);onPick(p.id,{x,y,w:rw,h:rh});});

  return {
    /* {plates, plan: Map id → work, added: Set of ids put in by hand, cands: show the plates that may be put in,
        sel: id | null, pickable: p → bool} */
    set(d){data={...data,...d};
      const was=looks;looks=data.plates.map(p=>lookOf(p,data)).join();
      if(w&&was&&looks!==was&&!still())startFade();
      draw();},
    resize
  };
}
