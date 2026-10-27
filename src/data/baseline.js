/* =========================================================
   기준 선박 (SPEC-v3 11.1–11.3): Wally Schirra (건화물·탄약 보급함)
   실선을 기준선으로 쓰지만 측정값은 시뮬레이션이다.
   "(가정)" 값은 공개 자료가 없어 정한 값이다 — 실선 도면을 받으면 이 파일에서만 바꾼다.
   좌표: x = AP 0, 선수 방향 + · y = 중심선 0, 좌현 +, 우현 − · z = 기선 0, 위 + (m)
   ========================================================= */
export const SHIP={hull:'H-2491',name:'Wally Schirra',kind:'건화물·탄약 보급함'};   // hull: 보고서 파일명의 선체 번호

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
  side:{x0:8,x1:X_MAX,z0:0.5,z1:20.5},  // 선측 (좌·우현): 외판 표면, 선수재까지 (벌브 끝은 MANUAL로 뺀다)
  bottom:{x0:8,x1:195,y:13}             // 선저 평판부: |y| ≤ 13, z = 0
};
/* 측정 제외 구역 (데이터 생성 안 함, 3D·전개도에 빗금)
   - 킬 블록 접촉면 (측정 불가): z = 0, |y| ≤ 0.6, 블록 간격마다
   - 프로펠러·러더·스케그 (수동 측정): x X_MIN … 8, z 0 … 9
   - 선수 벌브 끝 (수동 측정): 벌브 높이(z0 … z1 = 벌브 아래끝 … 위끝) 안에서, 외판이 벌브 자체이고
     벌브 중심보다 앞이며, 곡률 반경(가장 급하게 굽은 방향, hull.bulbRadius)이 rMax 미만인 곳 = 벌브 앞코
     (끝점 1.14 m). x0은 그 구역의 가장 뒤쪽 x (201.69 m를 내림, z 1.34 … 8.18 m에 걸친다)
     벌브 위의 선수재는 측정 구역이다 */
export const KEEL_BLOCK={half:0.6,len:1.4,spacing:4.2,x0:10,x1:193};   // 블록 길이·간격 (가정)
export const MANUAL=[
  {key:'stern',label:'프로펠러·러더·스케그',x0:X_MIN,x1:8,z0:0,z1:9},
  {key:'bulb',label:'선수 벌브 끝',x0:201.6,x1:X_MAX,z0:1.10,z1:8.40,rMax:1.5}
];
/* 선미 부가물 (가정, 단순 형상): 모두 x −5 … 8 m, z 0 … 9 m 안 (수동 측정 구역). 선체 크기와 선미 선저 높이에 맞춘 값.
   - 스케그: 선미 선저 중앙에서 아래로 내려온 판. 윗변은 선체 선저를 따르고, 아랫변은 (x1, 0)에서 (x0, zAft)로 올라간다
   - 프로펠러: 축 중심 (x, z), 지름 d, 날개 blades개, 허브 반지름·길이, 축 반지름 (축은 스케그 뒤끝에서 허브까지)
   - 러더: 프로펠러 뒤 세로 판. 아랫변 z0, 윗변은 선체 선저까지 */
export const STERN_GEAR={
  skeg:{x0:-2.0,x1:5.0,zAft:1.0,thick:0.7},
  prop:{x:-2.6,z:2.3,d:3.8,blades:4,hubR:0.45,hubLen:0.8,shaftR:0.22,bladeW:1.0},
  rudder:{x0:-4.8,x1:-3.6,z0:0.5,thick:0.5}
};
/* 선수·선미 위치 속성 (SPEC 11.4): 선수 FR 약 220 이후, 선미 FR 10 이전 */
export const BOW_FR=220, STERN_FR=10;
