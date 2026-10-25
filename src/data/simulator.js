/* =========================================================
   시뮬레이터 데이터 소스: 계획 경로를 따라 로봇을 움직이며 pose / measurement / state를 보낸다.
   ========================================================= */
import { RobotSource } from './robotSource.js';
import { createSynth } from './synth.js';
import { FS, ZONES, zoneOf, strakeName } from '../hull.js';

export const BASE_SPEED=3.6;      // ×1 재생 속도의 로봇 주행 속도 (m/s, 시연용)
const TICK_MS=50;
const DONE_AGO_MS=60*60*1000;     // connect 때 보내는 직전 완료 결과의 종료 시각 (1시간 전)

export class SimulatorSource extends RobotSource{
  /* photos = {flaking:[url…], scratch:[url…]} : 손상 레코드에 종류별로 순서대로 연결 */
  constructor({photos={flaking:[],scratch:[]},seed=2491}={}){
    super();
    const values=createSynth(seed),cnt={flaking:0,scratch:0};
    this.base=this.plan.samples.filter(sm=>!sm.blocked).map(sm=>{
      const v=values(sm);let photo=null;
      if(v.defect){const list=photos[v.defect]||[];if(list.length)photo=list[cnt[v.defect]%list.length];cnt[v.defect]++;}
      return {id:sm.id,X:sm.X,Y:sm.Y,Z:sm.Z,fr:sm.fr,strake:sm.strake,side:sm.side,zone:sm.zone,...v,photo,_at:sm.at};
    });
    this.speed=1;this.timer=null;this.paused=false;this.s=0;this.next=0;this.k=0;this.last=0;
  }
  record(b,ts){const {_at,...r}=b;return {...r,ts};}

  connect(){
    const P=this.plan,end=Date.now()-DONE_AGO_MS;
    this.base.forEach(b=>this.emit('measurement',this.record(b,Math.round(end-(P.total-b._at)/BASE_SPEED*1000))));
    this.emit('state',{state:'done',progress:1,ts:end});
  }
  start(){
    this.halt();
    this.s=0;this.next=0;this.k=0;this.paused=false;
    this.emit('state',{state:'mapping',progress:0,ts:Date.now(),fresh:true});
    this.run();
  }
  pause(){
    if(!this.timer)return;
    this.halt();this.paused=true;
    this.emit('state',{state:'paused',progress:this.s/this.plan.total,ts:Date.now()});
  }
  resume(){
    if(!this.paused)return;
    this.paused=false;
    this.emit('state',{state:'mapping',progress:this.s/this.plan.total,ts:Date.now()});
    this.run();
  }
  stop(){
    if(!this.timer&&!this.paused)return;
    this.halt();this.paused=false;
    this.emit('state',{state:'done',progress:this.s/this.plan.total,ts:Date.now()});
  }
  run(){this.last=performance.now();this.timer=setInterval(()=>this.tick(),TICK_MS);this.tick();}
  halt(){if(this.timer){clearInterval(this.timer);this.timer=null;}}
  setSpeed(k){this.speed=k;}

  tick(){
    const now=performance.now(),dt=Math.min(0.25,(now-this.last)/1000);this.last=now;
    const P=this.plan;
    this.s=Math.min(P.total,this.s+BASE_SPEED*this.speed*dt);
    const ts=Date.now();
    while(this.next<this.base.length&&this.base[this.next]._at<=this.s)this.emit('measurement',this.record(this.base[this.next++],ts));
    this.emit('pose',this.pose(ts));
    if(this.s>=P.total)this.stop();
  }
  pose(ts){
    const P=this.plan,pts=P.points,cum=P.cum;
    while(this.k<pts.length-2&&cum[this.k+1]<=this.s)this.k++;
    const a=pts[this.k],b=pts[this.k+1],seg=(cum[this.k+1]-cum[this.k])||1,t=Math.min(1,Math.max(0,(this.s-cum[this.k])/seg));
    const X=a.X+(b.X-a.X)*t,Y=a.Y+(b.Y-a.Y)*t,Z=a.Z+(b.Z-a.Z)*t,u=a.u+(b.u-a.u)*t;
    return {ts,X,Y,Z,fr:Math.round(X/FS),strake:strakeName(Math.abs(u)),side:u<0?'S':'P',zone:ZONES[zoneOf(X,Z)],
      heading:{X:b.X-a.X,Y:b.Y-a.Y,Z:b.Z-a.Z},k:this.k,progress:this.s/P.total};
  }
}
