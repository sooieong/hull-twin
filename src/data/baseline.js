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
  side:{x0:8,x1:202,z0:0.5,z1:20.5},    // 선측 (좌·우현): 외판 표면
  bottom:{x0:8,x1:195,y:13}             // 선저 평판부: |y| ≤ 13, z = 0
};
/* 측정 제외 구역 (데이터 생성 안 함, 3D·전개도에 빗금)
   - 킬 블록 접촉면 (측정 불가): z = 0, |y| ≤ 0.6, 블록 간격마다
   - 프로펠러·러더·스케그, 선수 벌브 끝 (수동 측정) */
export const KEEL_BLOCK={half:0.6,len:1.4,spacing:4.2,x0:10,x1:193};   // 블록 길이·간격 (가정)
export const MANUAL=[
  {key:'stern',label:'프로펠러·러더·스케그',x0:X_MIN,x1:8,z1:9},
  {key:'bulb',label:'선수 벌브 끝',x0:202,x1:X_MAX,z1:Infinity}
];
/* 선수·선미 위치 속성 (SPEC 11.4): 선수 FR 약 220 이후, 선미 FR 10 이전 */
export const BOW_FR=220, STERN_FR=10;
