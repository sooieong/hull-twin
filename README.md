# DR.DOCK

닥터 도크 — 리도킹 때 선체 외판 측정 로봇의 도막·강판 두께, 표면 사진을 3D 선체에 매핑하는 디지털 트윈 대시보드 (설계DX)

## 실행
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ 에 배포용 정적 파일 생성
```
Node.js 18 이상 필요.

## 구조
- `index.html` — 화면 뼈대 (헤더, 3열 그리드: 3D 종합맵 | Side Shell 도면·상세 | KPI, 상태바)
- `src/style.css` — 디자인 토큰(한화오션 색상)과 레이아웃
- `src/main.js` — 3D 뷰어(Three.js), 화면 연동
- `src/hull.js` — 예시 선형 정의(형상, 외판열, 구역, 킬 블록)
- `src/heatmap.js` — 히트맵 보간(IDW)과 색상, `src/uiState.js` — 선택한 레이어·측정점(모든 패널이 구독)
- `src/kpi.js` — KPI 패널(요약, 보수 구역 우선순위 목록)
- `src/panels.js` — 패널 접기·최대화(상태는 localStorage에 기억)
- `src/sideShell.js` — 보조 시각화 1: Side Shell 전개도(Canvas)
- `src/detail.js` — 보조 시각화 2: 두께 단면 비교, 손상 사진 · `src/sectionSvg.js` — 두께 단면 그림(상세 패널·보고서 공용)
- `src/hullMesh.js` — 선체 외판 메시 데이터(대시보드 3D·보고서 3D 공용)
- `src/report/` — 진단 보고서 5장(A4 가로): `data.js` 계산, `pages.js` 페이지, `charts.js` SVG 차트, `render3d.js` 오프스크린 3D 그림
- `src/data/` — 데이터 계층
  - `robotSource.js` 데이터 소스 인터페이스(+ WebSocket 골격), `simulator.js` 시뮬레이터
  - `scanPath.js` 외판 전체 순회 경로, `synth.js` 예시 측정값 생성
  - `criteria.js` 판정 기준·보수 우선순위, `zones.js` 보수 구역 묶기, `store.js` 화면들이 구독하는 저장소
  - `photos.js` `public/images/defects/` 손상 사진 찾기

## 참고
- 보고서 생성: 헤더 `보고서 생성` → `DR.DOCK_Report_H-2491_YYYYMMDD.pdf`. Chrome·Edge는 저장 창에서 위치를 고르고, 그 밖의 브라우저는 다운로드 폴더에 저장. 매핑 중·중지 상태에서는 비활성화.
- 보고서 레이아웃 확인: `http://localhost:5173/?report=preview` (PDF 대신 5장을 화면에 표시)
- three는 0.147.0으로 고정. r155 이후 버전은 조명 기본값이 달라져 화면이 어두워질 수 있음.
- 선체 형상, 로봇 경로, 선번(H-2491)은 예시 값. 측정 로봇 이름(MAGNI)과 보고서 5장 보수 효과 추정 상수(Townsin 식 AHR, 운항 속도)는 `src/data/baseline.js`.
- 예시 측정값 생성의 가정값(설계 도막 두께, 원두께, 부위 계수, 국부 공식, 손상 건수·위치, 도킹 주기, 난수 시드)도 `src/data/baseline.js`. 시드가 같으면 항상 같은 데이터가 나온다.
