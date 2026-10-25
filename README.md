# DR.Dock

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
- `src/data/` — 데이터 계층
  - `robotSource.js` 데이터 소스 인터페이스(+ WebSocket 골격), `simulator.js` 시뮬레이터
  - `scanPath.js` 외판 전체 순회 경로, `synth.js` 예시 측정값 생성
  - `criteria.js` 판정 기준·보수 우선순위, `zones.js` 보수 구역 묶기, `store.js` 화면들이 구독하는 저장소
  - `photos.js` `public/images/defects/` 손상 사진 찾기

## 참고
- three는 0.147.0으로 고정. r155 이후 버전은 조명 기본값이 달라져 화면이 어두워질 수 있음.
- 선체 형상, 로봇 경로, 선번(H-2491)은 예시 값.
