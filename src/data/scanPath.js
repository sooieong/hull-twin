/* =========================================================
   전체 외판 순회 경로 (SPEC 4.2)
   외판열(strake)을 따라 선수미 방향으로 왕복한다.
   순서: 우현 최상단 외판열(건현) → … → A → K(우현 절반) → K(좌현 절반) → A → … → 좌현 최상단
   첫 외판열은 선미 → 선수, 다음 외판열은 선수 → 선미.
   좌표: u = 부호 있는 거스(m, 킬 중심선 기준, 좌현 +). Y도 좌현 +.
   ========================================================= */
import { FS, FRMAX, G, KEEL_HALF, STRAKE_W, LETTERS, section, atGirth, strakeLower, zoneOf, ZONES,
  KEEL_BLOCKS, BLOCK_SIZE } from '../hull.js';

export const SAMPLE_EVERY=3;   // 측정 간격: 3 프레임 (2.55 m)
const MIN_STRAKE=0.8;          // 이 폭보다 좁게 남은 외판열 끝단은 주행하지 않음 (m)
const TURN_STEPS=8;            // 외판열 사이 이동 구간 점 개수
const ROBOT_MARGIN=0.6;        // 블록 접촉면 주변 측정 불가 여유 (m)

const secs=[];for(let fr=0;fr<=FRMAX;fr++)secs.push(section(fr*FS));

/* 외판열 하나(하단 거스 lower, 목표 중심 거스 gc)의 주행 가능한 최장 연속 프레임 구간 */
function rowRange(lower,gc){
  let best=null,cur=null;
  for(let fr=0;fr<=FRMAX;fr++){
    const s=secs[fr],gt=s.gs[G-1];
    const g=Math.min(gc,(lower+gt)/2);
    const ok=gt>lower+MIN_STRAKE&&atGirth(s,g)!==null;
    if(ok){if(!cur)cur={fr0:fr,fr1:fr};else cur.fr1=fr;if(!best||cur.fr1-cur.fr0>best.fr1-best.fr0)best={...cur};}
    else cur=null;
  }
  return best;
}
function rowGirth(fr,lower,gc){return Math.min(gc,(lower+secs[fr].gs[G-1])/2);}

function surfaceAt(X,u,prev){
  const fr=Math.round(X/FS),s=Math.abs(fr*FS-X)<1e-6?secs[fr]:section(X);
  let g=Math.abs(u),p=atGirth(s,g);
  if(!p){g=Math.min(g,s.gs[G-1]*0.999);for(let k=0;k<20&&!p;k++){p=atGirth(s,g);g*=0.9;}}
  if(!p)return prev?{Y:prev.Y,Z:prev.Z,bottom:false}:{Y:0,Z:0,bottom:true};
  return {Y:u<0?-p.Y:p.Y,Z:p.Z,bottom:p.bottom};
}

function blocked(X,Y){
  const hx=BLOCK_SIZE.dx/2+ROBOT_MARGIN,hy=BLOCK_SIZE.dy/2+ROBOT_MARGIN;
  return KEEL_BLOCKS.some(b=>Math.abs(X-b.X)<hx&&Math.abs(Y-b.Y)<hy);
}

export function buildScanPath(){
  // strakes present anywhere along the hull: K(-1), A(0) … top
  const gMax=Math.max(...secs.map(s=>s.gs[G-1]));
  let top=0;while(top+1<LETTERS.length&&strakeLower(top+1)+MIN_STRAKE<gMax)top++;
  const order=[];
  for(let i=top;i>=0;i--)order.push({side:'S',i});
  order.push({side:'S',i:-1},{side:'P',i:-1});
  for(let i=0;i<=top;i++)order.push({side:'P',i});

  const rows=[],points=[];let dir=1;
  for(const o of order){
    const lower=strakeLower(o.i),gc=o.i<0?KEEL_HALF/2:lower+STRAKE_W/2;
    const rg=rowRange(lower,gc);if(!rg)continue;
    const sgn=o.side==='P'?1:-1,strake=o.i<0?'K':LETTERS[o.i];
    const frs=[];for(let fr=rg.fr0;fr<=rg.fr1;fr++)frs.push(fr);if(dir<0)frs.reverse();
    const row={side:o.side,strake,fr0:rg.fr0,fr1:rg.fr1,dir,start:0,end:0};
    // turn: straight move in (X, u) from the previous row end
    const first={X:frs[0]*FS,u:sgn*rowGirth(frs[0],lower,gc)};
    if(points.length){const a=points[points.length-1];
      for(let k=1;k<TURN_STEPS;k++){const t=k/TURN_STEPS;const X=a.X+(first.X-a.X)*t,u=a.u+(first.u-a.u)*t;
        points.push({X,u,...surfaceAt(X,u,a),fr:Math.round(X/FS),row:-1,onRow:false});}}
    row.start=points.length;
    for(const fr of frs){const X=fr*FS,u=sgn*rowGirth(fr,lower,gc);
      points.push({X,u,...surfaceAt(X,u,points[points.length-1]),fr,row:rows.length,onRow:true});}
    row.end=points.length-1;rows.push(row);dir=-dir;
  }
  // cumulative surface distance
  const cum=new Float64Array(points.length);
  for(let k=1;k<points.length;k++){const a=points[k-1],b=points[k];cum[k]=cum[k-1]+Math.hypot(b.X-a.X,b.Y-a.Y,b.Z-a.Z);}
  // measurement samples: every SAMPLE_EVERY frames on each row; block contact areas are marked, not measured
  const samples=[];
  rows.forEach((row,ri)=>{
    for(let k=row.start;k<=row.end;k++){const p=points[k];if(p.fr%SAMPLE_EVERY)continue;
      samples.push({id:samples.length,k,at:cum[k],X:p.X,Y:p.Y,Z:p.Z,u:p.u,fr:p.fr,strake:row.strake,side:row.side,
        zone:ZONES[zoneOf(p.X,p.Z)],row:ri,blocked:p.bottom&&blocked(p.X,p.Y)});}
  });
  return {points,cum,total:cum[cum.length-1],rows,samples};
}
