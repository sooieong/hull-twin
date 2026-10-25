import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

(function(){
"use strict";
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmt=(n,d=2)=>n.toFixed(d);

/* ---------- toast + placeholders ---------- */
const toastEl=$('#toast');let toastT;
function toast(m){toastEl.textContent=m;toastEl.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>{toastEl.hidden=true;},2400);}
document.querySelectorAll('.rail button[data-soon]').forEach(b=>b.addEventListener('click',()=>toast(`'${b.dataset.label}' 화면은 다음 단계에서 구성합니다`)));
$('#dockSel').addEventListener('change',()=>toast('도킹 이력 비교는 측정 데이터 연결 후 활성화됩니다'));

/* =========================================================
   HULL FORM  (example: 174K LNG Carrier, parametric)
   Ship CS: X from AP (+fwd), Y half-breadth (+port), Z from baseline
   ========================================================= */
const L=289, B=46.4, D=26.5, T=11.5, R=2.6, FS=0.85;
const XMAX=L+9.6, XC=XMAX/2, FRMAX=Math.floor(XMAX/FS);
const NX=300, NB=6, NS=48, G=NB+1+NS;
const KEEL_HALF=1.6, STRAKE_W=3.2, LETTERS="ABCDEFGHJLMNPQRSTUV";

function deckZ(X){const xn=X/L;return D+(xn>0.86?3.2*Math.pow(Math.min((xn-0.86)/0.16,1.1),2):0);}
function keelZ(X){const xn=X/L;if(xn<0.05){const t=(0.05-xn)/0.05;return 9.5*t*t;}return 0;}
function rake(Z){return 7.0*Math.pow(clamp(Z/D,0,1.3),1.6);}
function midHB(Z){if(Z>=R)return B/2;const dz=R-Z;return B/2-R+Math.sqrt(Math.max(0,R*R-dz*dz));}
function hullHB(X,Z){
  if(X<0||Z<keelZ(X)-1e-6||Z>deckZ(X)+1e-6)return 0;
  const zn=clamp(Z/D,0,1);let w=1;
  const xnf=(X-rake(Z))/L;
  if(xnf>=1)return 0;
  if(xnf>0.70){const t=(xnf-0.70)/0.30;w*=Math.max(0,1-Math.pow(t,1.6+2.4*zn));}
  const xn=X/L;
  if(xn<0.24){const t=(0.24-xn)/0.24;const p=0.6+2.6*zn;const tw=0.80*smooth(0.30,0.85,zn);w*=1-Math.pow(t,p)*(1-tw);}
  return midHB(Z)*w;
}
function bulbHB(X,Z){const u=((X-(L+2.5))/7)**2+((Z-6)/4.6)**2;return u>=1?0:3.4*Math.sqrt(1-u);}
function HB(X,Z){return Math.max(hullHB(X,Z),Z>=0?bulbHB(X,Z):0);}

function section(X){
  const zk=keelZ(X),zd=deckZ(X);
  const Ys=new Float32Array(G),Zs=new Float32Array(G),gs=new Float32Array(G);
  const yb=HB(X,zk);
  for(let j=0;j<=NB;j++){Ys[j]=yb*j/NB;Zs[j]=zk;}
  for(let k=1;k<=NS;k++){const s=k/NS;const Z=zk+(zd-zk)*Math.pow(s,1.5);Ys[NB+k]=HB(X,Z);Zs[NB+k]=Z;}
  for(let j=1;j<G;j++)gs[j]=gs[j-1]+Math.hypot(Ys[j]-Ys[j-1],Zs[j]-Zs[j-1]);
  return {Ys,Zs,gs,yb};
}
function strakeName(g){if(g<KEEL_HALF)return 'K';const i=Math.floor((g-KEEL_HALF)/STRAKE_W);return LETTERS[Math.min(i,LETTERS.length-1)];}
const ZONES=['선저부','빌지부','선측 수선 아래','흘수선 부근','건현부','선수부','선미부'];
function zoneOf(X,Z){const xn=X/L;if(xn>=0.9)return 5;if(xn<0.08)return 6;if(Z<0.15)return 0;if(Z<R+0.6)return 1;if(Z<T-1.2)return 2;if(Z<T+1.6)return 3;return 4;}
function regionOf(X){const xn=X/L;if(xn<0.08)return '선미부';if(xn<0.24)return '선미 곡면부';if(xn<0.70)return '평행 중앙부';if(xn<0.9)return '선수 곡면부';return '선수부';}
function foreX(Z){let x=-1;const xs=L+rake(Z);if(Z<=deckZ(xs))x=xs;const u=(Z-6)/4.6;if(Math.abs(u)<1)x=Math.max(x,L+2.5+7*Math.sqrt(1-u*u));return x;}
function aftX(Z){return Z>=keelZ(0)?0:0.05*L*(1-Math.sqrt(Z/9.5));}
let ZTOP=D;for(let z=24;z<34;z+=0.01){if(z<=deckZ(L+rake(z)))ZTOP=z;}
const XSTEM_TOP=L+rake(ZTOP);

const stX=new Float32Array(NX+1),stSec=[];
for(let i=0;i<=NX;i++){stX[i]=XMAX*i/NX;stSec.push(section(stX[i]));}

/* ---------- robot scan path (example run, starboard side) ---------- */
const robot={pts:[],cum:[],s:0,idx:0,paused:reduce,hold:0,speed:3.6};
(function(){
  const Zs=[2.6,3.9,5.2,6.5,7.8,9.1,10.4],x0=132,x1=168;let dir=1;const P=[];
  Zs.forEach((Z,k)=>{const a=dir>0?x0:x1,b=dir>0?x1:x0;const n=90;
    for(let t=0;t<=n;t++)P.push([a+(b-a)*t/n,Z]);
    if(k<Zs.length-1){const Zn=Zs[k+1];for(let t=1;t<4;t++)P.push([b,Z+(Zn-Z)*t/4]);}
    dir*=-1;});
  robot.pts=P;robot.cum=[0];for(let i=1;i<P.length;i++)robot.cum.push(robot.cum[i-1]+Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]));
  robot.total=robot.cum[robot.cum.length-1];
  robot.s=reduce?robot.total*0.55:robot.total*0.18;
})();
function robotState(){
  while(robot.idx<robot.pts.length-2&&robot.cum[robot.idx+1]<robot.s)robot.idx++;
  while(robot.idx>0&&robot.cum[robot.idx]>robot.s)robot.idx--;
  const i=robot.idx,a=robot.pts[i],b=robot.pts[i+1],seg=robot.cum[i+1]-robot.cum[i]||1,t=clamp((robot.s-robot.cum[i])/seg,0,1);
  return {X:a[0]+(b[0]-a[0])*t,Z:a[1]+(b[1]-a[1])*t,dx:b[0]-a[0],dz:b[1]-a[1],i};
}
function strakeAt(X,Z){const s=section(X);let j=NB;for(let k=0;k<G-1;k++){if(s.Zs[k]<=Z&&s.Zs[k+1]>=Z&&k>=NB){j=k;break;}}return strakeName(s.gs[j]);}

/* ---------- shared state + cross-view hooks ---------- */
const state={selFR:170,hoverX:null,hoverSrc:null,mode:'real',cut:false};
const hooks={onSelect:[],onHover:[]};
function selectFR(fr){
  fr=clamp(Math.round(fr),0,FRMAX);state.selFR=fr;const X=fr*FS;const s=section(X);
  $('#secFr').textContent=fr;$('#secZone').textContent=regionOf(X);
  $('#secX').textContent=fmt(X)+' m';
  const hb=HB(X,T);$('#secHb').textContent=hb>0?fmt(hb)+' m':'—';
  const g=s.gs[G-1];$('#secG').textContent=fmt(g,1)+' m';
  const n=g<KEEL_HALF?0:Math.min(LETTERS.length-1,Math.floor((g-KEEL_HALF)/STRAKE_W));
  $('#secS').textContent=n>0?`K, A–${LETTERS[n]} (${n+2}열)`:'K';
  const sl=$('#secSlider');if(+sl.value!==fr)sl.value=fr;
  hooks.onSelect.forEach(f=>f(fr,X));requestDraw();
}
function setHover(X,src){state.hoverX=X;state.hoverSrc=X==null?null:src;hooks.onHover.forEach(f=>f(X,src));requestDraw();
  if(X==null&&src!=='3d')$('#stCursor').textContent='—';}
