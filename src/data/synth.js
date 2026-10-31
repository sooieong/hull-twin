/* =========================================================
   시뮬레이터용 측정값 생성 (예시 데이터, SPEC-v3 11.4–11.6 · SPEC v6 14.1) — 가정값은 모두 baseline.js
   판 = plates.js의 판 (프레임 구간 PLATE_FRAMES개 × 외판열 1개, K는 좌우현에 걸친 한 판). 보수 구역 1건 = 판 1장이라 이상은 판 단위로 놓는다.
   - 강판: 일반 감소는 원두께의 1–2 % (경하 흘수선 띠·빌지 상부가 크고 선수부 × 1.2). 경고·주의는 국부 공식(PITTING.sites)의
     판에서만 나온다 — 곳마다 정해진 판 수, 판마다 가운데 점이 가장 깊다. 1차에는 국부 공식이 없고 일반 감소도 거의 없다.
   - 최우선 보수: 국부 공식의 top 판. 그 판 전체가 도막 경고이고 가운데 점에 도막 떨어짐 1건 (손상 건수와 따로 센다).
     나머지 국부 공식 판에는 도막 이상·손상을 두지 않는다.
   - 도막 두께: 덩어리(COAT.blobs)마다 판 몇 장을 통째로 채운다 (가운데 경고, 둘레 주의). 1차는 같은 덩어리의 가운데 일부.
     2차 주의 판은 빠른 판(5년 뒤 경고 예상)과 느린 판(1차 주의에서 넘어온 판 → 모자라면 얕은 새 주의)으로 나눈다 (COAT.slowShare).
   - 도막 손상: 2차 DAMAGE.events건. 앵커 주변 · 예인선 접촉점 · 펜더 라인에 스크래치 (DAMAGE.flaking에 맞춰 그중 일부는 3 m 안에
     도막 떨어짐이 함께), 수선부·씨체스트에는 도막 떨어짐만. 손상끼리는 DAMAGE.gap 이상 떨어져 1건이 한 묶음이다.
     1차는 2차 손상 자리 중 일부에서 더 작게 (DAMAGE.first).
   - 차수 순서: 1차 asFound(first) → 시뮬레이터가 권장 범위로 1차 정비(afterRepair) → 2차는 그 정비 후 값에서 5년 (current).
     그래서 2차의 “1차 리도킹 대비”와 감소 속도는 1차 보수 이력과 같은 값에서 잰다.
   측정점 전체(계획의 측정점)를 보고 한 번에 만든다. 같은 seed면 항상 같은 값이 나온다.
   ========================================================= */
import { FS, FRMIN, LETTERS, KEEL_BLOCKS } from '../hull.js';
import { CRITERIA } from './criteria.js';
import { PLATE_FRAMES } from './zones.js';
import { GRID, BOW_FR, SEED, DFT_DESIGN, PLATE_ORIG, COAT_ZONES, coatZoneOf, COAT, PLATE_LOSS, PITTING, DAMAGE } from './baseline.js';

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const r1=v=>Math.round(v*10)/10,r2=v=>Math.round(v*100)/100;

/* points on the shell surface (x, signed girth u): neighbours within a distance */
function surfaceIndex(S){
  const C=GRID,key=(i,j)=>i*100000+j,grid=new Map();
  S.forEach((s,k)=>{const q=key(Math.floor(s.X/C),Math.floor(s.u/C));let l=grid.get(q);if(!l)grid.set(q,l=[]);l.push(k);});
  return (X,u,r)=>{const out=[],n=Math.ceil(r/C),ci=Math.floor(X/C),cj=Math.floor(u/C);
    for(let i=ci-n;i<=ci+n;i++)for(let j=cj-n;j<=cj+n;j++){const l=grid.get(key(i,j));if(!l)continue;
      for(const k of l){const d=Math.hypot(S[k].X-X,S[k].u-u);if(d<=r)out.push(k);}}
    return out;};
}

