/* =========================================================
   판(plate) 데이터 (SPEC 12.4): 외판을 프레임 PLATE_FRAMES(7)개 구간 × 외판열 1개로 나눈 판 목록.
   - 프레임 구간은 보수 구역을 판 크기로 나누는 구간과 같다 (zones.js: 측정점의 프레임 번호 r.fr 기준) —
     보수 구역 하나가 길이 방향으로 두 판에 걸치지 않는다. FR50–56 = 프레임 50 … 56의 측정점.
   - 외판열: K(킬, 좌우현에 걸친 한 판 — 현측 '중심') · A, B, … (좌현·우현 따로)
   - 크기: 가로 = 판 길이(m, 선체 끝에서 잘림), 세로 = 거스 방향 폭의 평균(m, 맨 위 외판열은 갑판에서 잘림) · 면적 = 가로 × 세로
   - 원두께(mm): 판에 든 측정 계획점 구역의 원두께 중 가장 두꺼운 값 (측정점이 없으면 판 구역의 값) · 중량(t) = 면적 × 원두께 × 강재 밀도
   - 측정 불가: 측정 계획점(킬 블록 접촉면 제외)이 하나도 없는 판 — 로봇 범위 밖(선미 부가물, 벌브 끝, 갑판 가까이)과
     킬 블록 접촉면뿐인 판. 계획 대상에서 뺀다 (step = null).
   - zLo · zHi: 판 아래·위 끝 높이 (m, 판 가운데 단면) — 도장 구역과 설계 흘수선 아래 여부 (plan/scenario.js)
   - 판 번호: P- + 외판열 + 순번 (외판열마다 선미 → 선수, 같은 구간이면 우현 → 좌현, 두 자리) — 예: P-C12
   판 크기·번호 규칙·재질은 예시다 (SPEC 12.9). 실제 규칙이나 도면이 있으면 이 파일만 바꾼다.
   platesOf(store): 그 도킹의 측정점과 보수 구역('all')을 판에 연결하고 판마다 레이어별 최악 판정과 보수 단계를 계산한다.
   ========================================================= */
import { clamp, XMIN, XMAX, NX, FS, FRMIN, FRMAX, G, KEEL_HALF, STRAKE_W, LETTERS, ZONES, stX, stSec, atGirth, zoneOf, strakeLower } from '../hull.js';
import { LAYERS, OK, judge, isTop, gradeOf } from './criteria.js';
import { STEEL_DENSITY, PLATE_ORIG } from './baseline.js';
import { PLATE_FRAMES, groupZones } from './zones.js';
import { stepOf } from './repairSteps.js';

export const PLATE_MATERIAL='AH36';   // 재질 (예시)
export const PLATE_SIDE_LABEL={S:'우현',P:'좌현',C:'중심'};

const NBIN=Math.ceil((FRMAX-FRMIN+1)/PLATE_FRAMES);
const binOf=fr=>clamp(Math.floor((fr-FRMIN)/PLATE_FRAMES),0,NBIN-1);
const plateSide=(strake,side)=>strake==='K'?'C':side;
const keyOf=(bin,strake,side)=>`${bin}|${strake}|${plateSide(strake,side)}`;
/* girth width (m) of strake si (−1 = K, both sides) on a mesh section */
function widthAt(s,si){
  const top=s.gs[G-1];
  if(si<0)return 2*Math.min(top,KEEL_HALF);
  const lo=strakeLower(si);return clamp(top-lo,0,si===LETTERS.length-1?Infinity:STRAKE_W);
}
const r2=v=>Math.round(v*100)/100;

