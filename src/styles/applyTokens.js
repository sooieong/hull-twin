/* =========================================================
   앱 시작 때 가장 먼저 실행: tokens.js의 값으로 :root CSS 변수를 설정한다 (main.js의 첫 import).
   개발 중에는 CSS가 쓰는 var(--…) 가운데 tokens.js에 없는 이름을 콘솔에 알려 준다.
   ========================================================= */
import { applyTokens, CSS_VARS } from './tokens.js';

applyTokens();

if(import.meta.env.DEV)queueMicrotask(()=>{
  const used=new Set();
  for(const sheet of document.styleSheets){
    let rules;try{rules=sheet.cssRules;}catch(_){continue;}   // cross-origin (web fonts)
    for(const r of rules)for(const m of r.cssText.matchAll(/var\((--[\w-]+)/g))used.add(m[1]);
  }
  const missing=[...used].filter(n=>!(n in CSS_VARS));
  if(missing.length)console.warn('[DR.DOCK] tokens.js에 없는 CSS 변수:',missing.join(', '));
});