/* the plates of the points (as plates.js: frame bin × strake, K one plate across the centreline):
   plates [{key, bin, gi (signed girth order, K 0, port +), side, keel, idx, fr (middle frame), X, u, zone (COAT_ZONES key of most points)}],
   plateOf[k] = the plate of point k, next(p) = the plates beside p (frame bin ± 1, strake ± 1) */
function platesOf(S,band){
  const m=new Map(),plateOf=new Array(S.length);
  S.forEach((s,k)=>{
    const bin=Math.floor((s.fr-FRMIN)/PLATE_FRAMES),si=s.strake==='K'?-1:LETTERS.indexOf(s.strake),gi=si<0?0:s.side==='P'?si+1:-(si+1),key=bin*100+gi;
    let p=m.get(key);if(!p)m.set(key,p={key,bin,gi,side:si<0?'C':s.side,keel:si<0,idx:[]});
    p.idx.push(k);plateOf[k]=p;
  });
  for(const p of m.values()){
    const zc={};let X=0,u=0;
    for(const k of p.idx){X+=S[k].X;u+=S[k].u;zc[band[k]]=(zc[band[k]]||0)+1;}
    p.X=X/p.idx.length;p.u=u/p.idx.length;p.fr=FRMIN+p.bin*PLATE_FRAMES+(PLATE_FRAMES-1)/2;
    p.zone=Object.keys(zc).sort((a,b)=>zc[b]-zc[a])[0];
  }
  const next=p=>[[1,0],[-1,0],[0,1],[0,-1]].map(([db,dg])=>m.get((p.bin+db)*100+p.gi+dg)).filter(Boolean);
  return {plates:[...m.values()],plateOf,next};
}

