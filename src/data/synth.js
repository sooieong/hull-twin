/* =========================================================
   시뮬레이터용 측정값 생성 (예시 데이터, SPEC-v3 11.4–11.6) — 가정값은 모두 baseline.js
   - 강판: 일반 감소는 원두께의 1–2 % (경하 흘수선 띠·빌지 상부가 크고 선수부 × 1.2). 경고·주의는 국부 공식(점 형태의
     깊은 감소, PITTING.sites)에서만 나온다. 1차에는 국부 공식이 없고 일반 감소도 거의 없다.
   - 도막 손상: 차수별 DAMAGE.events건. 앵커 주변 · 예인선 접촉점 · 펜더 라인에 스크래치, 그 3 m 안에 도막 떨어짐이 함께
     생긴다 (확률). 수선부·씨체스트에는 도막 떨어짐만. 손상끼리는 DAMAGE.gap 이상 떨어져 1건이 한 묶음이다.
   - 도막 두께: 대시보드 구역(COAT_ZONES)마다 측정점의 (부위 계수 × COAT.base) 비율이 이상(주의·경고)이 되도록
     이상 패치(타원)를 놓는다. 패치는 서로 붙지 않고, 경고 패치는 COAT.warnShare 비율이다 (차수별).
   - 최우선 보수: 국부 공식 중 top인 곳에만 도막 두께 주의 패치를 겹친다. 나머지 국부 공식 주변에는 도막 이상·손상을 두지 않는다.
   - 차수 순서: 1차 asFound(first) → 시뮬레이터가 권장 범위로 1차 정비(afterRepair) → 2차는 그 정비 후 값에서 5년 (current).
     그래서 2차의 “1차 리도킹 대비”와 감소 속도는 1차 보수 이력과 같은 값에서 잰다.
   측정점 전체(계획의 측정점)를 보고 한 번에 만든다. 같은 seed면 항상 같은 값이 나온다.
   ========================================================= */
import { FS, FRMIN, KEEL_HALF, STRAKE_W, KEEL_BLOCKS } from '../hull.js';
import { CRITERIA } from './criteria.js';
import { PLATE_FRAMES } from './zones.js';
import { GRID, BOW_FR, KEEL_BLOCK, SEED, DFT_DESIGN, PLATE_ORIG, COAT_ZONES, coatZoneOf, COAT, PLATE_LOSS, PITTING, DAMAGE } from './baseline.js';

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const r1=v=>Math.round(v*10)/10,r2=v=>Math.round(v*100)/100;
const CELL=GRID*GRID;

/* points on the shell surface (x, signed girth u): neighbours within a distance */
function surfaceIndex(S){
  const C=GRID,key=(i,j)=>i*100000+j,grid=new Map();
  S.forEach((s,k)=>{const q=key(Math.floor(s.X/C),Math.floor(s.u/C));let l=grid.get(q);if(!l)grid.set(q,l=[]);l.push(k);});
  return (X,u,r)=>{const out=[],n=Math.ceil(r/C),ci=Math.floor(X/C),cj=Math.floor(u/C);
    for(let i=ci-n;i<=ci+n;i++)for(let j=cj-n;j<=cj+n;j++){const l=grid.get(key(i,j));if(!l)continue;
      for(const k of l){const d=Math.hypot(S[k].X-X,S[k].u-u);if(d<=r)out.push(k);}}
    return out;};
}

