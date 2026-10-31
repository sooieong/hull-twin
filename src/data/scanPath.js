/* =========================================================
   외판 측정 경로 (SPEC 4.2, SPEC-v3 11.2–11.3) — 측정 로봇 6대 (baseline.ROBOTS)
   거스 방향으로 1.1 m 간격 레인을 두고, 레인을 따라 선수미 방향으로 왕복한다.
   측정점 (samples): 레인 순서 우현 최상단(건현) → … → 킬 → 좌현 … → 좌현 최상단, 레인마다 방향을 바꿔 가며 번호를 매긴다
     (측정점 번호·위치는 로봇 수와 상관없이 같다 — 측정값 생성이 이 번호를 쓴다).
   로봇 경로 (robots): 로봇마다 자기 현의 레인을 자기 구간(프레임 범위)만큼 왕복한다. 우현 로봇은 위 레인부터 킬 쪽으로,
     좌현 로봇은 킬 쪽부터 위로. 첫 레인은 선미 → 선수, 다음 레인은 반대로. 6대가 동시에 움직이므로 전체 시간은 가장 긴 경로.
     측정점마다 robot (ROBOTS 번호) · k (그 로봇 경로의 점 번호) · at (그 로봇 경로 위 거리, m)을 붙인다.
   측정은 레인 위 1.1 m마다 (측정 격자 1.1 m, 약 10,400점). 측정점은 m 좌표로 저장하고 프레임은 표시할 때만 쓴다.
   로봇 측정 가능 범위 (baseline.REACH) 안에서만 레인을 만든다:
     선측 x 10 m – 선수재, z 0.5–20.5 m · 선저 평판부 x 10–195 m, |y| ≤ 13 m · 측정 제외 구역(hull.unmeasurable: 벌브 앞코)은 뺀다
   킬 블록 접촉면은 지나가되 측정하지 않는다 (blocked = 측정 불가).
   프로펠러·러더·스케그 뒤끝·카운터 아랫면(x ≤ 10 m)과 선수 벌브 앞코는 범위 밖 (수동 측정).
   좌표: u = 부호 있는 거스(m, 킬 중심선 기준, 좌현 +). Y도 좌현 +.
   ========================================================= */
import { G, section, atGirth, strakeName, zoneOf, ZONES, frOf, KEEL_BLOCKS, BLOCK_SIZE, unmeasurable } from '../hull.js';
import { GRID, REACH, ROBOTS, robotFor } from './baseline.js';

const TURN_STEPS=8;            // 레인 사이 이동 구간 점 개수
export const ROBOT_MARGIN=0;   // 블록 접촉면 주변 측정 불가 여유 (m): 접촉면 |y| ≤ 0.6만

/* stations every GRID along x over the robot's reach */
const X0=REACH.side.x0,X1=Math.max(REACH.side.x1,REACH.bottom.x1);
const xs=[];for(let x=X0;x<=X1+1e-6;x+=GRID)xs.push(Math.round(x*1000)/1000);
const secs=xs.map(x=>section(x));
const gTop=Math.max(...secs.map(s=>s.gs[G-1]));

/* the shell point at girth g on station i, and whether the robot can measure there */
function pointAt(i,g){
  const p=atGirth(secs[i],g);if(!p)return null;
  const X=xs[i],R=REACH;
  const ok=p.bottom?X>=R.bottom.x0&&X<=R.bottom.x1&&p.Y<=R.bottom.y
    :X>=R.side.x0&&X<=R.side.x1&&p.Z>=R.side.z0&&p.Z<=R.side.z1;
  return {...p,ok:ok&&!unmeasurable(X,p.Z)};
}
function blocked(X,Y){
  const hx=BLOCK_SIZE.dx/2+ROBOT_MARGIN,hy=BLOCK_SIZE.dy/2+ROBOT_MARGIN;
  return KEEL_BLOCKS.some(b=>Math.abs(X-b.X)<=hx&&Math.abs(Y-b.Y)<=hy);
}
function surfaceAt(X,u,prev){
  const s=section(X);let g=Math.abs(u),p=atGirth(s,g);
  if(!p){g=Math.min(g,s.gs[G-1]*0.999);for(let k=0;k<20&&!p;k++){p=atGirth(s,g);g*=0.9;}}
  if(!p)return prev?{Y:prev.Y,Z:prev.Z,bottom:false}:{Y:0,Z:0,bottom:true};
  return {Y:u<0?-p.Y:p.Y,Z:p.Z,bottom:p.bottom};
}