$('#secSlider').max=FRMAX;
$('#secSlider').addEventListener('input',e=>selectFR(+e.target.value));

/* =========================================================
   2D LINES PLAN  (sheet units, Path2D + zoom/pan)
   ========================================================= */
const dc=$('#dwg'),dx=dc.getContext('2d');
const SW=800,SH=880,PX0=56,SP=2.25,PBY=212,HBY=374,BX=400,BBY=650,SB=6.5;
const ROW_ST=PBY-(D+30)*SP-8,DIM_L=PBY+46,DIM_B=PBY+66,BODY_T=BBY-30*SB-22;
const TB={x:400,y:706,w:370,h:138},LG={x:56,y:712};
const pX=X=>PX0+X*SP,pZ=Z=>PBY-Z*SP,hY=Y=>HBY-Y*SP,bX=(Y,side)=>BX+side*Y*SB,bZ=Z=>BBY-Z*SB;
const WLS=[2,4,6,8,14,18,22];
const C={sheet:'#050912',grid:'#0B1322',gridMaj:'#111C30',frame:'rgba(251,181,132,.55)',hull:'#FBB584',wl:'rgba(248,155,108,.55)',st:'#2A3A58',dim:'#6F7C93',text:'#C9D3E3',orange:'#F37321',coral:'#F89B6C',muted:'#6F7C93',sup:'rgba(167,179,199,.45)'};
const v={s:1,ox:0,oy:0,fit:1};let dpr=1,cw=0,ch=0;

const PATH={};
(function build(){
  const g1=new Path2D(),g2=new Path2D();
  for(let x=30;x<=SW-30;x+=10){(x%50===0?g2:g1).moveTo(x,30);(x%50===0?g2:g1).lineTo(x,SH-30);}
  for(let y=30;y<=SH-30;y+=10){(y%50===0?g2:g1).moveTo(30,y);(y%50===0?g2:g1).lineTo(SW-30,y);}
  PATH.grid=g1;PATH.gridMaj=g2;
  // profile outline
  const p=new Path2D();p.moveTo(pX(0),pZ(deckZ(0)));p.lineTo(pX(0),pZ(keelZ(0)));
  for(let X=0;X<=0.05*L;X+=0.5)p.lineTo(pX(X),pZ(keelZ(X)));
  p.lineTo(pX(L),pZ(0));
  for(let Z=0;Z<=ZTOP;Z+=0.08)p.lineTo(pX(foreX(Z)),pZ(Z));
  for(let X=XSTEM_TOP;X>=0;X-=0.5)p.lineTo(pX(X),pZ(deckZ(X)));
  p.closePath();PATH.profile=p;
  const wl=new Path2D();WLS.forEach(Z=>{wl.moveTo(pX(aftX(Z)),pZ(Z));wl.lineTo(pX(foreX(Z)),pZ(Z));});PATH.pWL=wl;
  const dwl=new Path2D();dwl.moveTo(pX(aftX(T)),pZ(T));dwl.lineTo(pX(foreX(T)),pZ(T));PATH.pDWL=dwl;
  const st=new Path2D();for(let i=0;i<=20;i++){const X=i*L/20;st.moveTo(pX(X),pZ(keelZ(X)));st.lineTo(pX(X),pZ(deckZ(X)));}PATH.pST=st;
  const sup=new Path2D();
  [[40,245,D,D+2.4],[6,24,D,D+20],[2,9,D+20,D+30],[120,135,D+2.4,D+6.4],[278,279.4,deckZ(279),deckZ(279)+11]].forEach(r=>sup.rect(pX(r[0]),pZ(r[3]),(r[1]-r[0])*SP,(r[3]-r[2])*SP));
  PATH.pSup=sup;
  const tk=new Path2D(),tkM=new Path2D();
  for(let n=0;n<=FRMAX;n+=10){const x=pX(n*FS);const m=n%50===0;(m?tkM:tk).moveTo(x,PBY);(m?tkM:tk).lineTo(x,PBY+(m?9:4));}
  PATH.tick=tk;PATH.tickM=tkM;
  // half-breadth
  const hc=new Path2D();hc.moveTo(pX(0)-12,HBY);hc.lineTo(pX(XMAX)+12,HBY);PATH.hCL=hc;
  const hwl=new Path2D();
  function wlCurve(path,Z){let on=false;for(let X=0;X<=XMAX;X+=0.5){const ok=Z>=keelZ(X)-1e-6&&Z<=deckZ(X)&&X<=foreX(Z)+0.01;if(!ok){on=false;continue;}const Y=HB(X,Z);if(!on){path.moveTo(pX(X),hY(Y));on=true;}else path.lineTo(pX(X),hY(Y));}const fx=foreX(Z);if(on&&fx>0)path.lineTo(pX(fx),hY(0));}
  [0,...WLS].forEach(Z=>wlCurve(hwl,Z));PATH.hWL=hwl;
  const hd=new Path2D();wlCurve(hd,T);PATH.hDWL=hd;
  const hdk=new Path2D();hdk.moveTo(pX(0),HBY);for(let X=0;X<=XSTEM_TOP;X+=0.5)hdk.lineTo(pX(X),hY(HB(X,deckZ(X))));hdk.lineTo(pX(XSTEM_TOP),HBY);PATH.hDeck=hdk;
  const hst=new Path2D();for(let i=0;i<=20;i++){const X=i*L/20;hst.moveTo(pX(X),HBY);hst.lineTo(pX(X),hY(HB(X,deckZ(X))));}PATH.hST=hst;
  // body plan
  const bg=new Path2D();
  for(let Z=0;Z<=30;Z+=2){bg.moveTo(bX(B/2+3,-1),bZ(Z));bg.lineTo(bX(B/2+3,1),bZ(Z));}
  PATH.bWL=bg;
  const bc=new Path2D();bc.moveTo(BX,bZ(-1.5));bc.lineTo(BX,bZ(31));PATH.bCL=bc;
  const bb=new Path2D();[5,10,15,20].forEach(Y=>{[-1,1].forEach(sd=>{bb.moveTo(bX(Y,sd),bZ(0));bb.lineTo(bX(Y,sd),bZ(30));});});PATH.bBut=bb;
  const bs=new Path2D();PATH.bLabels=[];
  for(let i=0;i<=20;i++){const X=i*L/20;const s=section(X);const sides=i<10?[-1]:i>10?[1]:[-1,1];
    sides.forEach(sd=>{let on=false;for(let j=0;j<G;j++){const x=bX(s.Ys[j],sd),y=bZ(s.Zs[j]);if(!on){bs.moveTo(x,y);on=true;}else bs.lineTo(x,y);}});
    PATH.bLabels.push({i,Y:s.Ys[G-1],Z:s.Zs[G-1],sd:i<10?-1:1});}
  PATH.bST=bs;
  const bdwl=new Path2D();bdwl.moveTo(bX(B/2+3,-1),bZ(T));bdwl.lineTo(bX(B/2+3,1),bZ(T));PATH.bDWL=bdwl;
})();

function resizeDwg(){
  const r=dc.getBoundingClientRect();dpr=Math.min(window.devicePixelRatio||1,2);
  const nw=Math.max(1,Math.round(r.width)),nh=Math.max(1,Math.round(r.height));
  const first=!cw;cw=nw;ch=nh;dc.width=cw*dpr;dc.height=ch*dpr;
  const f=Math.min(cw/SW,ch/SH)*0.98;
  if(first||Math.abs(v.s-v.fit)<1e-6){v.s=f;v.ox=(cw-SW*f)/2;v.oy=(ch-SH*f)/2;}
  v.fit=f;drawDwg();
}
function fitDwg(){v.s=v.fit;v.ox=(cw-SW*v.s)/2;v.oy=(ch-SH*v.s)/2;requestDraw();}
function zoomAt(f,mx,my){const ns=clamp(v.s*f,v.fit*0.6,v.fit*10);const k=ns/v.s;v.ox=mx-(mx-v.ox)*k;v.oy=my-(my-v.oy)*k;v.s=ns;requestDraw();}
let drawPending=false;
function requestDraw(){if(drawPending)return;drawPending=true;requestAnimationFrame(()=>{drawPending=false;drawDwg();});}

