/* =========================================================
   기준 선박 (SPEC-v3 11.1–11.3): 가상의 파나막스급 상선 — 크기 규격만 빌려 온 것으로 특정 선박이 아니다.
   선형·치수·측정값은 모두 시뮬레이션이다. "(가정)" 값은 정해 둔 값이며 이 파일에서만 바꾼다.
   좌표: x = AP 0, 선수 방향 + · y = 중심선 0, 좌현 +, 우현 − · z = 기선 0, 위 + (m)
   ========================================================= */
export const SHIP={hull:'H-2491',name:'H-2491',kind:'파나막스급 상선'};   // hull: 보고서 파일명의 선체 번호 · name: 머리말·보고서 표지

/* 제원 (m) */
export const LOA=210, BEAM=32.3, LBP=199.3;
export const DEPTH=21;                  // 형깊이 (가정)
export const DRAFT=9.12;                // 설계 흘수
export const DRAFT_LIGHT=5.6;           // 경하 흘수 ≈ 수선부 하한
export const WL_TOP=9.4;                // 수선부 상한 = 최대 흘수 + 0.3 m
export const SHELL_AREA=13000;          // 외판 총면적 (m², 약)
export const MEASURE_AREA=12600;        // 측정 대상 면적 (m²): 킬 블록 접촉면 등 약 3% 제외. 모든 비율 계산의 분모
export const DELIVERY='2009.09';         // 인도

/* 선체 길이 범위와 프레임: AP = FR 0, FP = FR 249 */
export const X_MIN=-5, X_MAX=205;       // 트랜섬 끝 ~ 선수 벌브 끝 (LOA 210)
export const FRAME_SPACING=0.8;         // 균일 (가정)
export const FR_MIN=-6, FR_MAX=256;

/* 외판열 (가정): 외판 1장 폭 약 4.5 m. K는 중심선 양쪽으로 반씩 */
export const STRAKE_W=4.5, KEEL_HALF=2.25;

/* 로봇 측정 가능 범위 */
export const GRID=1.1;                  // 측정 격자 (m): 레인 간격 = 레인 위 측정 간격 → 약 10,400점
export const REACH={
  side:{x0:10,x1:X_MAX,z0:0.5,z1:20.5}, // 선측 (좌·우현): 외판 표면, 선수재까지 (벌브 끝은 MANUAL로 뺀다)
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