/* samples: the plan's measurable points (blocked ones left out) → values(sample) */
export function createSynth(samples,seed=SEED){
  const S=samples,N=S.length,near=surfaceIndex(S),band=S.map(s=>coatZoneOf(s.Z).key);
  const pick=(rnd,list)=>list[Math.floor(rnd()*list.length)];
  const rr=rnd=>([a,b])=>a+(b-a)*rnd();
  const {plates,plateOf,next}=platesOf(S,band);
  /* n plates grown from a random seed over the neighbouring plates that pass ok, nearest first — null when no seed has room */
  function grow(rnd,seeds,ok,n){
    const pool=[...seeds];
    while(pool.length){
      const s0=pool.splice(Math.floor(rnd()*pool.length),1)[0],out=[s0],seen=new Set([s0.key]);
      for(let i=0;i<out.length&&out.length<n;i++)for(const q of next(out[i]))if(!seen.has(q.key)){seen.add(q.key);if(out.length<n&&ok(q))out.push(q);}
      if(out.length===n)return out;
    }
    return null;
  }

  /* ---------- 국부 공식 (2차): plates per site (최우선 보수 → 경고 → 주의, nearest first), sites PITTING.apart m apart ---------- */
  const rP=mulberry32(seed+11),uP=rr(rP),pit=new Float64Array(N);
  const site=new Map(),tops=[],placed=[];   // site: plate key → role (3 최우선 보수 · 2 경고 · 1 주의) · tops: [{p, c: its deepest point}]
  const fits=(w,s)=>(!w.bottom||s.Z<0.5)&&(!w.z||s.Z>=w.z[0]&&s.Z<=w.z[1]);
  const nearBlock=k=>Math.min(...KEEL_BLOCKS.map(b=>Math.abs(S[k].X-b.X)));
  for(const st of PITTING.sites){
    const w=st.where,roles=[...Array(st.top||0).fill(3),...Array(st.crit||0).fill(2),...Array(st.warn||0).fill(1)];
    const far=p=>placed.every(q=>Math.hypot(q.X-p.X,q.u-p.u)>=PITTING.apart);
    const ok=p=>!site.has(p.key)&&p.fr>=w.fr[0]&&p.fr<=w.fr[1]&&(!w.side||p.side===w.side)&&far(p)&&p.idx.filter(k=>fits(w,S[k])).length>=PITTING.minPts;
    const got=grow(rP,plates.filter(p=>ok(p)&&(!st.keel||p.keel)),ok,roles.length);
    if(!got){console.warn(`[DR.DOCK] 국부 공식 ${st.name}: 판 ${roles.length}장을 놓을 자리가 없습니다`);continue;}
    got.forEach((p,i)=>{
      const role=roles[i],pts=p.idx.filter(k=>fits(w,S[k]));
      // the deepest point: the middle of the plate's site points (on the keel plate: the one next to a keel block)
      const mx=pts.reduce((a,k)=>a+S[k].X,0)/pts.length,mu=pts.reduce((a,k)=>a+S[k].u,0)/pts.length;
      const c=pts.reduce((b,k)=>{const d=role===3&&st.keel?nearBlock(k):Math.hypot(S[k].X-mx,S[k].u-mu),db=role===3&&st.keel?nearBlock(b):Math.hypot(S[b].X-mx,S[b].u-mu);return d<db?k:b;});
      const peak=uP(PITTING.peak[role===3?'top':role===2?'crit':'warn']),{edge,R}=PITTING;
      for(const k of pts){const d=Math.hypot(S[k].X-S[c].X,S[k].u-S[c].u);if(d<=R)pit[k]=Math.max(pit[k],edge+(peak-edge)*(1-d/R)**2);}
      site.set(p.key,role);if(role===3)tops.push({p,c});
    });
    placed.push(...got);
  }

  /* ---------- 강판 일반 감소: 2차, 1차 = 2차 × firstShare ---------- */
  const G=PLATE_LOSS,bow=BOW_FR*FS;
  const general=S.map(s=>{const rnd=mulberry32(seed^Math.imul(s.id+1,2654435761));
    let g=rr(rnd)(G.general);
    if(s.Z>=G.band.z0&&s.Z<=G.band.z1)g+=G.band.add;
    if(s.Z>=G.bilgeTop.z0&&s.Z<=G.bilgeTop.z1)g+=G.bilgeTop.add;
    if(s.X>=bow)g*=G.bowFactor;
    return {g,first:g*rr(rnd)(G.firstShare)};});

  /* ---------- 도막 두께: plate-shaped patches. coat: plate key → {now: 'crit' 경고 | 'warn' 주의, first: 1차 'crit' | 'warn' | null,
     slow: 2차 주의 판의 속도 'carry' (1차 주의에서 넘어온 판) | 'shallow' (얕은 새 주의) | null (빠름)} ---------- */
  const coat=new Map(),blobOf=new Map();
  for(const {p} of tops)coat.set(p.key,{now:'crit',first:null,slow:null});
  COAT.blobs.forEach((b,bi)=>{
    const ok=p=>!site.has(p.key)&&!coat.has(p.key)&&p.idx.length>=COAT.minPts&&p.fr>=b.fr[0]&&p.fr<=b.fr[1]&&(!b.side||p.side===b.side)
      &&b.zone.includes(p.zone)&&next(p).every(q=>!blobOf.has(q.key)||blobOf.get(q.key)===bi);   // blobs keep clear of each other
    const got=grow(mulberry32(seed+31+bi*97),plates.filter(ok),ok,b.n);   // a seed per blob: one blob's change leaves the others where they are
    if(!got){console.warn(`[DR.DOCK] 도막 덩어리 ${bi+1}: 판 ${b.n}장을 놓을 자리가 없습니다`);return;}
    got.forEach((p,i)=>{blobOf.set(p.key,bi);
      coat.set(p.key,{now:i<b.crit?'crit':'warn',first:i<b.first.crit?'crit':i>=b.crit&&i<b.crit+b.first.warn?'warn':null,slow:null});});
  });

  /* ---------- 도막 손상 (2차): events per site (largest remainder), each a scratch line (+ flaking within 3 m on some) or flaking only.
     preset: damage already there (the 최우선 보수 flaking) → {out: Map index → {defect, area}, events: [{scratch:[k], flake:[k]}]} ---------- */
  const noDamage=new Uint8Array(N);
  for(const p of plates)if(site.has(p.key))for(const k of p.idx)noDamage[k]=1;
  function damage(rnd,n,flakes,preset){
    const u=rr(rnd),D=DAMAGE,out=new Map(preset),taken=[...preset.keys()],events=[];
    const sites=Object.entries(D.sites),raw=sites.map(([,w])=>w*n),cnt=raw.map(Math.floor);
    raw.map((v,i)=>[v-cnt[i],i]).sort((a,b)=>b[0]-a[0]).slice(0,n-cnt.reduce((a,b)=>a+b,0)).forEach(([,i])=>cnt[i]++);
    const tugs=D.tug.fr.flatMap(fr=>['S','P'].map(side=>({x:fr*FS,side})));
    const where={
      anchor:()=>s=>s.fr>=D.anchor.fr[0]&&s.fr<=D.anchor.fr[1]&&s.Z>=D.anchor.z[0]&&s.Z<=D.anchor.z[1],
      tug:k=>{const t=tugs[k%tugs.length];return s=>s.side===t.side&&Math.abs(s.X-t.x)<=D.tug.dx&&s.Z>=D.tug.z[0]&&s.Z<=D.tug.z[1];},
      fender:()=>s=>s.X>=D.fender.x[0]&&s.X<=D.fender.x[1]&&s.Z>=D.fender.z[0]&&s.Z<=D.fender.z[1],
      waterline:()=>s=>s.Z>=COAT_ZONES[1].z0&&s.Z<COAT_ZONES[0].z0,
      seaChest:k=>{const c=D.seaChest[k%D.seaChest.length];return s=>s.side===c.side&&Math.hypot(s.X-c.x,s.Z-c.z)<=2;}
    };
    const onlyFlaking=site=>site==='waterline'||site==='seaChest';
    // scratch events that get flaking beside them: the 경고 count left after the flaking-only places, spread evenly
    const nOnly=sites.reduce((a,[s],i)=>a+(onlyFlaking(s)?cnt[i]:0),0),nScratch=n-nOnly,withFlake=Math.max(0,Math.min(nScratch,flakes-nOnly));
    let e=0;const flakeAt=()=>{const f=Math.floor((e+1)*withFlake/nScratch)>Math.floor(e*withFlake/nScratch);e++;return f;};
    const free=k=>!noDamage[k]&&!out.has(k)&&taken.every(t=>Math.hypot(S[t].X-S[k].X,S[t].u-S[k].u)>D.gap);
    const flake=()=>({defect:'flaking',area:u(D.flaking.area)});
    const fixedN={tug:tugs.length,seaChest:D.seaChest.length};   // fixed positions taken in turn; one with no room left → the next
    sites.forEach(([site],si)=>{
      for(let ev=0;ev<cnt[si];ev++){
        const withF=!onlyFlaking(site)&&flakeAt();let done=false;
        for(let alt=0;alt<(fixedN[site]||1)&&!done;alt++){
          const f=where[site](ev+alt),all=S.map((s,k)=>k).filter(k=>f(S[k]));
          // 수선부 떨어짐: on a coating 경고 plate first (the coat already weak there)
          const weak=site==='waterline'?all.filter(k=>coat.get(plateOf[k].key)?.now==='crit'&&free(k)):[],cands=weak.length?weak:all;
          for(let tries=0;tries<1000;tries++){
            const c=pick(rnd,cands);if(c===undefined||!free(c))continue;
            const pts=new Map(),evt={scratch:[],flake:[]},same=k=>plateOf[k]===plateOf[c];   // one event stays on one plate
            if(onlyFlaking(site)){const m=1+Math.floor(rnd()*3);
              for(const k of [c,...near(S[c].X,S[c].u,1.6).filter(k=>k!==c&&same(k))].slice(0,m)){pts.set(k,flake());evt.flake.push(k);}}
            else{
              // scratch: len points in a row along the lane (same girth), the centre first
              const len=Math.round(u(D.scratch.len)),row=near(S[c].X,S[c].u,(len-1)*GRID+0.1).filter(k=>Math.abs(S[k].u-S[c].u)<0.01&&same(k)).sort((a,b)=>S[a].X-S[b].X);
              const i0=Math.max(0,Math.min(row.indexOf(c)-Math.floor(rnd()*len),row.length-len));
              row.slice(i0,i0+len).forEach(k=>{pts.set(k,{defect:'scratch',area:u(D.scratch.area)});evt.scratch.push(k);});
              if(withF){const ring=near(S[c].X,S[c].u,D.flakeNear.r).filter(k=>!pts.has(k)&&same(k)&&free(k)),m=1+Math.floor(rnd()*2);
                if(!ring.length)continue;
                for(let j=0;j<m&&ring.length;j++){const k=ring.splice(Math.floor(rnd()*ring.length),1)[0];pts.set(k,flake());evt.flake.push(k);}}
            }
            if(![...pts.keys()].every(free))continue;
            for(const [k,v] of pts){out.set(k,v);taken.push(k);}
            events.push(evt);done=true;break;
          }
        }
      }
    });
    if(events.length<n)console.warn(`[DR.DOCK] 손상 ${n}건 중 ${events.length}건만 배치했습니다`);
    return {out,events};
  }
  /* 1차 손상: the 2차 places, smaller — DAMAGE.first flaking (flaking-only places first) and scratch, one plate each (all different),
     none on a plate with a 1차 coating abnormality → Map index → {defect, area} */
  function firstDamage(rnd,{out:D2,events},avoid){
    const F=DAMAGE.first,u=rr(rnd),out=new Map(),usedP=new Set(),usedE=new Set();
    const order=events.map((_,i)=>i);for(let i=order.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
    const one=pts=>{const ks=new Set(pts.map(k=>plateOf[k].key));if(ks.size!==1)return false;const [key]=ks;return !avoid.has(key)&&!usedP.has(key);};
    const take=(i,pts,defect)=>{for(const k of pts)out.set(k,{defect,area:D2.get(k).area*u(F.shrink)});usedP.add(plateOf[pts[0]].key);usedE.add(i);};
    let nf=0,ns=0;
    for(const pass of [e=>!e.scratch.length,e=>e.scratch.length>0])
      for(const i of order){const e=events[i];if(nf>=F.flaking)break;if(usedE.has(i)||!e.flake.length||!pass(e))continue;
        const pts=e.flake.slice(0,1);if(one(pts)){take(i,pts,'flaking');nf++;}}
    for(const i of order){const e=events[i];if(ns>=F.scratch)break;if(usedE.has(i)||!e.scratch.length)continue;
      const pts=e.scratch.slice(0,Math.max(1,e.scratch.length-1));if(one(pts)){take(i,pts,'scratch');ns++;}}
    if(nf<F.flaking||ns<F.scratch)console.warn(`[DR.DOCK] 1차 손상: 도막 떨어짐 ${nf}/${F.flaking}건, 스크래치 ${ns}/${F.scratch}건만 배치했습니다`);
    return out;
  }

  const rT=mulberry32(seed+23),topFlakes=new Map(tops.map(({c})=>[c,{defect:'flaking',area:rr(rT)(PITTING.topFlake.area)}]));
  const D2=damage(mulberry32(seed+21),DAMAGE.events.current,DAMAGE.flaking.current,topFlakes);
  const firstCoat=new Set([...coat].filter(([,c])=>c.first).map(([k])=>k));
  const D1=firstDamage(mulberry32(seed+22),D2,firstCoat);

  // 느린 주의 판: 1차 주의에서 넘어온 판, 모자라면 1차에 보수하지 않은 판에서 얕은 새 주의 (1차 손상 판은 1차에 칠했으므로 뺀다)
  const warn2=[...coat].filter(([,c])=>c.now==='warn'),damaged1=new Set([...D1.keys()].map(k=>plateOf[k].key));
  warn2.forEach(([,c])=>{if(c.first==='warn')c.slow='carry';});
  const rS=mulberry32(seed+34),fresh=warn2.filter(([k,c])=>!c.slow&&!damaged1.has(k));
  let need=Math.round(COAT.slowShare*warn2.length)-warn2.filter(([,c])=>c.slow).length;
  while(need-->0&&fresh.length)fresh.splice(Math.floor(rS()*fresh.length),1)[0][1].slow='shallow';

  const hash=s=>Math.imul(s.id+1,2654435761);
  // AI 손상 판별 신뢰도 (%) — 모델이 아직 없어 85–98% 예시값. 실제 모델 결과(JSON)의 값으로 이 필드만 바꾸면 된다
  const ai=(d,rnd)=>d?Math.round(85+13*rnd()):null;

  /* ---------- 1차 리도킹 asFound (정비 전 측정) ---------- */
  const first=new Map();
  S.forEach((s,k)=>{
    const rnd=mulberry32((seed+7)^hash(s)),design=DFT_DESIGN[s.zone],orig=PLATE_ORIG[s.zone],d1=D1.get(k),f=coat.get(plateOf[k].key)?.first;
    const loss=rr(rnd)(f==='crit'?COAT.loss.crit:f==='warn'?COAT.loss.first:COAT.loss.normal);
    first.set(s.id,{dft:Math.round(design*(1-loss)),plate:r1(orig*(1-general[k].first)),
      defect:d1?d1.defect:null,defectArea:d1?r2(d1.area):0,aiConfidence:ai(d1,rnd)});
  });

  /* ---------- 2차 (현재): 1차 정비 후(afterRepair) 값에서 5년 ----------
     after: Map id → {dft, plate, plateReplaced} = 1차 리도킹 기록의 정비 후 값 (simulator: 권장 범위로 정비, SPEC 13 #11).
     2차의 dftPrev·platePrev(“1차 리도킹 대비”, 상세 그림의 “1차” 치수선)는 이 값 그대로다.
     - 도막: 이상 판은 판 전체가 그 판정 (경고 · 빠른 주의 · 얕은 주의). 1차 주의에서 넘어온 판은 그 값에서 COAT.carry만큼 더 줄고
       주의에 머문다. 나머지 점은 정상 마모 COAT.wear (주의 기준 아래까지). 1차 정비 후 값보다 두꺼워지지 않는다.
     - 강판: 1차 값에서 (2차 감소 − 1차 감소)만큼 더 준다 */
  function current(after){
    const out=new Map();
    S.forEach((s,k)=>{
      const rnd=mulberry32((seed+8)^hash(s)),u=rr(rnd),design=DFT_DESIGN[s.zone],orig=PLATE_ORIG[s.zone],a=after.get(s.id),d2=D2.out.get(k);
      const p=a.dft/design,c=coat.get(plateOf[k].key),L=COAT.loss;
      let ratio;
      if(!c)ratio=Math.min(p,Math.max(p-u(COAT.wear),1-L.normalMax));
      else if(c.now==='crit')ratio=Math.min(p,1-u(L.crit));
      else if(c.slow==='carry'&&1-p>=CRITERIA.dft.warn)ratio=1-Math.min(1-p+u(COAT.carry),CRITERIA.dft.crit-0.01);
      else ratio=Math.min(p,1-u(c.slow?L.shallow:L.fast));
      const loss=Math.min(0.4,Math.max(general[k].g,pit[k])),more=Math.max(0,loss-general[k].first);
      out.set(s.id,{
        dft:Math.round(design*Math.max(0.05,ratio)),dftDesign:design,dftPrev:a.dft,
        plate:r1(a.plateReplaced?a.plate-orig*more:Math.min(orig*(1-loss),a.plate)),plateOrig:orig,platePrev:a.plate,
        defect:d2?d2.defect:null,defectArea:d2?r2(d2.area):0,aiConfidence:ai(d2,rnd)
      });
    });
    return sm=>out.get(sm.id);
  }
  return {first:sm=>first.get(sm.id),current};
}