function txt(str,ux,uy,o={}){
  const size=Math.max(o.min||8,(o.size||11)*v.s);
  dx.font=`${o.weight||400} ${size}px ${o.font||'"IBM Plex Mono",ui-monospace,monospace'}`;
  dx.fillStyle=o.color||C.text;dx.textAlign=o.align||'left';dx.textBaseline='alphabetic';
  const hasLS='letterSpacing' in dx;if(hasLS)dx.letterSpacing=o.ls||'0px';
  dx.fillText(str,v.ox+ux*v.s+(o.dx||0),v.oy+uy*v.s);
  const w=dx.measureText(str).width;if(hasLS)dx.letterSpacing='0px';return w;
}
function kv(label,val,ux,uy,o={}){const w=txt(label,ux,uy,{font:LBL,size:10.5,color:C.muted,ls:'1px'});txt(val,ux,uy,{dx:w+7,size:11,font:o.font,color:o.color});}
function pair(en,kr,ux,uy){const w=txt(en,ux,uy,{font:LBL,size:16,weight:600,color:C.coral,ls:'2px'});txt(kr,ux,uy,{dx:w+10,font:KR,size:11,color:C.muted});}
const LBL='"Barlow Condensed","IBM Plex Sans KR",sans-serif',KR='"IBM Plex Sans KR",sans-serif';
function arrow(x1,y1,x2,y2,a){const ang=Math.atan2(y2-y1,x2-x1);[[x1,y1,ang],[x2,y2,ang+Math.PI]].forEach(([x,y,t])=>{dx.moveTo(x+Math.cos(t+0.35)*a,y+Math.sin(t+0.35)*a);dx.lineTo(x,y);dx.lineTo(x+Math.cos(t-0.35)*a,y+Math.sin(t-0.35)*a);});}

