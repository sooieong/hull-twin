/* =========================================================
   시뮬레이터 데이터 소스: 로봇 6대(baseline.ROBOTS)를 각자의 계획 경로를 따라 동시에 움직이며 pose / measurement / state를 보낸다.
   시간 s(m) = 한 대가 지나온 거리 — 모든 로봇이 같은 속도로 함께 출발하고, 경로가 끝난 로봇은 그 자리에 멈춘다.
   측정점은 자기 로봇이 지나간 순간에 들어온다 (로봇 경로 위 거리 at). 진행률 = 6대가 지나온 거리의 합 ÷ 경로 길이의 합.
   측정값은 측정점 번호로 만들어지므로 로봇 수와 상관없이 같다.
   ========================================================= */
import { RobotSource } from './robotSource.js';
import { createSynth } from './synth.js';
import { photoFor } from './photos.js';
import { FS, ZONES, zoneOf, strakeName } from '../hull.js';
import { ROBOTS, SEED, DFT_DESIGN, PLATE_ORIG } from './baseline.js';

import { LAYERS, OK, judge } from './criteria.js';
import { platesOf } from './plates.js';
import { planOf, DEFAULT_LEVEL } from '../plan/scenario.js';

export const BASE_SPEED=3.6;      // ×1 재생 속도의 로봇 주행 속도 (m/s, 시연용)

/* 지난 도킹의 정비 결과 (afterRepair): 정비 전 측정(R의 값 = asFound)에 보수 범위 level의 계획(plan/scenario.planOf)을 그대로 한 것.
   - 강판 교체·보강 판: 판의 모든 점이 원두께 (plateReplaced)
   - 재도장 판 (판 전체): 모든 점의 도막이 설계의 102–112% (점마다 정해진 값, 정비 전과 같은 값이면 1 µm 더)
   - 국부 보수·터치업 판: 이상 지점(어느 레이어든 주의 이상)의 도막만 다시 칠함
   - 그 밖의 점: 정비 전 그대로
   보수 이력 화면(scenario.historyResult)은 정비 전·후 두께가 다른 판을 그대로 읽으므로, 그때 보수한 판 = 이 계획의 판이다.
   2차 데이터는 이 정비 후 값에서 만든다 (synth.current): 2차 레코드의 dftPrev·platePrev(“1차 리도킹 대비”)가 이 값이다. */
function repairedAt(R,plan,level){
  const tmp={records:R,plan,version:-1};   // a store of its own for the plate / plan caches (never the version of a real store)
  const works=planOf(tmp,level),{plates}=platesOf(tmp);
  const frac=id=>(Math.imul(id+7,2654435761)>>>0)/4294967296;   // a fixed 0–1 per point
  const coat=r=>{const d=Math.round(r.dftDesign*(1.02+0.1*frac(r.id)));return d===r.dft?d+1:d;};
  const fix=new Map();
  for(const p of plates){const w=works.get(p.id);if(!w)continue;
    for(const r of p.records){
      const spot=w.spot&&LAYERS.some(l=>judge(r,l).level>OK);
      fix.set(r.id,{plate:w.steel?r.plateOrig:r.plate,plateReplaced:!!w.steel,dft:w.paint==='full'||spot?coat(r):r.dft});}}
  return R.map(r=>({...r,afterRepair:fix.get(r.id)||{plate:r.plate,plateReplaced:false,dft:r.dft}}));
}
const TICK_MS=50;
const DONE_AGO_MS=60*60*1000;     // connect 때 보내는 직전 완료 결과의 종료 시각 (1시간 전)

