/* =========================================================
   기준 선박 (SPEC-v3 11.1–11.3): 가상의 파나막스급 상선 — 크기 규격만 빌려 온 것으로 특정 선박이 아니다.
   선형·치수·측정값은 모두 시뮬레이션이다. "(가정)" 값은 정해 둔 값이며 이 파일에서만 바꾼다.
   좌표: x = AP 0, 선수 방향 + · y = 중심선 0, 좌현 +, 우현 − · z = 기선 0, 위 + (m)
   ========================================================= */
export const SHIP={hull:'H-2491',name:'H-2491',kind:'파나막스급 상선'};   // hull: 보고서 파일명의 선체 번호 · name: 머리말·보고서 표지
export const ROBOT='MAGNI';             // 측정 로봇 기종 이름 (6대 — ROBOTS)

/* 제원 (m) */
export const LOA=210, BEAM=32.3, LBP=199.3;
export const DEPTH=21;                  // 형깊이 (가정)
export const DRAFT=9.12;                // 설계 흘수
export const DRAFT_LIGHT=5.6;           // 경하 흘수 ≈ 수선부 하한
export const WL_TOP=9.4;                // 수선부 상한 = 최대 흘수 + 0.3 m
export const SHELL_AREA=13000;          // 외판 총면적 (m², 약)
export const MEASURE_AREA=12600;        // 측정 대상 면적 (m²): 킬 블록 접촉면 등 약 3% 제외. 모든 비율 계산의 분모

/* 선체 길이 범위와 프레임: AP = FR 0, FP = FR 249 */
export const X_MIN=-5, X_MAX=205;       // 트랜섬 끝 ~ 선수 벌브 끝 (LOA 210)
export const FRAME_SPACING=0.8;         // 균일 (가정)
export const FR_MIN=-6, FR_MAX=256;

/* 측정 로봇 6대: 현측(side)마다 길이를 세 구간(fr: FR from 이상 to 미만, 마지막 구간은 FR_MAX까지)으로 나눠 한 대가 한 구간을 맡는다
   (1 선미 · 2 중앙 · 3 선수). 각 로봇은 자기 구간의 자기 현 선측·수선부와 선저 절반(좌현 y > 0, 우현 y < 0)을 측정한다.
   6대가 동시에 측정한다 (data/scanPath.js 로봇별 경로, data/simulator.js). name: 상태바·툴팁·상세·측정 레코드(robot) */
export const ROBOTS=[
  {id:'P1',side:'P',fr:[FR_MIN,80]},{id:'P2',side:'P',fr:[80,170]},{id:'P3',side:'P',fr:[170,FR_MAX]},
  {id:'S1',side:'S',fr:[FR_MIN,80]},{id:'S2',side:'S',fr:[80,170]},{id:'S3',side:'S',fr:[170,FR_MAX]}
].map(r=>({...r,name:`${ROBOT}-${r.id}`}));
/* the robot that measures a point (side 'P' | 'S', frame number) */
export const robotFor=(side,fr)=>ROBOTS.find(r=>r.side===side&&fr>=r.fr[0]&&(fr<r.fr[1]||r.fr[1]===FR_MAX));
const idsOf=side=>{const l=ROBOTS.filter(r=>r.side===side).map(r=>r.id);return `${l[0]}~${l[l.length-1]}`;};
export const FLEET=`${ROBOT} ${ROBOTS.length}대`;                                                   // 상태바: MAGNI 6대
export const FLEET_DETAIL=`마그니(${ROBOT}) ${ROBOTS.length}대 · 좌현 ${idsOf('P')}, 우현 ${idsOf('S')}`;   // 보고서 표지·툴팁

/* 외판열 (가정): 외판 1장 폭 약 4.5 m. K는 중심선 양쪽으로 반씩 */
export const STRAKE_W=4.5, KEEL_HALF=2.25;