function drawDwg(){
  if(!cw)return;const s=v.s;const lw=px=>px/s;
  dx.setTransform(dpr,0,0,dpr,0,0);dx.fillStyle='#070C17';dx.fillRect(0,0,cw,ch);
  dx.setTransform(dpr*s,0,0,dpr*s,dpr*v.ox,dpr*v.oy);
  dx.fillStyle=C.sheet;dx.fillRect(0,0,SW,SH);
  dx.lineWidth=lw(1);dx.strokeStyle=C.grid;dx.stroke(PATH.grid);dx.strokeStyle=C.gridMaj;dx.stroke(PATH.gridMaj);
  dx.strokeStyle=C.frame;dx.lineWidth=lw(1);dx.strokeRect(14,14,SW-28,SH-28);dx.lineWidth=lw(1.6);dx.strokeRect(30,30,SW-60,SH-60);
  dx.beginPath();dx.lineWidth=lw(1);
  for(let i=1;i<8;i++){const x=30+(SW-60)*i/8;dx.moveTo(x,14);dx.lineTo(x,30);dx.moveTo(x,SH-30);dx.lineTo(x,SH-14);}
  for(let i=1;i<6;i++){const y=30+(SH-60)*i/6;dx.moveTo(14,y);dx.lineTo(30,y);dx.moveTo(SW-30,y);dx.lineTo(SW-14,y);}
  dx.stroke();
  // ---- profile
  dx.setLineDash([]);dx.lineWidth=lw(0.8);dx.strokeStyle=C.st;dx.stroke(PATH.pST);
  dx.setLineDash([6,4]);dx.strokeStyle=C.wl;dx.stroke(PATH.pWL);dx.setLineDash([]);
  dx.strokeStyle=C.sup;dx.lineWidth=lw(0.9);dx.stroke(PATH.pSup);
  dx.fillStyle='rgba(251,181,132,.035)';dx.fill(PATH.profile);
  dx.strokeStyle=C.hull;dx.lineWidth=lw(1.7);dx.stroke(PATH.profile);
  dx.strokeStyle=C.orange;dx.lineWidth=lw(1.5);dx.stroke(PATH.pDWL);
  dx.strokeStyle=C.dim;dx.lineWidth=lw(1);dx.beginPath();dx.moveTo(pX(0)-12,PBY);dx.lineTo(pX(XMAX)+12,PBY);dx.stroke();
  dx.stroke(PATH.tick);dx.strokeStyle=C.coral;dx.stroke(PATH.tickM);
  dx.strokeStyle=C.dim;dx.lineWidth=lw(0.9);dx.beginPath();
  dx.moveTo(pX(0),PBY+12);dx.lineTo(pX(0),DIM_B+5);dx.moveTo(pX(XMAX),PBY+2);dx.lineTo(pX(XMAX),DIM_L+5);dx.moveTo(pX(L),PBY+12);dx.lineTo(pX(L),DIM_B+5);
  dx.moveTo(pX(0),DIM_L);dx.lineTo(pX(XMAX),DIM_L);arrow(pX(0),DIM_L,pX(XMAX),DIM_L,5);
  dx.moveTo(pX(0),DIM_B);dx.lineTo(pX(L),DIM_B);arrow(pX(0),DIM_B,pX(L),DIM_B,5);dx.stroke();
  // ---- half-breadth
  dx.setLineDash([3,4]);dx.strokeStyle=C.st;dx.lineWidth=lw(0.8);dx.stroke(PATH.hST);dx.setLineDash([]);
  dx.strokeStyle=C.dim;dx.lineWidth=lw(1);dx.setLineDash([14,3,2,3]);dx.stroke(PATH.hCL);dx.setLineDash([]);
  dx.strokeStyle=C.wl;dx.lineWidth=lw(0.9);dx.stroke(PATH.hWL);
  dx.strokeStyle=C.orange;dx.lineWidth=lw(1.4);dx.stroke(PATH.hDWL);
  dx.strokeStyle=C.hull;dx.lineWidth=lw(1.7);dx.stroke(PATH.hDeck);
  dx.strokeStyle=C.dim;dx.lineWidth=lw(0.9);dx.beginPath();const xb=pX(XMAX)+20;dx.moveTo(xb,HBY);dx.lineTo(xb,hY(B/2));arrow(xb,HBY,xb,hY(B/2),4);
  dx.moveTo(pX(XMAX)+6,hY(B/2));dx.lineTo(xb+4,hY(B/2));dx.stroke();
  // ---- body plan
  dx.strokeStyle=C.st;dx.lineWidth=lw(0.7);dx.stroke(PATH.bWL);
  dx.setLineDash([3,4]);dx.stroke(PATH.bBut);dx.setLineDash([14,3,2,3]);dx.strokeStyle=C.dim;dx.lineWidth=lw(1);dx.stroke(PATH.bCL);dx.setLineDash([]);
  dx.strokeStyle=C.orange;dx.lineWidth=lw(1.2);dx.stroke(PATH.bDWL);
  dx.strokeStyle=C.hull;dx.lineWidth=lw(1.1);dx.stroke(PATH.bST);
  dx.strokeStyle=C.dim;dx.lineWidth=lw(0.9);dx.beginPath();
  const yBd=BBY+26;dx.moveTo(bX(B/2,-1),BBY+6);dx.lineTo(bX(B/2,-1),yBd+5);dx.moveTo(bX(B/2,1),BBY+6);dx.lineTo(bX(B/2,1),yBd+5);
  dx.moveTo(bX(B/2,-1),yBd);dx.lineTo(bX(B/2,1),yBd);arrow(bX(B/2,-1),yBd,bX(B/2,1),yBd,5);
  const xD=bX(B/2+6,1);dx.moveTo(xD,bZ(0));dx.lineTo(xD,bZ(D));arrow(xD,bZ(0),xD,bZ(D),5);dx.moveTo(bX(B/2+1,1),bZ(D));dx.lineTo(xD+5,bZ(D));
  dx.stroke();
  // ---- title block + legend frames
  dx.fillStyle='rgba(0,0,0,.6)';dx.fillRect(TB.x,TB.y,TB.w,TB.h);
  dx.strokeStyle=C.frame;dx.lineWidth=lw(1.2);dx.strokeRect(TB.x,TB.y,TB.w,TB.h);
  dx.beginPath();dx.lineWidth=lw(0.8);
  [34,62,90,114].forEach(o=>{dx.moveTo(TB.x,TB.y+o);dx.lineTo(TB.x+TB.w,TB.y+o);});
  dx.moveTo(TB.x+190,TB.y+62);dx.lineTo(TB.x+190,TB.y+TB.h);dx.moveTo(TB.x+268,TB.y+90);dx.lineTo(TB.x+268,TB.y+TB.h);dx.stroke();
  dx.fillStyle=C.orange;dx.fillRect(TB.x,TB.y,6,34);
  dx.lineWidth=lw(1.6);
  [[C.hull,[]],[C.orange,[]],['rgba(248,155,108,.8)',[6,4]],[C.st,[]],[C.orange,[2,3]]].forEach((c,i)=>{dx.strokeStyle=c[0];dx.setLineDash(c[1]);dx.beginPath();const y=LG.y+26+i*20;dx.moveTo(LG.x,y);dx.lineTo(LG.x+30,y);dx.stroke();});
  dx.setLineDash([]);
  // ---- robot trail on profile
  if(lyRobotOn){
    const rs=robotState();
    dx.strokeStyle='rgba(243,115,33,.3)';dx.lineWidth=lw(1);dx.setLineDash([2,3]);dx.beginPath();
    robot.pts.forEach((p,i)=>{i?dx.lineTo(pX(p[0]),pZ(p[1])):dx.moveTo(pX(p[0]),pZ(p[1]));});dx.stroke();dx.setLineDash([]);
    dx.strokeStyle=C.orange;dx.lineWidth=lw(1.6);dx.beginPath();
    for(let i=0;i<=rs.i;i++){const p=robot.pts[i];i?dx.lineTo(pX(p[0]),pZ(p[1])):dx.moveTo(pX(p[0]),pZ(p[1]));}dx.lineTo(pX(rs.X),pZ(rs.Z));dx.stroke();
    dx.fillStyle=C.orange;dx.beginPath();dx.arc(pX(rs.X),pZ(rs.Z),lw(4.5),0,Math.PI*2);dx.fill();
    dx.strokeStyle='rgba(243,115,33,.5)';dx.lineWidth=lw(1);dx.beginPath();dx.arc(pX(rs.X),pZ(rs.Z),lw(9),0,Math.PI*2);dx.stroke();
  }
  const secPath=(X,sd)=>{const sh=section(X);dx.beginPath();for(let j=0;j<G;j++){const px=bX(sh.Ys[j],sd),py=bZ(sh.Zs[j]);j?dx.lineTo(px,py):dx.moveTo(px,py);}dx.stroke();};
  if(state.hoverX!=null){
    const X=state.hoverX,x=pX(X);
    dx.strokeStyle=C.coral;dx.lineWidth=lw(1);dx.setLineDash([4,3]);dx.beginPath();
    dx.moveTo(x,ROW_ST+4);dx.lineTo(x,PBY+12);dx.moveTo(x,hY(B/2+3));dx.lineTo(x,HBY+8);dx.stroke();
    secPath(X,X<L/2?-1:1);dx.setLineDash([]);
  }
  {
    const X=state.selFR*FS,x=pX(X);
    dx.strokeStyle=C.orange;dx.lineWidth=lw(1.6);dx.beginPath();
    dx.moveTo(x,ROW_ST-10);dx.lineTo(x,PBY+14);dx.moveTo(x,hY(B/2+3));dx.lineTo(x,HBY+10);dx.stroke();
    dx.lineWidth=lw(2.6);secPath(X,X<L/2?-1:1);
  }

  // ================= text (screen space) =================
  dx.setTransform(dpr,0,0,dpr,0,0);
  pair('PROFILE','측면도 · 우현에서 본 모습',PX0,52);
  pair('HALF-BREADTH PLAN','반폭선도',PX0,hY(B/2)-20);
  pair('BODY PLAN','정면선도',PX0,BODY_T);
  txt('AFT',bX(B/2,-1),BODY_T,{font:LBL,size:12,weight:600,color:C.muted,ls:'1px'});
  txt('FWD',bX(B/2,1),BODY_T,{font:LBL,size:12,weight:600,color:C.muted,align:'right',ls:'1px'});
  txt('B.L.',pX(0)-6,PBY+4,{size:9,color:C.dim,align:'right'});
  txt('FR',pX(0)-6,PBY+24,{size:9,color:C.coral,align:'right'});
  for(let n=50;n<=FRMAX;n+=50)txt(String(n),pX(n*FS),PBY+24,{size:9.5,color:C.coral,align:'center'});
  txt('LOA 298.60',(pX(0)+pX(XMAX))/2,DIM_L-4,{size:10,align:'center'});
  txt('LBP 289.00',(pX(0)+pX(L))/2,DIM_B-4,{size:10,align:'center'});
  txt('ST',pX(0)-16,ROW_ST,{size:9,color:C.muted,align:'right'});
  for(let i=0;i<=20;i+=2){txt(i===0?'AP':i===20?'FP':String(i),pX(i*L/20),ROW_ST,{size:9.5,color:C.muted,align:'center'});}
  txt('DWL 11.50',pX(foreX(T))+5,pZ(T)+4,{size:9.5,color:C.orange,weight:500});
  txt('B/2',xb+6,(HBY+hY(B/2))/2-2,{size:9.5});txt('23.20',xb+6,(HBY+hY(B/2))/2+11,{size:9.5});
  txt('C.L.',pX(XMAX)+14,HBY+14,{size:9,color:C.dim});
  let lastY={'-1':-99,'1':-99};
  PATH.bLabels.forEach(l=>{if(l.i===10)return;const key=String(l.sd);if(Math.abs(l.Y-lastY[key])<2.4&&l.i!==0&&l.i!==20)return;lastY[key]=l.Y;
    txt(String(l.i),bX(l.Y,l.sd)+l.sd*4,bZ(l.Z)-6,{size:9,color:C.muted,align:l.sd<0?'right':'left'});});
  [0,6,12,18,24].forEach(Z=>txt('WL'+Z,bX(B/2+3,-1)-4,bZ(Z)+4,{size:9,color:C.dim,align:'right'}));
  txt('B 46.40',BX,yBd-4,{size:10,align:'center'});
  txt('D 26.50',xD+7,bZ(D/2),{size:10});
  {const X=state.selFR*FS;txt('FR '+state.selFR,pX(X),ROW_ST-14,{font:LBL,size:13,weight:600,color:C.orange,align:'center'});}
  if(state.hoverX!=null){const X=state.hoverX;txt('FR '+Math.round(X/FS)+' · X '+fmt(X),pX(X),hY(B/2+3)-5,{size:9.5,color:C.coral,align:'center'});}
  txt('LEGEND',LG.x,LG.y+6,{font:LBL,size:13,weight:600,color:C.coral,ls:'1.5px'});
  ['선체 외곽선 · 갑판선','설계 흘수선 (DWL)','수선 (WL) · 2 m 간격','스테이션 (ST 0–20)','로봇 주행경로 · 계획 / 완료'].forEach((t,i)=>txt(t,LG.x+40,LG.y+30+i*20,{font:KR,size:11,color:C.text}));
  txt('단위 m · 프레임 간격 850 mm · 예시 선형',LG.x,LG.y+134,{font:KR,size:10,color:C.muted});
  txt('HULL FORM LINES PLAN',TB.x+16,TB.y+23,{font:LBL,size:16,weight:600,ls:'1.5px'});
  txt('선도',TB.x+TB.w-10,TB.y+23,{font:KR,size:12,color:'#FBB584',align:'right'});
  txt('선체 외판 도막·강판 두께 측정 디지털 트윈',TB.x+10,TB.y+53,{font:KR,size:11});
  kv('VESSEL','174K LNGC H-2491',TB.x+10,TB.y+81);
  kv('DWG','HT-HUL-1001',TB.x+198,TB.y+81,{color:'#FBB584'});
  kv('SCALE','1:500',TB.x+10,TB.y+107);
  kv('REV','B',TB.x+198,TB.y+107);
  txt('2026.10.25',TB.x+276,TB.y+107,{size:11});
  kv('DRAWN','설계DX',TB.x+10,TB.y+131,{font:KR});
  kv('UNIT','m',TB.x+198,TB.y+131);
  kv('SHEET','1/1',TB.x+276,TB.y+131);
  for(let i=0;i<8;i++){const x=30+(SW-60)*(i+0.5)/8;txt(String(i+1),x,26,{size:9,color:C.dim,align:'center'});txt(String(i+1),x,SH-18,{size:9,color:C.dim,align:'center'});}
  for(let i=0;i<6;i++){const y=30+(SH-60)*(i+0.5)/6;txt('ABCDEF'[i],22,y+3,{size:9,color:C.dim,align:'center'});txt('ABCDEF'[i],SW-22,y+3,{size:9,color:C.dim,align:'center'});}
}
let lyRobotOn=true;

