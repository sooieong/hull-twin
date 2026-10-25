# Hull Twin 설계 콘솔

선체 외판 도막·강판 두께 측정 로봇 기반 디지털 트윈 — 설계DX 대시보드 (레이아웃 + 3D 선체 메인 화면)

## 실행
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ 에 배포용 정적 파일 생성
```
Node.js 18 이상 필요.

## 구조
- `index.html` — 화면 뼈대 (상단바, 좌측 메뉴, 선도/3D 패널, 상태바)
- `src/style.css` — 디자인 토큰(한화오션 색상)과 레이아웃
- `src/main.js` — 선형 생성, 2D 선도(Canvas), 3D 뷰어(Three.js), 연동 로직

## 참고
- three는 0.147.0으로 고정. r155 이후 버전은 조명 기본값이 달라져 화면이 어두워질 수 있음.
- 선체 형상, 로봇 경로, 선번(H-2491)은 예시 값.
