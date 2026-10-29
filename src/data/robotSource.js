/* =========================================================
   로봇 데이터 소스 인터페이스 (SPEC 3.2)
   UI는 이 인터페이스만 본다. 시뮬레이터와 실제 하드웨어(WebSocket)는 같은 이벤트를 보낸다.

   이벤트
   - 'pose'        {ts, X, Y, Z, fr, strake, side, zone, heading:{X,Y,Z}, k, progress}
                   k = 계획 경로(plan.points)에서 지나온 점 번호, progress = 0–1
   - 'measurement' 측정 레코드 (SPEC 3.1). robot = 측정한 로봇 이름 (baseline.ROBOT, MAGNI).
                   손상 레코드에는 aiConfidence (AI 손상 판별 신뢰도 %, 손상이 없으면 null)
   - 'state'       {state:'idle'|'mapping'|'paused'|'done', progress, ts, fresh?}
                   fresh:true = 처음부터 새로 시작한 매핑 (UI는 기존 결과를 비운다). 이어서 매핑할 때는 없다.

   메서드
   - connect()     연결. 직전 완료 결과가 있으면 measurement들을 보낸 뒤 state 'done'
   - start()       처음부터 매핑 (state 'mapping', fresh:true)
   - pause()       매핑 중지. 위치·지나온 경로·측정 결과를 그대로 둔다 (state 'paused')
   - resume()      멈춘 위치에서 이어서 매핑 (state 'mapping')
   - stop()        매핑 끝내기 (state 'done')
   - setSpeed(k)   재생 배속 (시뮬레이터 전용, 하드웨어는 무시)
   - plan          계획 주행 경로 {points, cum, total, rows, samples} (scanPath.js)
   ========================================================= */
import { buildScanPath } from './scanPath.js';

export const SOURCE_EVENTS=['pose','measurement','state'];

export class RobotSource{
  constructor(){this._h={};this.plan=buildScanPath();}
  on(type,fn){(this._h[type]||(this._h[type]=new Set())).add(fn);return ()=>this._h[type].delete(fn);}
  emit(type,data){const h=this._h[type];if(h)h.forEach(fn=>fn(data));}
  connect(){}
  start(){}
  pause(){}
  resume(){}
  stop(){}
  setSpeed(_k){}
}

/* 실제 로봇: 서버가 {type:'pose'|'measurement'|'state', data} JSON을 보내고, {cmd:'start'|'pause'|'resume'|'stop'}을 받는다. */
export class WebSocketSource extends RobotSource{
  constructor(url){super();this.url=url;this.ws=null;}
  connect(){
    this.ws=new WebSocket(this.url);
    this.ws.addEventListener('message',e=>{
      let m;try{m=JSON.parse(e.data);}catch(_){return;}
      if(m&&SOURCE_EVENTS.includes(m.type))this.emit(m.type,m.data);
    });
  }
  _send(o){if(this.ws&&this.ws.readyState===WebSocket.OPEN)this.ws.send(JSON.stringify(o));}
  start(){this._send({cmd:'start'});}
  pause(){this._send({cmd:'pause'});}
  resume(){this._send({cmd:'resume'});}
  stop(){this._send({cmd:'stop'});}
}