/* drawing interactions */
function sheetPt(e){const r=dc.getBoundingClientRect();const mx=e.clientX-r.left,my=e.clientY-r.top;return {mx,my,u:(mx-v.ox)/v.s,w:(my-v.oy)/v.s};}
function inPlanViews(u,w){return u>=pX(0)-6&&u<=pX(XMAX)+6&&((w>=ROW_ST-20&&w<=PBY+30)||(w>=hY(B/2+6)&&w<=HBY+12));}
let drag=null;
dc.addEventListener('pointerdown',e=>{if(e.button!==0)return;dc.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,ox:v.ox,oy:v.oy,moved:false};});
dc.addEventListener('pointermove',e=>{
  const p=sheetPt(e);
  if(drag){const ddx=e.clientX-drag.x,ddy=e.clientY-drag.y;if(!drag.moved&&Math.hypot(ddx,ddy)>3){drag.moved=true;dc.classList.add('grab');}
    if(drag.moved){v.ox=drag.ox+ddx;v.oy=drag.oy+ddy;requestDraw();return;}}
  if(inPlanViews(p.u,p.w)){const X=clamp((p.u-PX0)/SP,0,XMAX);setHover(X,'dwg');
    $('#stCursor').textContent=`FR ${Math.round(X/FS)} · X ${fmt(X)} m`;}
  else if(state.hoverSrc==='dwg')setHover(null,'dwg');
});
dc.addEventListener('pointerup',e=>{const p=sheetPt(e);if(drag&&!drag.moved&&inPlanViews(p.u,p.w))selectFR(clamp((p.u-PX0)/SP,0,XMAX)/FS);drag=null;dc.classList.remove('grab');});
dc.addEventListener('pointerleave',()=>{if(state.hoverSrc==='dwg')setHover(null,'dwg');});
dc.addEventListener('wheel',e=>{e.preventDefault();const p=sheetPt(e);zoomAt(Math.exp(-e.deltaY*0.0016),p.mx,p.my);},{passive:false});
$('#zIn').addEventListener('click',()=>zoomAt(1.3,cw/2,ch/2));
$('#zOut').addEventListener('click',()=>zoomAt(1/1.3,cw/2,ch/2));
$('#zFit').addEventListener('click',fitDwg);
new ResizeObserver(resizeDwg).observe(dc);
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(requestDraw);

/* splitter */
(function(){
  const sp=$('#splitter'),pd=$('#paneDwg'),work=$('#work');let on=false;
  sp.addEventListener('pointerdown',e=>{on=true;sp.classList.add('on');sp.setPointerCapture(e.pointerId);});
  sp.addEventListener('pointermove',e=>{if(!on)return;const r=work.getBoundingClientRect();const pct=clamp((e.clientX-r.left)/r.width*100,24,68);pd.style.flexBasis=pct+'%';});
  sp.addEventListener('pointerup',()=>{on=false;sp.classList.remove('on');});
  sp.addEventListener('keydown',e=>{if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;const cur=parseFloat(pd.style.flexBasis)||42;pd.style.flexBasis=clamp(cur+(e.key==='ArrowRight'?2:-2),24,68)+'%';});
})();

/* robot control */
const robotBtn=$('#robotBtn');
function syncRobotBtn(){robotBtn.textContent=robot.paused?'재개':'일시정지';$('#stRobotWrap').classList.toggle('paused',robot.paused);}
robotBtn.addEventListener('click',()=>{robot.paused=!robot.paused;syncRobotBtn();});syncRobotBtn();
function updateRobotStatus(){const rs=robotState();const fr=Math.round(rs.X/FS);
  $('#stRobot').textContent=`RBT-01 ${robot.paused?'정지':'주행 중'} · FR ${fr} · 외판열 ${strakeAt(rs.X,rs.Z)}(S) · Z ${fmt(rs.Z)} m · 진행 ${Math.round(robot.s/robot.total*100)}%`;}

/* =========================================================
   3D VIEWPORT (three.js)
   ========================================================= */
const host=$('#vp');
const V3=THREE.Vector3;
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.localClippingEnabled=true;
host.appendChild(renderer.domElement);
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x04070d);
scene.fog=new THREE.Fog(0x04070d,480,1250);
const camera=new THREE.PerspectiveCamera(32,1,1,5000);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=0.08;controls.minDistance=30;controls.maxDistance=1200;controls.rotateSpeed=0.7;
const PRESETS={iso:{p:[240,125,275],t:[0,8,0]},side:{p:[0,14,600],t:[0,12,0]},plan:{p:[0,640,0.5],t:[0,0,0]},front:{p:[560,18,0.5],t:[0,14,0]},bottom:{p:[150,-340,170],t:[0,4,0]}};
camera.position.set(...PRESETS.iso.p);controls.target.set(...PRESETS.iso.t);controls.update();

scene.add(new THREE.HemisphereLight(0xb8c7e6,0x0a0f1a,0.62));
const key=new THREE.DirectionalLight(0xffffff,0.85);key.position.set(220,320,260);scene.add(key);
const rim=new THREE.DirectionalLight(0xF89B6C,0.38);rim.position.set(-320,140,-220);scene.add(rim);
const fill=new THREE.DirectionalLight(0x8fa6d6,0.25);fill.position.set(-80,-200,120);scene.add(fill);

const clipPlane=new THREE.Plane(new V3(-1,0,0),0);
const clipMats=[];
function cm(m){clipMats.push(m);return m;}

/* hull shell */
const nV=(NX+1)*G;const pos=new Float32Array(nV*3),girth=new Float32Array(nV);
const colReal=new Float32Array(nV*3),colZone=new Float32Array(nV*3),colBp=new Float32Array(nV*3);
const ZC=[0xF37321,0xF89B6C,0xFBB584,0x000000,0x3C4E70,0xB5531A,0x8F3F13].map(h=>new THREE.Color(h));
const cAF=new THREE.Color(0xA9441A),cBoot=new THREE.Color(0x0d0e11),cTop=new THREE.Color(0x1d2638),cBp=new THREE.Color(0x0c1528);
for(let i=0;i<=NX;i++){const s=stSec[i],X=stX[i];for(let j=0;j<G;j++){const k=i*G+j;const Z=s.Zs[j];
  pos[k*3]=X-XC;pos[k*3+1]=Z;pos[k*3+2]=s.Ys[j];girth[k]=s.gs[j];
  const cr=Z<T-1.2?cAF:Z<T+1.6?cBoot:cTop;cr.toArray(colReal,k*3);ZC[zoneOf(X,Z)].toArray(colZone,k*3);cBp.toArray(colBp,k*3);}}
const idx=[];for(let i=0;i<NX;i++)for(let j=0;j<G-1;j++){const a=i*G+j,b=(i+1)*G+j,c=a+1,d=b+1;idx.push(a,b,c,b,d,c);}
const hullGeo=new THREE.BufferGeometry();
hullGeo.setAttribute('position',new THREE.BufferAttribute(pos,3));
const colAttr=new THREE.BufferAttribute(colReal.slice(),3);hullGeo.setAttribute('color',colAttr);
hullGeo.setIndex(idx);hullGeo.computeVertexNormals();hullGeo.computeBoundingSphere();
const hullMat=cm(new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.6,metalness:0.18,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1}));
const backMat=cm(new THREE.MeshBasicMaterial({color:0x0a1222,side:THREE.BackSide}));
const hullS=new THREE.Mesh(hullGeo,hullMat),hullP=new THREE.Mesh(hullGeo,hullMat);hullP.scale.z=-1;
hullS.userData.side='S';hullP.userData.side='P';
const backS=new THREE.Mesh(hullGeo,backMat),backP=new THREE.Mesh(hullGeo,backMat);backP.scale.z=-1;
const hullGroup=new THREE.Group();hullGroup.add(hullS,hullP,backS,backP);scene.add(hullGroup);

/* deck + transom */
const deckPos=[],deckIdx=[];
for(let i=0;i<=NX;i++){const s=stSec[i],X=stX[i];const Y=s.Ys[G-1],Z=s.Zs[G-1];deckPos.push(X-XC,Z,-Y,X-XC,Z,Y);
  if(i<NX){const a=i*2;deckIdx.push(a,a+2,a+1,a+1,a+2,a+3);}}