/* 로봇 측정 가능 범위 */
export const GRID=1.1;                  // 측정 격자 (m): 레인 간격 = 레인 위 측정 간격 → 약 10,400점
export const REACH={
  side:{x0:10,x1:202,z0:0.5,z1:20.5},   // 선측 (좌·우현): 외판 표면, x 202 m까지 (선수 벌브 끝 이후는 측정하지 않는다)
  bottom:{x0:10,x1:195,y:13}            // 선저 평판부: |y| ≤ 13, z = 0
};
/* 측정 제외 구역 (데이터 생성 안 함, 3D·전개도에 빗금)
   - 킬 블록 접촉면 (측정 불가): z = 0, |y| ≤ 0.6, 블록 간격마다
   - 프로펠러·러더·스케그 뒤끝·카운터 아랫면 (수동 측정): x X_MIN … 10, z 0 … 10
   - 선수 벌브 끝 (수동 측정): 벌브 높이(z0 … z1 = 벌브 아래끝 … 위끝) 안에서, 외판이 벌브 자체이고
     벌브 중심보다 앞이며, 곡률 반경(가장 급하게 굽은 방향, hull.bulbRadius)이 rMax 미만인 곳 = 벌브 앞코
     (끝점 1.14 m). x0은 그 구역의 가장 뒤쪽 x (201.69 m를 내림, z 1.34 … 8.18 m에 걸친다)
     벌브 위의 선수재는 측정 구역이다 */
export const KEEL_BLOCK={half:0.6,len:1.4,spacing:4.2,x0:10,x1:193};   // 블록 길이·간격 (가정)
export const MANUAL=[
  {key:'stern',label:'프로펠러·러더·스케그',x0:X_MIN,x1:10,z0:0,z1:10},
  {key:'bulb',label:'선수 벌브 끝',x0:201.6,x1:X_MAX,z0:1.10,z1:8.40,rMax:1.5}
];
/* 선형 (가정): 파나막스급 탱커·벌크선을 닮게 정한 값. hull.js가 이 값으로 반폭 HB(x, z)를 만든다 (m, 각도 °).
   - midbody: 평행부 (흘수선에서 선폭이 다 차는 구간) x0 … x1
   - stem: 선수재. 설계 흘수선에서 FP(x = LBP)를 지나 rake°로 앞으로 기운 직선. forefoot: 선수 바닥 모서리 (반경 r, 높이 h)
   - entrance: 설계 흘수선 입사 반각 (흘수선 끝의 각). flare: 선수루 갑판 높이의 수선 충만도 지수 (클수록 위로 벌어짐)
   - bulb: 벌브 타원체 (중심 x, z, 반축 len·h·w). 선체와 blend(m²) 크기의 둥근 이음으로 합친다
   - sheer: 주갑판 현호. 선수는 fwdX0부터 선수루까지 fwd만큼, 선미는 aftX0부터 선미루까지 aft만큼 올라간다 (이차곡선)
   - forecastle: 선수루. x0부터 선수 끝까지 h 높고, 선수 끝에서 stem만큼 더 올라간다
   - poop: 선미루 (거주구 아래). 트랜섬부터 x1까지 h 높다
   - run: 선미 아랫부분. 바닥이 x0부터 트랜섬 아래끝(transom.z)까지 부드럽게 올라가며 좁아진다 (곡선 지수 q, r)
   - transom: x = X_MIN의 평평한 면. 아래끝 높이 z, 폭은 선폭의 w배
   - skeg: 선저가 중심선으로 모여 이어진 핀. 뒤끝은 반폭 half의 얇은 판이고 앞으로 갈수록 V자(높이 1 m마다 반폭 v씩)로
           넓어져 선저와 이어진다. 뒤끝은 바닥 x1에서 위 x2로 기운다, blend: 선체와의 둥근 이음 (m²) */
export const HULL_FORM={
  midbody:{x0:42,x1:145},
  stem:{rake:18},forefoot:{r:6,h:4},
  entrance:25,flare:5.5,
  bulb:{x:200.01,len:4.92,z:4.75,h:3.65,w:2.37,blend:3},
  sheer:{fwd:0.8,fwdX0:140,aft:0.6,aftX0:60},
  forecastle:{x0:185.6,h:2.5,stem:0.4},
  poop:{x1:14,h:2.0},
  run:{x0:42,q:1.4,r:2.2},
  transom:{z:10,w:0.8},
  skeg:{half:0.7,v:0.8,x1:9.6,x2:9.0,blend:4}
};
/* 선미 부가물 (가정, 단순 형상): 모두 x −5 … 10 m, z 0 … 10 m 안 (수동 측정 구역). 스케그는 선체의 일부다 (HULL_FORM.skeg).
   - 프로펠러: 축 중심 (x, z), 지름 d, 날개 blades개, 허브 반지름·길이, 축 반지름 (축은 스케그 뒤끝에서 허브까지).
     스케그 뒤끝과 러더 사이의 빈 공간(aperture)에 들어간다
   - 러더: 프로펠러 뒤 세로 판 (아래가 열린 스페이드 러더). 아랫변 z0, 윗변은 카운터 아랫면까지 */
