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
- `src/main.js` — 선형 생성, 3D 뷰어(Three.js), 로봇 시뮬레이션

## 참고
- three는 0.147.0으로 고정. r155 이후 버전은 조명 기본값이 달라져 화면이 어두워질 수 있음.
- 선체 형상, 로봇 경로, 선번(H-2491)은 예시 값.
