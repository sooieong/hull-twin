/* =========================================================
   시뮬레이터용 측정값 생성 (예시 데이터)
   이상치는 군집으로 배치한다 (SPEC 3.2):
   - 흘수선 부근과 선수부: 도막 손상이 많다
   - 선저와 빌지: 강판 감소가 많다
   - 일부 군집은 도막과 강판 이상이 겹친다 (복합)
   같은 seed면 항상 같은 값이 나온다.
   ========================================================= */
import { L, T, section, girthAtZ } from '../hull.js';
import { CRITERIA } from './criteria.js';

/* 구역별 설계 도막 두께(µm), 원두께(mm): 선저, 빌지, 선측, 흘수선, 건현, 선수, 선미 */
const DFT_DESIGN={'선저':350,'빌지':350,'선측':320,'흘수선':350,'건현':250,'선수':320,'선미':320};
const PLATE_ORIG={'선저':19.5,'빌지':19.5,'선측':17.0,'흘수선':18.0,'건현':16.0,'선수':20.0,'선미':19.0};

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

/* 군집: 중심 (X, u), 반경 r(m), 강도 k(0–1). u = 부호 있는 거스 (좌현 +) */
function makeClusters(seed){
  const rnd=mulberry32(seed),rr=(a,b)=>a+(b-a)*rnd(),side=()=>rnd()<0.5?-1:1;
  const wlGirth=X=>girthAtZ(section(X),T);
  const bilgeG=20.6+2;                     // 선저 평판 끝 + 빌지 중간쯤
  const coat=[],plate=[];
  for(let n=0;n<10;n++){const X=rr(0.06*L,0.97*L);coat.push({X,u:side()*(wlGirth(X)+rr(-1.6,1.6)),r:rr(3,8),k:rr(0.55,1)});}  // 흘수선
  for(let n=0;n<8;n++){const X=rr(0.9*L,1.0*L);coat.push({X,u:side()*rr(3,30),r:rr(3,8),k:rr(0.6,1)});}                       // 선수부
  for(let n=0;n<4;n++){const X=rr(0.1*L,0.85*L);coat.push({X,u:side()*rr(2,46),r:rr(2,4),k:rr(0.4,0.8)});}                     // 그 밖
  for(let n=0;n<9;n++){const X=rr(0.12*L,0.88*L);plate.push({X,u:side()*rr(2,bilgeG+2),r:rr(4,9),k:rr(0.55,1)});}            // 선저 · 빌지
  for(let n=0;n<2;n++){const X=rr(0.1*L,0.9*L);plate.push({X,u:side()*rr(14,40),r:rr(2.5,4),k:rr(0.4,0.7)});}                  // 그 밖
  for(let n=0;n<3;n++){const X=rr(0.2*L,0.8*L),u=side()*rr(bilgeG-4,bilgeG+3),r=rr(3,5);                                     // 복합
    coat.push({X,u,r,k:rr(0.7,1)});plate.push({X,u,r,k:rr(0.7,1)});}
  return {coat,plate};
}
function influence(list,X,u){
  let m=0;for(const c of list){const d2=((X-c.X)**2+(u-c.u)**2)/(c.r*c.r);if(d2<9)m=Math.max(m,c.k*Math.exp(-d2));}return m;
}
const r1=v=>Math.round(v*10)/10;

/* 측정점(sample) 하나의 측정값 (사진 연결은 시뮬레이터가 한다) */
export function createSynth(seed=2491){
  const cl=makeClusters(seed);
  return function values(sm){
    const rnd=mulberry32(seed^Math.imul(sm.id+1,2654435761));
    const c=influence(cl.coat,sm.X,sm.u),p=influence(cl.plate,sm.X,sm.u);
    const design=DFT_DESIGN[sm.zone],orig=PLATE_ORIG[sm.zone];
    let ratio=0.88+0.12*rnd()-0.72*c+(rnd()-0.5)*0.04;
    let defect=null,defectArea=0;
    if(c>0.25&&rnd()<(c-0.25)*1.4)defect=rnd()<(c-0.25)/0.75*0.9?'flaking':'scratch';
    else if(rnd()<0.004)defect='scratch';
    if(defect==='flaking'){defectArea=0.15+rnd()*1.2*c;ratio=Math.min(ratio,0.25+0.3*rnd());}
    else if(defect==='scratch')defectArea=0.03+rnd()*0.35;
    const loss=Math.max(0,Math.min(0.4,0.015+0.04*rnd()+0.27*p+(rnd()-0.5)*0.02));
    // "1차" = 1차 리도킹(2021.10) 출거 시점, 정비를 마친 뒤의 두께
    // 강판: 그때 측정한 감소(인도 후 10년 중 5년: 지금의 약 절반)가 경고 기준 이상이면 교체 → 원두께, 아니면 그대로
    const prevLoss=loss*(0.4+0.2*rnd()),prevAfter=prevLoss>=CRITERIA.plate.crit?0:prevLoss;
    const dft=Math.round(design*Math.max(0.05,Math.min(1.1,ratio)));
    return {
      // 도막: 그때 다시 칠했다 → 설계 이상 (100–112%), 지금보다 얇을 수는 없다
      dft,dftDesign:design,dftPrev:Math.round(Math.max(design*(1+0.12*rnd()),dft)),
      plate:r1(orig*(1-loss)),plateOrig:orig,platePrev:r1(orig*(1-prevAfter)),
      defect,defectArea:defect?Math.round(defectArea*100)/100:0,
      // AI 손상 판별 신뢰도 (%) — 모델이 아직 없어 85–98% 예시값. 실제 모델 결과(JSON)의 값으로 이 필드만 바꾸면 된다
      aiConfidence:defect?Math.round(85+13*rnd()):null
    };
  };
}
