/* =========================================================
   측정 데이터 저장소: 데이터 소스를 구독해 상태를 들고 있고, 화면들은 이 저장소를 구독한다.
   변경 알림은 마이크로태스크 단위로 묶어서 한 번만 보낸다: fn(Set<'records'|'pose'|'state'>)
   - state 'mapping' 진입: 기존 측정 결과를 비운다 (SPEC 4.1)
   - 매핑 도중 종료: 이번 측정분만 남긴다
   ========================================================= */
export function createStore(source){
  let mapState='idle',pose=null,progress=0,lastTs=null,version=0;
  let records=[];const byId=new Map();
  const subs=new Set();let pending=null;

  function changed(kind){
    if(!pending){pending=new Set();queueMicrotask(()=>{const k=pending;pending=null;subs.forEach(fn=>fn(k));});}
    pending.add(kind);
  }
  source.on('state',d=>{
    if(d.state==='mapping'&&mapState!=='mapping'){records=[];byId.clear();lastTs=null;pose=null;version++;changed('records');}
    mapState=d.state;if(d.progress!=null)progress=d.progress;changed('state');
  });
  source.on('measurement',r=>{
    const old=byId.get(r.id);
    if(old)records[records.indexOf(old)]=r;else records.push(r);
    byId.set(r.id,r);lastTs=r.ts;version++;changed('records');
  });
  source.on('pose',p=>{pose=p;progress=p.progress;changed('pose');});

  return {
    subscribe(fn){subs.add(fn);return ()=>subs.delete(fn);},
    get mapState(){return mapState;},
    get pose(){return pose;},
    get progress(){return progress;},
    get records(){return records;},       // 읽기 전용으로 쓸 것
    get version(){return version;},       // records가 바뀔 때마다 증가 (파생값 캐시용)
    get lastTs(){return lastTs;},
    get:id=>byId.get(id),
    plan:source.plan,
    connect:()=>source.connect(),
    start:()=>source.start(),
    stop:()=>source.stop(),
    setSpeed:k=>source.setSpeed(k)
  };
}