/* the shell's plates — static (hull + scan plan), once per plan */
const planCache=new WeakMap();
export function platesOfPlan(plan){
  let c=planCache.get(plan);if(c)return c;
  // mesh stations per frame bin (station frame rounded, like the measurement points)
  const stations=Array.from({length:NBIN},()=>[]);
  for(let i=0;i<=NX;i++)stations[binOf(Math.round(stX[i]/FS))].push(i);
  // plan samples per plate key
  const samples=new Map();
  for(const sm of plan.samples){const k=keyOf(binOf(sm.fr),sm.strake,sm.side);let l=samples.get(k);if(!l)samples.set(k,l=[]);l.push(sm);}
  const plates=[];
  for(let b=0;b<NBIN;b++){
    const st=stations[b];if(!st.length)continue;
    const frFrom=FRMIN+b*PLATE_FRAMES,frTo=Math.min(FRMAX,frFrom+PLATE_FRAMES-1);
    const x0=Math.max(XMIN,(frFrom-0.5)*FS),x1=Math.min(XMAX,(frTo+0.5)*FS),len=x1-x0;
    for(let si=-1;si<LETTERS.length;si++){
      const w=st.reduce((a,i)=>a+widthAt(stSec[i],si),0)/st.length;
      if(w*len<0.05)continue;   // no shell of this strake here
      const strake=si<0?'K':LETTERS[si];
      for(const side of si<0?['C']:['S','P']){
        const sm=samples.get(keyOf(b,strake,side))||[],measured=sm.filter(s=>!s.blocked);
        // zone: the one most plan points are in; no points → the zone at the plate's middle
        const zc={};sm.forEach(s=>{zc[s.zone]=(zc[s.zone]||0)+1;});
        let zone=Object.keys(zc).sort((a,b)=>zc[b]-zc[a]||ZONES.indexOf(a)-ZONES.indexOf(b))[0];
        if(!zone){const i=st[st.length>>1],s=stSec[i],g=si<0?0:Math.min(strakeLower(si)+STRAKE_W/2,s.gs[G-1]*0.999),p=atGirth(s,g);
          zone=ZONES[zoneOf(stX[i],p?p.Z:s.Zs[0])];}
        const orig=Math.max(...(Object.keys(zc).length?Object.keys(zc):[zone]).map(z=>PLATE_ORIG[z]));
        const area=len*w;
        // heights of the plate's lower and upper edge on its middle station (m above base): 도장 구역, below the design waterline
        const ms=stSec[st[st.length>>1]],gLo=si<0?0:strakeLower(si),gHi=Math.min(si<0?KEEL_HALF:gLo+STRAKE_W,ms.gs[G-1]);
        const zLo=atGirth(ms,Math.min(gLo,ms.gs[G-1]))?.Z??ms.Zs[0],zHi=atGirth(ms,gHi)?.Z??ms.Zs[G-1];
        plates.push({bin:b,frFrom,frTo,strake,si,side,zone,x0,x1,length:r2(len),width:r2(w),area,orig,material:PLATE_MATERIAL,zLo,zHi,
          weight:area*orig/1000*STEEL_DENSITY,measurable:measured.length>0,sampleIds:sm.map(s=>s.id),
          // signed girth band on the shell expansion (port +): K across the centreline
          uLo:si<0?-KEEL_HALF:side==='P'?strakeLower(si):-(strakeLower(si)+STRAKE_W),uHi:si<0?KEEL_HALF:side==='P'?strakeLower(si)+STRAKE_W:-strakeLower(si)});
      }
    }
  }
  // numbers: per strake, stern → bow, starboard before port
  const seq={},sideOrder={S:0,C:0,P:1};
  plates.sort((a,b)=>a.si-b.si||a.bin-b.bin||sideOrder[a.side]-sideOrder[b.side]);
  for(const p of plates){seq[p.strake]=(seq[p.strake]||0)+1;p.id=`P-${p.strake}${String(seq[p.strake]).padStart(2,'0')}`;}
  const byKey=new Map(plates.map(p=>[keyOf(p.bin,p.strake,p.side),p])),bySample=new Map();
  plates.forEach(p=>p.sampleIds.forEach(id=>bySample.set(id,p)));
  c={plates,byId:new Map(plates.map(p=>[p.id,p])),byKey,bySample};
  planCache.set(plan,c);return c;
}
/* the plate a measurement point lies on */
export function plateKeyOf(r){return keyOf(binOf(r.fr),r.strake,r.side);}

/* plates with this docking's measurements: [{...plate, records, zones, grades:{plate, dft, defect}, step}]
   grades: the worst grade (criteria.gradeOf: 0 정상 … 3 최우선 보수) of the plate's points per layer · step: repairSteps.stepOf
   (null = 정상 or 측정 불가). Once per data version. */
let cache=null;
export function platesOf(store){
  const v=store.version,plan=store.plan;
  if(cache&&cache.v===v&&cache.plan===plan)return cache.out;
  const P=platesOfPlan(plan),R=store.records;
  const plates=P.plates.map(p=>({...p,records:[],zones:[],grades:Object.fromEntries(LAYERS.map(l=>[l,OK])),step:null}));
  const byId=new Map(plates.map(p=>[p.id,p])),ofRecord=new Map();let lost=0;
  for(const r of R){
    const s=P.bySample.get(r.id)||P.byKey.get(plateKeyOf(r)),p=s&&byId.get(s.id);
    if(!p){lost++;continue;}
    p.records.push(r);ofRecord.set(r.id,p);
    for(const l of LAYERS){const g=gradeOf(judge(r,l).level,isTop(r,l));if(g>p.grades[l])p.grades[l]=g;}
  }
  if(lost)console.warn(`[DR.DOCK] 판에 연결하지 못한 측정점 ${lost}개`);
  // repair zones (all layers, as in the report's 5장) on the plates their points touch
  for(const z of groupZones(R,'all')){const seen=new Set();
    for(const {r} of z.items){const p=ofRecord.get(r.id);if(p&&!seen.has(p)){seen.add(p);p.zones.push(z);}}}
  for(const p of plates)if(p.measurable)p.step=stepOf(p.grades);
  const out={plates,byId,ofRecord};
  cache={v,plan,out};return out;
}