export const STERN_GEAR={
  prop:{x:5.5,z:4.0,d:6.5,blades:4,hubR:0.75,hubLen:1.3,shaftR:0.4,bladeW:1.9},
  rudder:{x0:-2.6,x1:2.0,z0:0.9,thick:0.8}
};
/* 선수·선미 위치 속성 (SPEC 11.4): 선수 FR 약 220 이후, 선미 FR 10 이전 */
export const BOW_FR=220, STERN_FR=10;

/* ---------- 측정값 생성 (시뮬레이터, data/synth.js) — SPEC-v3 11.4–11.6 ---------- */
export const SEED=2491;                 // 난수 시드: 같은 시드면 항상 같은 데이터
export const DOCKING_CYCLE_YEARS=5;     // 도킹 주기 (년): 신조 인도 2016.10 → 1차 2021.10 → 2차 2026.10

/* 구역별 설계 도막 두께 (µm)와 원두께 (mm): 측정 레코드의 구역 (hull.ZONES) */
export const DFT_DESIGN={'선저':350,'빌지':350,'선측':320,'흘수선':350,'건현':250,'선수':320,'선미':320};
export const PLATE_ORIG={'선저':19.5,'빌지':19.5,'선측':17.0,'흘수선':18.0,'건현':16.0,'선수':20.0,'선미':19.0};

/* 대시보드 구역 (SPEC 11.4): 높이로 나눈다. 선저 z < 0.5 (평판부) · 선측+빌지 0.5–5.6 · 흘수선 5.6–9.4 · 건현 9.4 이상
   coef = 부위 계수 (도막 손상이 생기는 정도, 명세 9 / 18 / 19 / 11 %의 근거). 도막 이상 판은 COAT.blobs에 구역마다 나눠 정한다 */
export const COAT_ZONES=[
  {key:'top',name:'건현',z0:WL_TOP,coef:0.65},
  {key:'boot',name:'흘수선',z0:DRAFT_LIGHT,coef:1.25},
  {key:'side',name:'선측+빌지',z0:0.5,coef:1.37},
  {key:'bottom',name:'선저',z0:-Infinity,coef:0.81}
];
export const coatZoneOf=Z=>COAT_ZONES.find(c=>Z>=c.z0);

/* 도막 두께 이상 (SPEC v6 14.1): 판 모양 패치 — 판 하나의 측정점을 모두 같은 판정으로 채운다 (판 경계를 넘지 않는다).
   blobs: 덩어리마다 위치 (판 가운데 프레임 fr 범위, 현측 side, 도장 높이 구역 zone = 판 측정점이 가장 많은 COAT_ZONES key),
     판 수 n, 그중 가운데(첫 판에서 가까운 순) 경고 판 crit. first = 1차 리도킹에 이미 이상이던 판 {crit, warn}: 같은 자리에서
     더 작게 — 1차 경고는 2차 경고 판 중 가운데부터, 1차 주의는 그 다음 판부터. 판 수는 구역별 이상 면적(명세 9 / 18 / 19 / 11 %)에 맞춘
     값이다 (판 1장 ≈ 측정점 20개 ≈ 24 m²). 덩어리는 서로 붙지 않는다 (옆 판이 다른 덩어리면 건너뛴다)
   minPts: 덩어리 판의 최소 측정점 수 (끝이 잘린 판은 넣지 않는다)
   loss: 감소율 범위 (설계 대비, 0–1) — 정상 · 1차 주의 · 2차 새 주의 fast (5년 뒤 경고 예상) · 얕은 새 주의 shallow (5년 뒤에도 주의) · 경고
   carry: 1차 주의 판(1차 정비 범위 밖)이 2차까지 더 줄어든 양 — 느려서 5년 뒤에도 경고가 안 된다
   slowShare: 2차 주의 판 중 느린 판의 비율. 1차 주의에서 넘어온 판 먼저, 모자라면 얕은 새 주의 (1차에 보수한 판은 뺀다) */