const deckGeo=new THREE.BufferGeometry();deckGeo.setAttribute('position',new THREE.Float32BufferAttribute(deckPos,3));deckGeo.setIndex(deckIdx);deckGeo.computeVertexNormals();
const deckMat=cm(new THREE.MeshStandardMaterial({color:0x252e40,roughness:0.85,metalness:0.1,side:THREE.DoubleSide}));
const deck=new THREE.Mesh(deckGeo,deckMat);hullGroup.add(deck);
const trPos=[],trIdx=[];{const s=stSec[0];for(let j=0;j<G;j++){trPos.push(-XC,s.Zs[j],-s.Ys[j],-XC,s.Zs[j],s.Ys[j]);if(j<G-1){const a=j*2;trIdx.push(a,a+1,a+2,a+1,a+3,a+2);}}}
const trGeo=new THREE.BufferGeometry();trGeo.setAttribute('position',new THREE.Float32BufferAttribute(trPos,3));trGeo.setIndex(trIdx);trGeo.computeVertexNormals();
const trMat=cm(new THREE.MeshStandardMaterial({color:0x1d2638,roughness:0.6,metalness:0.18,side:THREE.DoubleSide}));
hullGroup.add(new THREE.Mesh(trGeo,trMat));

/* line helpers */
function lineSeg(arr,mat){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));return new THREE.LineSegments(g,mat);}
function sectionSegs(X,out,off=0.06){
  const s=section(X);const valid=j=>j<=NB?s.yb>0.02:s.Ys[j]>0.02;
  for(let j=0;j<G-1;j++){if(!valid(j)||!valid(j+1))continue;
    const z1=s.Zs[j]-(j<=NB?off:0),z2=s.Zs[j+1]-(j+1<=NB?off:0),y1=s.Ys[j]+(j>NB?off:0),y2=s.Ys[j+1]+(j+1>NB?off:0);
    out.push(X-XC,z1,y1,X-XC,z2,y2, X-XC,z1,-y1,X-XC,z2,-y2);}
}
const frameMat=cm(new THREE.LineBasicMaterial({color:0xFBB584,transparent:true,opacity:0.22}));
const frameMajMat=cm(new THREE.LineBasicMaterial({color:0xF89B6C,transparent:true,opacity:0.7}));
const fA=[],fB=[];for(let n=10;n<=FRMAX;n+=10)sectionSegs(n*FS,n%50===0?fB:fA);
const frames=new THREE.Group();frames.add(lineSeg(fA,frameMat),lineSeg(fB,frameMajMat));
// sheer line (deck edge)
const sheer=[];for(let i=0;i<NX;i++){const a=stSec[i],b=stSec[i+1];const ya=a.Ys[G-1],yb=b.Ys[G-1];if(ya<0.02&&yb<0.02)continue;sheer.push(stX[i]-XC,a.Zs[G-1],ya,stX[i+1]-XC,b.Zs[G-1],yb,stX[i]-XC,a.Zs[G-1],-ya,stX[i+1]-XC,b.Zs[G-1],-yb);}
const sheerMat=cm(new THREE.LineBasicMaterial({color:0xFBB584,transparent:true,opacity:0.55}));
hullGroup.add(lineSeg(sheer,sheerMat));
// strake seams
const seamMat=cm(new THREE.LineBasicMaterial({color:0xFBB584,transparent:true,opacity:0.16}));
const seamArr=[];
function seamPt(s,g){if(g>s.gs[G-1])return null;let j=0;while(j<G-2&&s.gs[j+1]<g)j++;const valid=k=>k<=NB?s.yb>0.02:s.Ys[k]>0.02;if(!valid(j)||!valid(j+1))return null;
  const t=(g-s.gs[j])/((s.gs[j+1]-s.gs[j])||1);const Y=s.Ys[j]+(s.Ys[j+1]-s.Ys[j])*t,Z=s.Zs[j]+(s.Zs[j+1]-s.Zs[j])*t;const onB=j<NB;return [onB?Y:Y+0.06,onB?Z-0.06:Z];}
for(let k=0;k<LETTERS.length;k++){const g=KEEL_HALF+STRAKE_W*k;let prev=null;
  for(let i=0;i<=NX;i++){const p=seamPt(stSec[i],g);if(p&&prev){seamArr.push(stX[i-1]-XC,prev[1],prev[0],stX[i]-XC,p[1],p[0],stX[i-1]-XC,prev[1],-prev[0],stX[i]-XC,p[1],-p[0]);}prev=p;}}
const seams=lineSeg(seamArr,seamMat);
// DWL
const dwlArr=[];for(let X=0;X<XMAX;X+=0.5){const y1=HB(X,T),y2=HB(X+0.5,T);if(y1<0.02||y2<0.02)continue;dwlArr.push(X-XC,T,y1+0.1,X+0.5-XC,T,y2+0.1,X-XC,T,-y1-0.1,X+0.5-XC,T,-y2-0.1);}
const dwlMat=cm(new THREE.LineBasicMaterial({color:0xF37321}));
const dwl=lineSeg(dwlArr,dwlMat);
// blueprint lines (WL + stations)
const bpMat=cm(new THREE.LineBasicMaterial({color:0xFBB584,transparent:true,opacity:0.32}));
const bpArr=[];WLS.forEach(Z=>{for(let X=0;X<XMAX;X+=0.6){const y1=HB(X,Z),y2=HB(X+0.6,Z);if(y1<0.02||y2<0.02)continue;bpArr.push(X-XC,Z,y1+0.06,X+0.6-XC,Z,y2+0.06,X-XC,Z,-y1-0.06,X+0.6-XC,Z,-y2-0.06);}});
for(let i=0;i<=20;i++)sectionSegs(i*L/20,bpArr,0.07);
const bpLines=lineSeg(bpArr,bpMat);bpLines.visible=false;
hullGroup.add(frames,seams,dwl,bpLines);

/* superstructure */
const superGroup=new THREE.Group();
const supMat=cm(new THREE.MeshStandardMaterial({color:0x1a2333,roughness:0.75,metalness:0.15}));
const supEdgeMat=cm(new THREE.LineBasicMaterial({color:0x3e5070,transparent:true,opacity:0.9}));
const bandMat=cm(new THREE.MeshStandardMaterial({color:0xF37321,emissive:0x3a1404,roughness:0.5}));
const supSolids=[];
function box(x0,x1,z0,z1,w,mat=supMat,yc=0){const g=new THREE.BoxGeometry(x1-x0,z1-z0,w);const m=new THREE.Mesh(g,mat);m.position.set((x0+x1)/2-XC,(z0+z1)/2,yc);superGroup.add(m);supSolids.push(m);
  const e=new THREE.LineSegments(new THREE.EdgesGeometry(g),supEdgeMat);e.position.copy(m.position);superGroup.add(e);return m;}
box(40,245,D,D+2.4,34);box(6,24,D,D+20,36);box(18,24,D+17.8,D+20,46);box(2,9,D+20,D+30,9);box(2,9,D+27.4,D+29,9.2,bandMat);
box(120,135,D+2.4,D+6.4,14);box(278,279.4,deckZ(279),deckZ(279)+11,1.4);
[60,100,150,200].forEach(x=>box(x,x+9,D+2.4,D+4.4,6));
scene.add(superGroup);