/* one robot's route over lanes [{side, g, at}] (at: the lane's points per station): within its frame range, each lane from its
   first to its last measurable station there (points in between that cannot be measured are crossed), turning between lanes
   → {points, cum, total, rows}; stop(o, i, k) is told every measurable lane point (lane, station, point number) */
function route(lanes,inRange,stop){
  const rows=[],points=[];let dir=1;
  for(const o of lanes){
    const ok=i=>o.at[i]&&o.at[i].ok&&inRange(xs[i]);
    let i0=-1,i1=-1;for(let i=0;i<xs.length;i++)if(ok(i)){if(i0<0)i0=i;i1=i;}
    if(i0<0)continue;
    const sgn=o.side==='P'?1:-1,idx=[];for(let i=i0;i<=i1;i++)if(o.at[i])idx.push(i);if(dir<0)idx.reverse();
    const row={side:o.side,strake:strakeName(o.g),g:o.g,x0:xs[i0],x1:xs[i1],dir,start:0,end:0};
    // turn: straight move in (X, u) from the previous lane end
    const first={X:xs[idx[0]],u:sgn*o.g};
    if(points.length){const a=points[points.length-1];
      for(let k=1;k<TURN_STEPS;k++){const t=k/TURN_STEPS;const X=a.X+(first.X-a.X)*t,u=a.u+(first.u-a.u)*t;
        points.push({X,u,...surfaceAt(X,u,a),fr:frOf(X),row:-1,onRow:false,ok:false});}}
    row.start=points.length;
    for(const i of idx){const p=o.at[i],X=xs[i];
      if(p.ok)stop(o,i,points.length);
      points.push({X,u:sgn*o.g,Y:sgn*p.Y,Z:p.Z,bottom:p.bottom,fr:frOf(X),row:rows.length,onRow:true,ok:p.ok});}
    row.end=points.length-1;rows.push(row);dir=-dir;
  }
  // cumulative surface distance
  const cum=new Float64Array(points.length);
  for(let k=1;k<points.length;k++){const a=points[k-1],b=points[k];cum[k]=cum[k-1]+Math.hypot(b.X-a.X,b.Y-a.Y,b.Z-a.Z);}
  return {points,cum,total:cum.length?cum[cum.length-1]:0,rows};
}

/* → {robots: [{...ROBOTS[i], points, cum, total, rows}], total (the longest route = the time of the whole run, m), samples} */
export function buildScanPath(){
  // lane girths: GRID/2, 3·GRID/2, … up to the highest measurable point
  const girths=[];for(let g=GRID/2;g<gTop;g+=GRID)girths.push(Math.round(g*1000)/1000);
  const lane=(side,g)=>({side,g,at:xs.map((_,i)=>pointAt(i,g))});
  const S=girths.slice().reverse().map(g=>lane('S',g)),Pt=girths.map(g=>lane('P',g)),order=[...S,...Pt];

  // where each measurable lane point is on its robot's route: lane|station → {robot, k, at}
  const stopKey=(o,i)=>`${o.side}|${o.g}|${i}`,stops=new Map();
  const robots=ROBOTS.map((rb,ri)=>{
    const inRange=X=>robotFor(rb.side,frOf(X))===rb,lanes=rb.side==='S'?S:Pt,keys=[];
    const r=route(lanes,inRange,(o,i,k)=>keys.push([stopKey(o,i),k]));
    keys.forEach(([key,k])=>stops.set(key,{robot:ri,k,at:r.cum[k]}));
    return {...rb,...r};
  });

  // measurement samples: every measurable lane point (GRID apart), numbered along the lanes in the order above (each lane turning
  // back on the last); keel block contact areas are marked, not measured
  const samples=[];let dir=1,ri=0;
  for(const o of order){
    let i0=-1,i1=-1;for(let i=0;i<xs.length;i++)if(o.at[i]&&o.at[i].ok){if(i0<0)i0=i;i1=i;}
    if(i0<0)continue;
    const sgn=o.side==='P'?1:-1,strake=strakeName(o.g),idx=[];for(let i=i0;i<=i1;i++)if(o.at[i])idx.push(i);if(dir<0)idx.reverse();
    for(const i of idx){const p=o.at[i];if(!p.ok)continue;
      const X=xs[i],Y=sgn*p.Y,st=stops.get(stopKey(o,i));
      samples.push({id:samples.length,robot:st.robot,k:st.k,at:st.at,X,Y,Z:p.Z,u:sgn*o.g,fr:frOf(X),strake,side:o.side,
        zone:ZONES[zoneOf(X,p.Z)],row:ri,blocked:p.bottom&&blocked(X,Y)});}
    ri++;dir=-dir;
  }
  return {robots,total:Math.max(...robots.map(r=>r.total)),samples};
}