export const COAT={
  blobs:[
    {zone:['boot'],side:'S',fr:[20,110],n:5,crit:2,first:{crit:1,warn:1}},     // 흘수선 띠
    {zone:['boot'],side:'P',fr:[110,170],n:4,crit:1,first:{crit:0,warn:1}},
    {zone:['boot'],side:'S',fr:[140,225],n:5,crit:1,first:{crit:0,warn:1}},
    {zone:['side'],side:'P',fr:[60,120],n:5,crit:2,first:{crit:1,warn:2}},     // 빌지·선측 (선측 수선 아래는 외판열 1줄이라 덩어리가 길쭉하다)
    {zone:['side'],side:'S',fr:[175,200],n:4,crit:1,first:{crit:1,warn:1}},
    {zone:['side'],side:'S',fr:[120,140],n:3,crit:1,first:{crit:0,warn:0}},
    {zone:['side','boot'],side:'P',fr:[200,235],n:7,crit:2,first:{crit:1,warn:1}},   // 선수부
    {zone:['bottom'],side:null,fr:[160,195],n:6,crit:2,first:{crit:0,warn:2}},   // 선저 블록 주변
    {zone:['bottom'],side:null,fr:[30,60],n:5,crit:2,first:{crit:1,warn:2}},
    {zone:['bottom'],side:'S',fr:[95,140],n:5,crit:1,first:{crit:0,warn:1}},
    {zone:['top'],side:'P',fr:[50,110],n:8,crit:3,first:{crit:1,warn:2}},      // 건현
    {zone:['top'],side:'S',fr:[140,200],n:8,crit:2,first:{crit:1,warn:1}}
  ],
  minPts:15,
  loss:{normal:[0,0.12],normalMax:0.18,first:[0.22,0.32],fast:[0.32,0.46],shallow:[0.21,0.24],crit:[0.53,0.78]},
  wear:[0.02,0.08],                     // 2차: 정상 점의 5년 마모 (1차 정비 후 값에서, 감소율 normalMax까지)
  carry:[0.02,0.06],
  slowShare:0.48
};
/* 강판 감소 (원두께 대비, 0–1)
   - 일반 감소: 2차 원두께의 1–2 %. 경하 흘수선 띠(z 5.3–6.2)와 빌지 상부가 가장 크고, 선수부 × bowFactor. 1차는 2차의 firstShare배 (거의 없음)
   - 국부 공식 (SPEC v6 14.1): 곳마다 판 몇 장 — 최우선 보수 top · 경고 crit · 주의 warn, 첫 판에서 가까운 판 순 (가운데가 깊고 둘레가 얕다).
     판마다 그 곳 조건(where)에 맞는 측정점 중 가운데 점이 가장 깊고(peak), 반경 R m까지 edge로 얕아진다. 1차에는 없다.
     where: fr = 판 가운데 프레임 범위 · side · bottom = 선저 평판부 (z < 0.5) · z = 높이 범위. keel: 첫 판 = 킬 판 (블록 접촉부 주변).
     곳끼리 apart m 이상 떨어진다. 국부 공식 판에는 도막 이상·손상을 두지 않는다 — 최우선 보수 판만 도막 경고(판 전체)와 도막 떨어짐 1건 (topFlake) */