/* dock: floor, grid, walls, keel blocks */
const dockGroup=new THREE.Group();
const FLOOR=-1.8;
const floor=new THREE.Mesh(new THREE.PlaneGeometry(380,120),new THREE.MeshBasicMaterial({color:0x060b15}));floor.rotation.x=-Math.PI/2;floor.position.y=FLOOR-0.02;dockGroup.add(floor);
const gMin=[],gMaj=[];
for(let x=-300;x<=300;x+=5){const a=x%25===0?gMaj:gMin;a.push(x,FLOOR,-170,x,FLOOR,170);}
for(let z=-170;z<=170;z+=5){const a=z%25===0?gMaj:gMin;a.push(-300,FLOOR,z,300,FLOOR,z);}
scene.add(lineSeg(gMin,new THREE.LineBasicMaterial({color:0x0c1527})));
scene.add(lineSeg(gMaj,new THREE.LineBasicMaterial({color:0x172540})));
const dw=[];const DX0=-190,DX1=190,DZ=60,DH=18;
[[FLOOR],[DH]].forEach(([y])=>{dw.push(DX0,y,-DZ,DX1,y,-DZ,DX0,y,DZ,DX1,y,DZ,DX0,y,-DZ,DX0,y,DZ);});
for(let x=DX0;x<=DX1;x+=20){dw.push(x,FLOOR,-DZ,x,DH,-DZ,x,FLOOR,DZ,x,DH,DZ);}
dockGroup.add(lineSeg(dw,new THREE.LineBasicMaterial({color:0x22355a,transparent:true,opacity:0.7})));
const blkMat=new THREE.MeshStandardMaterial({color:0x2a303c,roughness:0.9});
const capMat=new THREE.MeshStandardMaterial({color:0x5a3a22,roughness:0.9});
const blkG=new THREE.BoxGeometry(1.4,1.5,2.6),capG=new THREE.BoxGeometry(1.4,0.3,2.6);
for(let X=16;X<=L-6;X+=6){const b=new THREE.Mesh(blkG,blkMat);b.position.set(X-XC,FLOOR+0.75,0);const c=new THREE.Mesh(capG,capMat);c.position.set(X-XC,-0.15,0);dockGroup.add(b,c);}
for(let X=50;X<=240;X+=19){[-1,1].forEach(sd=>{const b=new THREE.Mesh(blkG,blkMat);b.position.set(X-XC,FLOOR+0.75,sd*14);const c=new THREE.Mesh(capG,capMat);c.position.set(X-XC,-0.15,sd*14);dockGroup.add(b,c);});}
scene.add(dockGroup);

/* robot */
const robotGroup=new THREE.Group();
const rbBody=new THREE.Mesh(new THREE.BoxGeometry(1.9,1.2,0.6),new THREE.MeshStandardMaterial({color:0xF37321,emissive:0x5a2208,roughness:0.45,metalness:0.2}));
const rbTop=new THREE.Mesh(new THREE.BoxGeometry(1.1,0.7,0.25),new THREE.MeshStandardMaterial({color:0x0d1220,roughness:0.6}));rbTop.position.z=0.4;
const rbEye=new THREE.Mesh(new THREE.SphereGeometry(0.16,12,8),new THREE.MeshBasicMaterial({color:0xFBB584}));rbEye.position.set(0.95,0,0.15);
const wheelG=new THREE.CylinderGeometry(0.26,0.26,0.2,14),wheelM=new THREE.MeshStandardMaterial({color:0x111622,roughness:0.8});
[[-0.7,0.65],[0.7,0.65],[-0.7,-0.65],[0.7,-0.65]].forEach(([x,y])=>{const w=new THREE.Mesh(wheelG,wheelM);w.position.set(x,y,-0.2);robotGroup.add(w);});
const rbRing=new THREE.Mesh(new THREE.RingGeometry(1.9,2.15,40),new THREE.MeshBasicMaterial({color:0xF37321,transparent:true,opacity:0.6,side:THREE.DoubleSide,depthWrite:false}));
robotGroup.add(rbBody,rbTop,rbEye,rbRing);
const rbInner=new THREE.Group();rbInner.add(robotGroup);
const robotWrap=new THREE.Group();robotWrap.add(rbInner);scene.add(robotWrap);
const pathArr=[];robot.pts.forEach(p=>{const Y=HB(p[0],p[1])+0.12;pathArr.push(p[0]-XC,p[1],Y);});
const pathGeo=new THREE.BufferGeometry();pathGeo.setAttribute('position',new THREE.Float32BufferAttribute(pathArr,3));
const planLine=new THREE.Line(pathGeo,new THREE.LineDashedMaterial({color:0xFBB584,dashSize:0.6,gapSize:0.5,transparent:true,opacity:0.45}));planLine.computeLineDistances();
const trailGeo=new THREE.BufferGeometry();trailGeo.setAttribute('position',new THREE.Float32BufferAttribute(pathArr.slice(),3));
const trail=new THREE.Line(trailGeo,new THREE.LineBasicMaterial({color:0xF37321}));
robotWrap.add(planLine,trail);
function placeRobot(){const rs=robotState();const Y=HB(rs.X,rs.Z);
  rbInner.position.set(rs.X-XC,rs.Z,Y+0.45);rbInner.rotation.z=Math.atan2(rs.dz,rs.dx);
  trailGeo.setDrawRange(0,rs.i+1);}

/* selection ring, hover ring, labels */
const ringMat=new THREE.MeshBasicMaterial({color:0xF37321});
let ringMesh=null;
const hoverRing=(()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(G*2*3),3));const l=new THREE.Line(g,new THREE.LineBasicMaterial({color:0xF89B6C,transparent:true,opacity:0.9,depthTest:false}));l.renderOrder=5;l.visible=false;scene.add(l);return l;})();
const hoverDot=new THREE.Mesh(new THREE.SphereGeometry(0.45,14,10),new THREE.MeshBasicMaterial({color:0xFBB584,depthTest:false}));hoverDot.renderOrder=6;hoverDot.visible=false;scene.add(hoverDot);
function ringPoints(X,off){const s=section(X);const pts=[];
  for(let j=G-1;j>=0;j--)pts.push(new V3(X-XC,s.Zs[j],-(s.Ys[j]+off)));
  for(let j=1;j<G;j++)pts.push(new V3(X-XC,s.Zs[j],s.Ys[j]+off));
  return pts.filter((p,i,a)=>i===0||p.distanceTo(a[i-1])>1e-3);}
const labelsEl=$('#labels');const frLabels=[];
for(let n=0;n<=FRMAX;n+=50){const el=document.createElement('div');el.className='lbl3d';el.textContent='FR '+n;labelsEl.appendChild(el);const X=n*FS;const Z=deckZ(X);frLabels.push({el,p:new V3(X-XC,Z+2.2,HB(X,Z)+0.5)});}
const selLabel=document.createElement('div');selLabel.className='lbl3d sel';labelsEl.appendChild(selLabel);let selLabelPos=new V3();

hooks.onSelect.push((fr,X)=>{
  if(ringMesh){hullGroup.remove(ringMesh);ringMesh.geometry.dispose();}
  const pts=ringPoints(X,0.12);const curve=new THREE.CatmullRomCurve3(pts,false,'centripetal');
  ringMesh=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(60,pts.length*3),0.24,6,false),ringMat);hullGroup.add(ringMesh);
  clipPlane.constant=X-XC+0.02;
  selLabel.textContent='FR '+fr;const Z=deckZ(X);selLabelPos.set(X-XC,Z+5.5,HB(X,Z));
});
hooks.onHover.push((X,src)=>{
  if(X==null){hoverRing.visible=false;if(src!=='3d')hoverDot.visible=false;return;}
  const pts=ringPoints(X,0.18);const arr=hoverRing.geometry.attributes.position;
  pts.forEach((p,i)=>arr.setXYZ(i,p.x,p.y,p.z));arr.needsUpdate=true;hoverRing.geometry.setDrawRange(0,pts.length);hoverRing.visible=true;
  if(src!=='3d')hoverDot.visible=false;
});

/* modes, layers, cut */
function setMode(m){state.mode=m;
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===m)));
  colAttr.array.set(m==='zone'?colZone:(m==='bp'||m==='xray')?colBp:colReal);colAttr.needsUpdate=true;
  const xr=m==='xray',bp=m==='bp'||xr;
  hullMat.transparent=xr;hullMat.opacity=xr?0.13:1;hullMat.depthWrite=!xr;hullMat.roughness=bp?0.95:0.6;hullMat.needsUpdate=true;
  backS.visible=backP.visible=!xr;
  deckMat.color.setHex(bp?0x0c1528:0x252e40);deckMat.transparent=xr;deckMat.opacity=xr?0.1:1;deckMat.depthWrite=!xr;
  trMat.color.setHex(bp?0x0c1528:m==='zone'?0x3C4E70:0x1d2638);trMat.transparent=xr;trMat.opacity=xr?0.12:1;trMat.depthWrite=!xr;
  bpLines.visible=bp;
  frameMat.opacity=m==='real'?0.22:m==='zone'?0.32:0.5;seamMat.opacity=m==='real'?0.16:m==='zone'?0.2:0.35;
  supSolids.forEach(s=>s.visible=!bp);
  $('#legend').hidden=m!=='zone';
}
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
const lay=(id,fn)=>{const el=$(id);el.addEventListener('change',()=>fn(el.checked));fn(el.checked);};
lay('#lyFrames',on=>{frames.visible=on;frLabels.forEach(l=>l.el.hidden=!on);});
lay('#lySeams',on=>seams.visible=on);
lay('#lyDwl',on=>dwl.visible=on);
lay('#lySuper',on=>superGroup.visible=on);
lay('#lyBlocks',on=>dockGroup.visible=on);
lay('#lyRobot',on=>{robotWrap.visible=on;lyRobotOn=on;requestDraw();});
$('#cutTog').addEventListener('change',e=>{state.cut=e.target.checked;const planes=state.cut?[clipPlane]:[];clipMats.forEach(m=>{m.clippingPlanes=planes;m.needsUpdate=true;});});