export class SimulatorSource extends RobotSource{
  /* photos = loadDefectPhotos() {below|above:{flaking|scratch:[url…]}}: 손상 레코드마다 흘수선 위·아래와 종류에 맞는 사진을 id로 고른다 */
  constructor({photos=null,seed=SEED}={}){
    super();
    const samples=this.plan.samples.filter(sm=>!sm.blocked),gen=createSynth(samples,seed);
    // 1차 리도킹: 정비 전 측정(asFound) → 권장 범위로 정비(afterRepair) → 2차는 그 정비 후 값에서 5년 (synth.current)
    const pos=sm=>({id:sm.id,X:sm.X,Y:sm.Y,Z:sm.Z,fr:sm.fr,strake:sm.strake,side:sm.side,zone:sm.zone});
    const R1=samples.map(sm=>({...pos(sm),dftDesign:DFT_DESIGN[sm.zone],plateOrig:PLATE_ORIG[sm.zone],...gen.first(sm),dftPrev:null,platePrev:null}));
    const after=new Map(repairedAt(R1,this.plan,DEFAULT_LEVEL).map(r=>[r.id,r.afterRepair])),values=gen.current(after);
    // robot: the robot's name, robotId: its id (P1 …) — the same robot measured the point at both dockings
    const who=sm=>({robot:ROBOTS[sm.robot].name,robotId:ROBOTS[sm.robot].id});
    this.base=samples.map(sm=>{
      const v=values(sm),asFound=gen.first(sm),photo=photoFor(photos,v.defect,sm.id,sm.Z);
      return {...pos(sm),...v,...who(sm),photo,_at:sm.at,   // _first: 1차 리도킹 값 (firstDockRecords), 2차 레코드에는 넣지 않는다
        _first:{asFound,afterRepair:after.get(sm.id),photo:photoFor(photos,asFound.defect,sm.id,sm.Z,1)}};
    });
    // the order the points come in while mapping: by the time their robot reaches them (ties: point number)
    this.order=this.base.map((b,i)=>i).sort((a,b)=>this.base[a]._at-this.base[b]._at||a-b);
    this.speed=1;this.timer=null;this.paused=false;this.s=0;this.next=0;this.k=ROBOTS.map(()=>0);this.last=0;
  }
  record(b,ts){const {_at,_first,...r}=b;return {...r,ts};}
  /* 진행률 0–1 at time s: the distance the robots have gone over the length of all their routes */
  progressAt(s){const R=this.plan.robots;return R.reduce((a,r)=>a+Math.min(s,r.total),0)/R.reduce((a,r)=>a+r.total,0);}
  /* 1차 리도킹 기록 (같은 측정점): 화면 값(dft·plate·defect…)은 asFound(정비 전 측정), asFound·afterRepair 두 벌을 함께 싣는다.
     이보다 앞선 도킹(신조 인도)의 측정은 없어 …Prev는 비운다. end = 그때 매핑을 마친 시각 (예시)
     afterRepair (SPEC 13 #11): 1차 정비는 권장 범위(보수 범위 3단계)로 했다고 본다 — repairedAt */
  firstDockRecords(end=new Date(2021,9,15,17,0).getTime()){
    const P=this.plan;
    return this.base.map(({_at,_first:{asFound,afterRepair,photo},id,X,Y,Z,fr,strake,side,zone,dftDesign,plateOrig,robot,robotId})=>({
      id,X,Y,Z,fr,strake,side,zone,dftDesign,plateOrig,...asFound,dftPrev:null,platePrev:null,photo,asFound,afterRepair,robot,robotId,
      ts:Math.round(end-(P.total-_at)/BASE_SPEED*1000)}));
  }

  connect(){
    const P=this.plan,end=Date.now()-DONE_AGO_MS;
    this.base.forEach(b=>this.emit('measurement',this.record(b,Math.round(end-(P.total-b._at)/BASE_SPEED*1000))));
    this.emit('state',{state:'done',progress:1,ts:end});
  }
  start(){
    this.halt();
    this.s=0;this.next=0;this.k=ROBOTS.map(()=>0);this.paused=false;
    this.emit('state',{state:'mapping',progress:0,ts:Date.now(),fresh:true});
    this.run();
  }
  pause(){
    if(!this.timer)return;
    this.halt();this.paused=true;
    this.emit('state',{state:'paused',progress:this.progressAt(this.s),ts:Date.now()});
  }
  resume(){
    if(!this.paused)return;
    this.paused=false;
    this.emit('state',{state:'mapping',progress:this.progressAt(this.s),ts:Date.now()});
    this.run();
  }
  stop(){
    if(!this.timer&&!this.paused)return;
    this.halt();this.paused=false;
    this.emit('state',{state:'done',progress:this.progressAt(this.s),ts:Date.now()});
  }
  run(){this.last=performance.now();this.timer=setInterval(()=>this.tick(),TICK_MS);this.tick();}
  halt(){if(this.timer){clearInterval(this.timer);this.timer=null;}}
  setSpeed(k){this.speed=k;}

  tick(){
    const now=performance.now(),dt=Math.min(0.25,(now-this.last)/1000);this.last=now;
    const P=this.plan;
    this.s=Math.min(P.total,this.s+BASE_SPEED*this.speed*dt);
    const ts=Date.now();
    const O=this.order,B=this.base;
    while(this.next<O.length&&B[O[this.next]]._at<=this.s)this.emit('measurement',this.record(B[O[this.next++]],ts));
    this.emit('pose',this.pose(ts));
    if(this.s>=P.total)this.stop();
  }
  /* every robot where it is at time s: {ts, progress, robots: [{id, name, X, Y, Z, fr, strake, side, zone, heading, k, progress, done}]} */
  pose(ts){
    const s=this.s,robots=this.plan.robots.map((rb,i)=>{
      const pts=rb.points,cum=rb.cum,at=Math.min(s,rb.total);
      while(this.k[i]<pts.length-2&&cum[this.k[i]+1]<=at)this.k[i]++;
      const k=this.k[i],a=pts[k],b=pts[Math.min(k+1,pts.length-1)],seg=(cum[k+1]-cum[k])||1,t=Math.min(1,Math.max(0,(at-cum[k])/seg));
      const X=a.X+(b.X-a.X)*t,Y=a.Y+(b.Y-a.Y)*t,Z=a.Z+(b.Z-a.Z)*t,u=a.u+(b.u-a.u)*t;
      return {id:rb.id,name:rb.name,X,Y,Z,fr:Math.round(X/FS),strake:strakeName(Math.abs(u)),side:rb.side,zone:ZONES[zoneOf(X,Z)],
        heading:{X:b.X-a.X,Y:b.Y-a.Y,Z:b.Z-a.Z},k,progress:rb.total?at/rb.total:1,done:s>=rb.total};
    });
    return {ts,progress:this.progressAt(s),robots};
  }
}