/* samples: the plan's measurable points (blocked ones left out) → values(sample) */
export function createSynth(samples,seed=SEED){
  const S=samples,N=S.length,near=surfaceIndex(S),band=S.map(s=>coatZoneOf(s.Z).key);
  const pick=(rnd,list)=>list[Math.floor(rnd()*list.length)];
  const rr=rnd=>([a,b])=>a+(b-a)*rnd();

  /* ---------- 국부 공식 (2차): spots by kind, at least 15 m apart. A top spot sits in the middle of one plate
     (frame bin and strake), so its 최우선 보수 core stays one repair zone ---------- */
  const rP=mulberry32(seed+11),uP=rr(rP),spots=[];
  const midPlate=s=>{const g=Math.abs(s.u),p=(g-KEEL_HALF)%STRAKE_W;return (s.fr-FRMIN)%PLATE_FRAMES===(PLATE_FRAMES>>1)&&g>=KEEL_HALF&&p>=1.5&&p<=3;};
  const bow=BOW_FR*FS,nearBlock=s=>KEEL_BLOCKS.some(b=>Math.abs(s.X-b.X)<=KEEL_BLOCK.len/2+1.5);
  const kinds={
    block:s=>s.Z<0.5&&Math.abs(s.Y)>=0.7&&Math.abs(s.Y)<=2.4&&nearBlock(s),
    stern:(s,site)=>s.Z<0.5&&s.fr>=site.fr[0]&&s.fr<=site.fr[1],
    lightWL:(s,site)=>s.Z>=PLATE_LOSS.band.z0&&s.Z<=PLATE_LOSS.band.z1&&(site.bow?s.X>=bow:s.X>=20&&s.X<bow)
  };
  for(const site of PITTING.sites){
    const ok=s=>kinds[site.kind](s,site)&&spots.every(p=>Math.hypot(p.X-s.X,p.u-s.u)>=15);
    let c=S.filter(s=>ok(s)&&(!site.top||midPlate(s)));if(!c.length)c=S.filter(ok);   // no point mid-plate there: anywhere on the site
    if(!c.length)continue;
    const s=pick(rP,c);spots.push({X:s.X,u:s.u,peak:uP(PITTING.peak),r:uP(PITTING.r),top:!!site.top});
  }
  const pit=new Float64Array(N);
  for(const p of spots)for(const k of near(p.X,p.u,2*p.r)){const d=Math.hypot(S[k].X-p.X,S[k].u-p.u);pit[k]=Math.max(pit[k],p.peak*Math.exp(-((d/p.r)**2)));}
  // no coating abnormality near a spot that is not top, and no damage near any spot
  const noCoat=new Uint8Array(N),noDamage=new Uint8Array(N);
  for(const p of spots)for(const k of near(p.X,p.u,2*p.r+GRID)){noDamage[k]=1;if(!p.top)noCoat[k]=1;}

  /* ---------- 강판 일반 감소: 2차, 1차 = 2차 × firstShare ---------- */
  const G=PLATE_LOSS;
  const general=S.map(s=>{const rnd=mulberry32(seed^Math.imul(s.id+1,2654435761));
    let g=rr(rnd)(G.general);
    if(s.Z>=G.band.z0&&s.Z<=G.band.z1)g+=G.band.add;
    if(s.Z>=G.bilgeTop.z0&&s.Z<=G.bilgeTop.z1)g+=G.bilgeTop.add;
    if(s.X>=bow)g*=G.bowFactor;
    return {g,first:g*rr(rnd)(G.firstShare)};});

  /* ---------- 도막 손상: events per site (largest remainder), each a scratch line + flaking within 3 m, or flaking only ---------- */
  function damage(rnd,n){
    const u=rr(rnd),D=DAMAGE,out=new Map(),taken=[];   // out: index → {defect, area, ratio}
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
    const free=k=>!noDamage[k]&&!out.has(k)&&taken.every(t=>Math.hypot(S[t].X-S[k].X,S[t].u-S[k].u)>D.gap);
    const flake=()=>({defect:'flaking',area:u(D.flaking.area)});
    let placed=0;
    const fixedN={tug:tugs.length,seaChest:D.seaChest.length};   // fixed positions taken in turn; one with no room left → the next
    sites.forEach(([site],si)=>{
      for(let e=0;e<cnt[si];e++)for(let alt=0,done=false;alt<(fixedN[site]||1)&&!done;alt++){
        const f=where[site](e+alt),cands=S.map((s,k)=>k).filter(k=>f(S[k])),onlyFlaking=site==='waterline'||site==='seaChest';
        for(let tries=0;tries<1000;tries++){
          const c=pick(rnd,cands);if(c===undefined||!free(c))continue;
          const pts=new Map();
          if(onlyFlaking){const m=1+Math.floor(rnd()*3);
            for(const k of [c,...near(S[c].X,S[c].u,1.6).filter(k=>k!==c)].slice(0,m))pts.set(k,flake(k));}
          else{
            // scratch: len points in a row along the lane (same girth), the centre first
            const len=Math.round(u(D.scratch.len)),row=near(S[c].X,S[c].u,(len-1)*GRID+0.1).filter(k=>Math.abs(S[k].u-S[c].u)<0.01).sort((a,b)=>S[a].X-S[b].X);
            const i0=Math.max(0,Math.min(row.indexOf(c)-Math.floor(rnd()*len),row.length-len));
            row.slice(i0,i0+len).forEach(k=>pts.set(k,{defect:'scratch',area:u(D.scratch.area)}));
            if(rnd()<D.flakeNear.p){const ring=near(S[c].X,S[c].u,D.flakeNear.r).filter(k=>!pts.has(k)),m=1+Math.floor(rnd()*2);
              for(let j=0;j<m&&ring.length;j++){const k=ring.splice(Math.floor(rnd()*ring.length),1)[0];pts.set(k,flake(k));}}
          }
          if(![...pts.keys()].every(free))continue;
          for(const [k,v] of pts){out.set(k,v);taken.push(k);}
          placed++;done=true;break;
        }
      }
    });
    if(placed<n)console.warn(`[DR.DOCK] 손상 ${n}건 중 ${placed}건만 배치했습니다`);
    return out;
  }

  /* ---------- 도막 두께: abnormal patches per dashboard zone up to (coef × base) of its points ---------- */
  function coating(rnd,base,warnShare,topSpots,preset=null){   // preset {lv, loss}: abnormal points already there (count toward the targets)
    const u=rr(rnd),lv=preset?Int8Array.from(preset.lv):new Int8Array(N),loss=preset?Float64Array.from(preset.loss):new Float64Array(N);   // lv: 0 정상, 1 주의, 2 경고
    let share=rnd();   // 경고 patches: every 1 / warnShare-th patch (exactly warnShare of them), from a random start
    const lossOf=l=>u(l===2?COAT.loss.crit:COAT.loss.warn);
    // patch: points inside the ellipse (semi-axes a along x, b along the girth); clip = only this zone's points
    const inside=(c,a,b,clip)=>near(S[c].X,S[c].u,Math.max(a,b)).filter(k=>((S[k].X-S[c].X)/a)**2+((S[k].u-S[c].u)/b)**2<=1&&(!clip||band[k]===clip));
    const put=(pts,l)=>pts.forEach(k=>{if(lv[k])return;lv[k]=l;loss[k]=lossOf(l);});
    for(const p of topSpots){let c=0,best=1e9;S.forEach((s,k)=>{const d=Math.hypot(s.X-p.X,s.u-p.u);if(d<best){best=d;c=k;}});
      put(inside(c,p.r*1.3,p.r*1.1,null),1);}
    for(const z of COAT_ZONES){
      const idx=[];for(let k=0;k<N;k++)if(band[k]===z.key)idx.push(k);
      const target=Math.round(z.coef*base*idx.length);let have=idx.filter(k=>lv[k]).length,tries=0;
      while(have<target&&tries<3000){tries++;
        const c=pick(rnd,idx);if(lv[c]||noCoat[c])continue;
        const A=Math.max(COAT.area[0]*0.6,Math.min(u(COAT.area),(target-have)*CELL)),asp=u(COAT.aspect);
        const a=Math.sqrt(A*asp/Math.PI),b=Math.sqrt(A/asp/Math.PI),pts=inside(c,a,b,z.key);
        // a patch keeps clear of the others (a gap of one grid step) and of the spots without coating abnormality
        const gap=tries<2000?GRID*1.2:0;
        if(pts.some(k=>noCoat[k])||(gap&&inside(c,a+gap,b+gap,null).some(k=>lv[k])))continue;
        share+=warnShare;const l=share>=1?2:1;if(l===2)share-=1;put(pts,l);have=idx.filter(k=>lv[k]).length;
      }
    }
    return {lv,loss};
  }

  const D2=damage(mulberry32(seed+21),DAMAGE.events.current),D1=damage(mulberry32(seed+22),DAMAGE.events.first);
  const C1=coating(mulberry32(seed+32),COAT.base.first,COAT.warnShare.first,[]);
  const hash=s=>Math.imul(s.id+1,2654435761);
  // AI 손상 판별 신뢰도 (%) — 모델이 아직 없어 85–98% 예시값. 실제 모델 결과(JSON)의 값으로 이 필드만 바꾸면 된다
  const ai=(d,rnd)=>d?Math.round(85+13*rnd()):null;

  /* ---------- 1차 리도킹 asFound (정비 전 측정) ---------- */
  const first=new Map();
  S.forEach((s,k)=>{
    const rnd=mulberry32((seed+7)^hash(s)),design=DFT_DESIGN[s.zone],orig=PLATE_ORIG[s.zone],d1=D1.get(k);
    first.set(s.id,{dft:Math.round(design*(1-(C1.lv[k]?C1.loss[k]:rr(rnd)(COAT.loss.normal)))),plate:r1(orig*(1-general[k].first)),
      defect:d1?d1.defect:null,defectArea:d1?r2(d1.area):0,aiConfidence:ai(d1,rnd)});
  });

  /* ---------- 2차 (현재): 1차 정비 후(afterRepair) 값에서 5년 ----------
     after: Map id → {dft, plate, plateReplaced} = 1차 리도킹 기록의 정비 후 값 (simulator: 권장 범위로 정비, SPEC 13 #11).
     2차의 dftPrev·platePrev(“1차 리도킹 대비”, 상세 그림의 “1차” 치수선)는 이 값 그대로다.
     - 도막: 1차에 고치지 않은 이상(감소율 주의 이상)은 그대로 남아 COAT.carry만큼 더 줄고, 구역 목표에 먼저 든다.
       나머지 점은 정상 마모 COAT.wear (주의 기준 아래까지), 이상 패치는 그 위에 새로 생긴다. 1차 값보다 두꺼워지지 않는다.
     - 강판: 1차 값에서 (2차 감소 − 1차 감소)만큼 더 준다 */
  function current(after){
    const prevRatio=S.map((s,k)=>after.get(s.id).dft/DFT_DESIGN[s.zone]);
    const carry={lv:new Int8Array(N),loss:new Float64Array(N)},rc=mulberry32(seed+33),uc=rr(rc);
    // a carried abnormality keeps its judgement (a 주의 area stays 주의: one zone, not a 경고 core cut out of it)
    prevRatio.forEach((p,k)=>{const l0=1-p;if(l0<CRITERIA.dft.warn)return;const lv=l0>=CRITERIA.dft.crit?2:1;
      carry.loss[k]=Math.min(l0+uc(COAT.carry),lv===2?COAT.loss.crit[1]:CRITERIA.dft.crit-0.01);carry.lv[k]=lv;});
    const C2=coating(mulberry32(seed+31),COAT.base.current,COAT.warnShare.current,spots.filter(p=>p.top),carry),out=new Map();
    S.forEach((s,k)=>{
      const rnd=mulberry32((seed+8)^hash(s)),design=DFT_DESIGN[s.zone],orig=PLATE_ORIG[s.zone],a=after.get(s.id),d2=D2.get(k),p=prevRatio[k];
      const ratio=C2.lv[k]?Math.min(p,1-C2.loss[k]):Math.min(p,Math.max(p-rr(rnd)(COAT.wear),1-COAT.loss.normalMax));
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