/* camera presets */
let tween=null;
function goView(k){document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===k)));
  const pr=PRESETS[k];const to={p:new V3(...pr.p),t:new V3(...pr.t)};
  if(reduce){camera.position.copy(to.p);controls.target.copy(to.t);controls.update();return;}
  tween={from:{p:camera.position.clone(),t:controls.target.clone()},to,t0:performance.now(),dur:800};}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>goView(b.dataset.view)));
$('#btnReset').addEventListener('click',()=>goView('iso'));
controls.addEventListener('start',()=>{tween=null;document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed','false'));});
$('#btnFull').addEventListener('click',()=>{const el=$('#pane3d');try{if(document.fullscreenElement)document.exitFullscreen();else{const r=el.requestFullscreen&&el.requestFullscreen();if(r&&r.catch)r.catch(()=>toast('이 화면에서는 전체 화면을 지원하지 않습니다'));}}catch(_){toast('이 화면에서는 전체 화면을 지원하지 않습니다');}});

/* picking */
const ray=new THREE.Raycaster();const ndc=new THREE.Vector2();let pendingMove=null,lastHit=null,downAt=null;
const tip=$('#tip');
function pick(e){
  const r=renderer.domElement.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1);
  ray.setFromCamera(ndc,camera);
  const hits=ray.intersectObjects([hullS,hullP],false).filter(h=>!state.cut||h.point.x<=clipPlane.constant);
  if(!hits.length){lastHit=null;tip.hidden=true;hoverDot.visible=false;if(state.hoverSrc==='3d')setHover(null,'3d');$('#stCursor').textContent='—';return;}
  const h=hits[0],p=h.point;const loc=h.object.worldToLocal(p.clone());
  let best=h.face.a,bd=1e9;[h.face.a,h.face.b,h.face.c].forEach(k=>{const d=(pos[k*3]-loc.x)**2+(pos[k*3+1]-loc.y)**2+(pos[k*3+2]-loc.z)**2;if(d<bd){bd=d;best=k;}});
  const X=p.x+XC,Z=p.y,Y=-p.z,fr=Math.round(X/FS),side=h.object.userData.side;
  const st=strakeName(girth[best]);
  lastHit={fr,X};
  tip.innerHTML=`<div class="t1">FR ${fr} <em>· 외판열 ${st}(${side})</em></div><div class="t2">${ZONES[zoneOf(X,Z)]}</div><div class="t3">X ${fmt(X)}  Y ${fmt(Y)}  Z ${fmt(Z)} m</div>`;
  tip.hidden=false;const pw=r.width;tip.style.left=(e.clientX-r.left)+'px';tip.style.top=(e.clientY-r.top)+'px';
  tip.style.transform=(e.clientX-r.left)>pw-230?'translate(calc(-100% - 14px),14px)':'translate(14px,14px)';
  hoverDot.position.copy(p);hoverDot.visible=true;
  setHover(X,'3d');
  $('#stCursor').textContent=`FR ${fr} · 외판열 ${st}(${side}) · X ${fmt(X)}  Y ${fmt(Y)}  Z ${fmt(Z)} m`;
}
const cvs=renderer.domElement;
cvs.addEventListener('pointermove',e=>{pendingMove=e;});
cvs.addEventListener('pointerleave',()=>{pendingMove=null;tip.hidden=true;hoverDot.visible=false;lastHit=null;if(state.hoverSrc==='3d')setHover(null,'3d');});
cvs.addEventListener('pointerdown',e=>{downAt={x:e.clientX,y:e.clientY};tip.hidden=true;});
cvs.addEventListener('pointerup',e=>{if(downAt&&Math.hypot(e.clientX-downAt.x,e.clientY-downAt.y)<4){pick(e);if(lastHit)selectFR(lastHit.fr);}downAt=null;});

/* gizmo */
const gz=$('#gizmo'),gctx=gz.getContext('2d');
function drawGizmo(){
  const r=gz.getBoundingClientRect(),d=Math.min(window.devicePixelRatio||1,2);
  if(gz.width!==Math.round(r.width*d)){gz.width=Math.round(r.width*d);gz.height=Math.round(r.height*d);}
  const w=gz.width/d,c=w/2,len=w*0.32;gctx.setTransform(d,0,0,d,0,0);gctx.clearRect(0,0,w,w);
  const q=camera.quaternion.clone().invert();
  const ax=[{v:new V3(1,0,0),c:'#F37321',l:'X'},{v:new V3(0,0,-1),c:'#F89B6C',l:'Y'},{v:new V3(0,1,0),c:'#FBB584',l:'Z'}]
    .map(a=>{const p=a.v.clone().applyQuaternion(q);return {...a,x:p.x,y:p.y,z:p.z};}).sort((a,b)=>a.z-b.z);
  gctx.beginPath();gctx.arc(c,c,2,0,Math.PI*2);gctx.fillStyle='#6F7C93';gctx.fill();
  ax.forEach(a=>{const ex=c+a.x*len,ey=c-a.y*len;gctx.globalAlpha=a.z<-0.2?0.45:1;
    gctx.strokeStyle=a.c;gctx.lineWidth=2;gctx.beginPath();gctx.moveTo(c,c);gctx.lineTo(ex,ey);gctx.stroke();
    gctx.fillStyle=a.c;gctx.beginPath();gctx.arc(c+a.x*(len+9),c-a.y*(len+9),8,0,Math.PI*2);gctx.fill();
    gctx.fillStyle='#000';gctx.font='600 11px "Barlow Condensed",sans-serif';gctx.textAlign='center';gctx.textBaseline='middle';gctx.fillText(a.l,c+a.x*(len+9),c-a.y*(len+9)+0.5);});
  gctx.globalAlpha=1;
}

/* resize + loop */
function resize3D(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
new ResizeObserver(resize3D).observe(host);resize3D();
const tmp=new V3();
function place(el,p){tmp.copy(p).project(camera);if(tmp.z>1||tmp.z<-1){el.style.display='none';return;}
  el.style.display='';el.style.left=((tmp.x+1)/2*host.clientWidth)+'px';el.style.top=((1-tmp.y)/2*host.clientHeight)+'px';}
let last=performance.now(),frame=0;
function loop(now){
  const dt=Math.min(0.05,(now-last)/1000);last=now;frame++;
  if(tween){const k=Math.min(1,(now-tween.t0)/tween.dur);const e=k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;
    camera.position.lerpVectors(tween.from.p,tween.to.p,e);controls.target.lerpVectors(tween.from.t,tween.to.t,e);if(k>=1)tween=null;}
  controls.update();
  if(!robot.paused){if(robot.hold>0){robot.hold-=dt;if(robot.hold<=0){robot.s=0;robot.idx=0;}}
    else{robot.s+=robot.speed*dt;if(robot.s>=robot.total){robot.s=robot.total;robot.hold=2.5;}}
    if(frame%3===0)requestDraw();}
  placeRobot();
  if(!reduce){const ph=(now/1000)%1.6/1.6;rbRing.scale.setScalar(1+ph*0.9);rbRing.material.opacity=0.6*(1-ph);}
  if(pendingMove){pick(pendingMove);pendingMove=null;}
  if(frame%10===0)updateRobotStatus();
  frLabels.forEach(l=>{if(!l.el.hidden)place(l.el,l.p);});place(selLabel,selLabelPos);
  renderer.render(scene,camera);drawGizmo();
  requestAnimationFrame(loop);
}
setMode('real');selectFR(state.selFR);updateRobotStatus();
if(window.innerWidth<820)$('#layers').open=false;
requestAnimationFrame(loop);
})();