export const PLATE_LOSS={
  general:[0.010,0.016],band:{z0:5.3,z1:6.2,add:0.004},bilgeTop:{z0:1.5,z1:3.5,add:0.002},bowFactor:1.2,firstShare:[0.2,0.4]
};
export const PITTING={
  peak:{top:[0.26,0.30],crit:[0.215,0.25],warn:[0.12,0.15]},edge:0.11,R:2.6,apart:15,minPts:4,
  topFlake:{area:[0.3,0.8]},
  sites:[
    {name:'①',where:{z:[0,3],fr:[10,25]},top:1,crit:2,warn:2},                 // FR 10–25 선저 (선미는 바닥이 올라가 평판부가 킬 판뿐 — z 3 m까지)
    {name:'②',where:{bottom:true,fr:[60,150]},keel:true,top:1,crit:1,warn:2},  // 선저 블록 접촉부 주변
    {name:'③',where:{z:[5.3,6.2],fr:[40,200],side:'S'},crit:1},                // 경하 흘수선 띠, 서로 떨어진 3곳
    {name:'③',where:{z:[5.3,6.2],fr:[40,200],side:'P'},warn:1},
    {name:'③',where:{z:[5.3,6.2],fr:[40,200],side:'S'},warn:1},
    {name:'④',where:{z:[3,9.4],fr:[225,250],side:'S'},crit:1,warn:2},          // 선수부
    {name:'빌지 상부',where:{z:[1.5,3.5],fr:[90,150],side:'P'},warn:2}          // 빌지 상부 깎임 집중
  ]
};
/* 도막 손상 (스크래치·도막 떨어짐): 손상 1건 = 한 곳의 손상 묶음 (3 m 안). events = 차수별 건수, sites = 위치별 비율
   - anchor: 선수 FR 225–250 앵커 주변 · tug: 양현 예인선 접촉점 (FR, z 범위) · fender: 펜더 라인 (z 범위)
   - waterline · seaChest: 도막 떨어짐만 (수선부, 씨체스트 2곳 — 선미 쪽 선측 하부, 가정). 수선부 떨어짐은 도막 경고 판에 먼저 둔다
     (도막이 이미 약한 곳 — 자리가 없으면 수선부 어디든)
   스크래치는 len개 점 (선수미 방향으로 이어짐). flaking = 2차 도막 떨어짐(경고) 건수: 떨어짐만 있는 곳을 빼고 남은 만큼
   스크래치 건에 고르게 떨어짐 1–2점을 3 m(flakeNear.r) 안에 함께 둔다.
   1차 (first): 2차 손상 자리 중 일부에서 더 작게 (면적 × shrink) — 떨어짐 flaking건, 스크래치 scratch건. 1차 도막 이상 판을 피하고
   1건 = 판 1장 (서로 다른 판) */
export const DAMAGE={
  events:{current:30,first:15},
  flaking:{current:12,area:[0.15,1.3]},  // 도막 두께 판정은 도막 두께 패치로만 (도막 떨어짐은 도막 손상 레이어에서 센다)
  first:{flaking:5,scratch:10,shrink:[0.4,0.7]},
  sites:{anchor:0.2,tug:0.34,fender:0.3,waterline:0.1,seaChest:0.06},
  anchor:{fr:[225,250],z:[3,16]},
  tug:{fr:[40,90,160,210],dx:4,z:[6,11]},  // 접촉점 FR ± dx m
  fender:{x:[20,185],z:[8,12]},
  seaChest:[{x:28,z:2.4,side:'S'},{x:28,z:2.4,side:'P'}],
  scratch:{len:[1,3],area:[0.03,0.38]},
  flakeNear:{r:3},
  gap:3.6                                  // 서로 다른 손상 사이의 최소 거리 (m): 3 m 묶음에서 합쳐지지 않게
};

/* 보수 효과 추정 (보고서 5장 마찰 저항 증가, 가정): Townsin 식의 평균 선체 거칠기 AHR (µm)을 면적마다 정한다.
   정상 도막 · 도막 이상 구역(도막 두께 주의 이상·스크래치) · 도막 떨어짐 구역 · 새 도막(재도장 후) */
export const AHR={normal:150,coatAbnormal:300,flaking:500,newCoat:100};
export const SERVICE_SPEED=14;          // 운항 속도 (노트)
export const SEA_NU=1.1883e-6;          // 해수 동점성계수 (m²/s, 15 °C, ITTC)
export const STEEL_DENSITY=7.85;        // 강재 밀도 (t/m³): 보고서 5장 강판 교체 중량 = 면적 × 원두께 × 밀도

/* 도료 사양 (보수 계획 자재 목록, 예시값 — SPEC 12.9): 필요량 (L) = 면적 × 설계 두께 ÷ 고형분 비율 × (1 + 손실률)
   도장 구역은 판 가운데 높이로 정한다: 경하 흘수(DRAFT_LIGHT) 아래 선저·선측 · 수선부 상한(WL_TOP)까지 흘수선 · 그 위 건현.
   dft = 도장 사양의 건조 도막 두께 합계 (µm) · solids = 부피 고형분 비율 */
export const PAINT_LOSS=0.25;           // 손실률 (분무·잔량)
export const PAINT_SPEC={
  bottom:{zone:'선저·선측',paint:'방식+방오',dft:350,solids:0.6},
  boot:{zone:'흘수선',paint:'방식+방오',dft:350,solids:0.6},
  top:{zone:'건현',paint:'상부 도료',dft:250,solids:0.55}
};
