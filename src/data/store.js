/* =========================================================
   측정 데이터 저장소: 데이터 소스를 구독해 상태를 들고 있고, 화면들은 이 저장소를 구독한다.
   변경 알림은 마이크로태스크 단위로 묶어서 한 번만 보낸다: fn(Set<'records'|'pose'|'state'>)
   - 처음부터 매핑(state 'mapping', fresh): 기존 측정 결과를 비운다 (SPEC 4.1)
   - 매핑 중지('paused')·이어서 매핑: 측정 결과·로봇 위치를 그대로 둔다 (SPEC 10.1)
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
    if(d.state==='mapping'&&d.fresh){records=[];byId.clear();lastTs=null;pose=null;version++;changed('records');}
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
    pause:()=>source.pause(),
    resume:()=>source.resume(),
    stop:()=>source.stop(),
    setSpeed:k=>source.setSpeed(k)
  };
}

/* 기록 보기 저장소: 이미 매핑을 마친 측정 결과 (state 'done' 고정, 매핑 명령은 받지 않는다) — 1차 리도킹 · 신조 인도(빈 기록) */
export function createRecordStore(records,plan){
  const byId=new Map(records.map(r=>[r.id,r])),lastTs=records.reduce((m,r)=>Math.max(m,r.ts||0),0)||null,none=()=>{};
  return {subscribe:()=>none,mapState:'done',pose:null,progress:1,records,version:0,lastTs,get:id=>byId.get(id),plan,
    connect:none,start:none,pause:none,resume:none,stop:none,setSpeed:none};
}

/* 도킹 선택: 화면들은 이 저장소 하나만 구독하고, 이것이 고른 도킹의 저장소(현재 매핑 · 기록)를 그대로 보여준다.
   도킹을 바꾸면 records·state·pose가 모두 바뀐 것으로 한 번에 알린다. 고르지 않은 저장소의 변경은 전하지 않는다
   (현재 매핑은 뒤에서 계속 진행된다). dockKey: 'current' | 'first' | 'newbuild' (docking.js) */
export function createDockStore(stores,key='current'){
  let active=key,epoch=0;const subs=new Set(),cur=()=>stores[active];
  Object.entries(stores).forEach(([k,s])=>s.subscribe(c=>{if(k===active)subs.forEach(fn=>fn(c));}));
  return {
    subscribe(fn){subs.add(fn);return ()=>subs.delete(fn);},
    get dockKey(){return active;},
    setDock(k){if(k===active||!stores[k])return;active=k;epoch++;const c=new Set(['records','state','pose']);subs.forEach(fn=>fn(c));},
    get mapState(){return cur().mapState;},
    get pose(){return cur().pose;},
    get progress(){return cur().progress;},
    get records(){return cur().records;},
    get version(){return epoch*1e9+cur().version;},
    get lastTs(){return cur().lastTs;},
    get:id=>cur().get(id),
    get plan(){return cur().plan;},
    connect:()=>cur().connect(),
    start:()=>cur().start(),
    pause:()=>cur().pause(),
    resume:()=>cur().resume(),
    stop:()=>cur().stop(),
    setSpeed:k=>stores.current.setSpeed(k)
  };
}
