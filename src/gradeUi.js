/* =========================================================
   판정 표시: 색은 두 가지(앰버·레드), 단계는 채움 정도와 아이콘으로 구분한다.
   - 아이콘 (src/assets/icons, 512×512 PNG): 최우선 보수 = 사이렌(priority.png) · 경고 = 빨간 삼각형(warning.png)
     · 주의 = 노란 삼각형(caution.png). 도막 손상 레이어는 도막 떨어짐 = 경고 아이콘, 스크래치 = 주의 아이콘.
   - 칩: 주의·경고는 반투명 배경 + 색 테두리, 최우선 보수만 레드로 꽉 찬 칩 (style.css .lv*, report.css .rp-lv*)
   - 같은 아이콘을 보수 목록 그룹 제목·KPI 타일·? 범례·3D 툴팁의 칩, 보고서 칩·표의 그룹 제목 줄에 쓴다.
     (보고서 4장 전개도의 손상은 아이콘 대신 점 — report/charts.js)
   한화 오렌지는 판정에 쓰지 않는다 (버튼·선택 테두리·진행 막대 전용).
   ========================================================= */
import { gradeName } from './data/criteria.js';
import { COLOR } from './styles/tokens.js';
// ?datauri (vite.config.js): data: URIs inside the bundle, so the report (and its PDF capture) never loads the icons as separate files
import priorityPng from './assets/icons/priority.png?datauri';
import warningPng from './assets/icons/warning.png?datauri';
import cautionPng from './assets/icons/caution.png?datauri';

/* 정상 · 주의 · 경고 · 최우선 보수 — numbers and lines on the dark UI */
export const GRADE_COLOR=COLOR.lv;   // styles/tokens.js
export const GRADE_ICON=[null,cautionPng,warningPng,priorityPng];

/* icon as an <img>; its size comes from the context's .gi rule (12–13px on screen, 10px in the report) */
export function gradeIcon(g){return g?`<img class="gi" src="${GRADE_ICON[g]}" alt="" aria-hidden="true" draggable="false">`:'';}
/* judgement chip: icon + name, the same look everywhere on the dashboard (.lv0–.lv3) */
export function gradeChip(g,layer){return `<span class="lv lv${g}">${gradeIcon(g)}${gradeName(g,layer)}</span>`;}   // layer: names (도막 손상 = 손상 종류)
