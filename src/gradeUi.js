/* =========================================================
   판정 표시: 색은 두 가지(앰버·레드), 단계는 채움 정도와 아이콘으로 구분한다.
   - 아이콘 (src/assets/icons, 512×512 PNG): 최우선 보수 = 사이렌(priority.png) · 경고 = 빨간 삼각형(warning.png)
     · 주의 = 노란 삼각형(caution.png). 도막 손상 레이어는 도막 떨어짐 = 경고 아이콘, 스크래치 = 주의 아이콘.
   - 칩: 주의·경고는 반투명 배경 + 색 테두리, 최우선 보수만 레드로 꽉 찬 칩 (style.css .lv*, report.css .rp-lv*)
   - 같은 아이콘을 보수 목록 그룹 제목·KPI 타일·? 범례·3D 툴팁의 칩, 보고서 칩·지도에 쓴다.
   한화 오렌지는 판정에 쓰지 않는다 (버튼·선택 테두리·진행 막대 전용).
   ========================================================= */
import { gradeName } from './data/criteria.js';
import priorityPng from './assets/icons/priority.png';
import warningPng from './assets/icons/warning.png';
import cautionPng from './assets/icons/caution.png';

/* 정상 · 주의 · 경고 · 최우선 보수 — numbers and lines on the dark UI */
export const GRADE_COLOR=['#8FA3BF','#F2B53A','#FF5A5F','#E23D4B'];
export const GRADE_ICON=[null,cautionPng,warningPng,priorityPng];
/* the same PNGs as data URIs, for SVG that is drawn as an image (report maps → PDF), which cannot load files by URL.
   Filled by loadIconData() before the report is built. */
export const GRADE_ICON_DATA=[null,null,null,null];
export async function loadIconData(){
  await Promise.all([1,2,3].map(async g=>{
    if(GRADE_ICON_DATA[g])return;
    const blob=await (await fetch(GRADE_ICON[g])).blob();
    GRADE_ICON_DATA[g]=await new Promise((ok,fail)=>{const f=new FileReader();f.onload=()=>ok(f.result);f.onerror=fail;f.readAsDataURL(blob);});
  }));
}

/* icon as an <img>; its size comes from the context's .gi rule (12–13px on screen, 10px in the report) */
export function gradeIcon(g){return g?`<img class="gi" src="${GRADE_ICON[g]}" alt="" aria-hidden="true" draggable="false">`:'';}
/* judgement chip: icon + name, the same look everywhere on the dashboard (.lv0–.lv3) */
export function gradeChip(g,layer){return `<span class="lv lv${g}">${gradeIcon(g)}${gradeName(g,layer)}</span>`;}   // layer: names (도막 손상 = 손상 종류)
