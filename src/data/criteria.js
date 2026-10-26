/* =========================================================
   판정 기준 · 보수 우선순위 (SPEC 3.3)
   기준값은 모두 예시값이며 이 파일의 상수만 바꾸면 전체 화면에 반영된다.
   ========================================================= */
export const LAYERS=['dft','plate','defect'];
export const LAYER_LABEL={dft:'도막 두께',plate:'강판 두께',defect:'도막 손상'};

export const OK=0, WARN=1, CRIT=2;
export const LEVEL_LABEL=['정상','주의','심각'];   // 레이어별 판정 (통계용)

/* 화면·보고서의 판정 단계: 최우선 보수 / 심각 / 주의 (서로 겹치지 않는다). 최우선 보수는 레이어별 기준(isTop)이며 목록 맨 위에 온다.
   gradeOf(level, top): top = isTop(r, layer) (지점) 또는 zone.top (구역) */
export const TOP=3;
export const GRADE_LABEL=['정상','주의','심각','최우선 보수'];
export function gradeOf(level,top){return top?TOP:level;}

/* 최우선 보수 지점 — 레이어별 기준
   도막 두께 · 강판 두께: 같은 곳의 도막 두께와 강판 두께가 모두 주의 이상 (두 레이어가 같은 기준 → 같은 구역)
   도막 손상: 손상(스크래치 또는 도막 떨어짐)이 있고 그 자리 강판이 주의 이상
   'all'(보고서 보수 계획): 둘 중 하나라도 해당 */
export const TOP_RULE={coat:'도막·강판 모두 주의 이상',defect:'손상이 있고 그 자리 강판이 주의 이상'};
export const topGroup=layer=>layer==='defect'||layer==='all'?layer:'coat';
export function isTop(r,layer){
  if(judge(r,'plate').level===OK)return false;
  const g=topGroup(layer),coat=()=>judge(r,'dft').level>OK;
  return g==='defect'?!!r.defect:g==='all'?coat()||!!r.defect:coat();
}

export const CRITERIA={
  dft:{warn:0.8,crit:0.5,worst:0.2},       // 현재/설계 비율: warn 이상 정상, crit 이상 주의, 미만 심각. worst = 이상 정도 최대
  plate:{warn:0.10,crit:0.20,worst:0.30},  // 감소율 (원두께 기준): warn 미만 정상, crit 미만 주의, 이상 심각
  defect:{critArea:0.5,worstArea:1.5}      // m²: 스크래치는 주의, 도막 떨어짐 또는 critArea 이상은 심각
};

/* 우선순위 점수 = 판정 단계 점수 + 복합 가산 + 이상 정도(0–1) × degree
   심각이 항상 주의보다 위, 같은 단계 안에서는 복합(같은 지점의 도막 이상 + 강판 이상)이 위에 온다.
   (level 간격 > compound + degree 이어야 이 순서가 유지된다) */
export const PRIORITY={level:[0,1000,2000],compound:500,degree:100};

export const ACTION={repaint:'재도장',local:'국부 보수',steel:'강판 교체·보강',steelRepaint:'강판 교체·보강 후 재도장'};   // steelRepaint: 도막+강판 복합
export const DEFECT_LABEL={flaking:'도막 떨어짐',scratch:'스크래치'};

/* 이상 정도 0–1: 정상 경계 0, 심각 경계 0.5, worst 1 (x가 클수록 나쁨) */
function degreeOf(x,warn,crit,worst){
  if(x<warn)return 0;
  if(x<crit)return 0.5*(x-warn)/(crit-warn);
  return Math.min(1,0.5+0.5*(x-crit)/(worst-crit));
}

export function dftRatio(r){return r.dft/r.dftDesign;}
export function plateLoss(r){return (r.plateOrig-r.plate)/r.plateOrig;}
/* 표시 형식(측정값 / 기준값, 비율 %)은 format.js */

/* 한 레코드의 레이어별 판정: {level, degree} */
export function judge(r,layer){
  if(layer==='dft'){const c=CRITERIA.dft,ratio=dftRatio(r);
    return {level:ratio>=c.warn?OK:ratio>=c.crit?WARN:CRIT,degree:degreeOf(1-ratio,1-c.warn,1-c.crit,1-c.worst)};}
  if(layer==='plate'){const c=CRITERIA.plate,loss=plateLoss(r);
    return {level:loss<c.warn?OK:loss<c.crit?WARN:CRIT,degree:degreeOf(loss,c.warn,c.crit,c.worst)};}
  const c=CRITERIA.defect;
  if(!r.defect)return {level:OK,degree:0};
  const crit=r.defect==='flaking'||r.defectArea>=c.critArea;
  return crit?{level:CRIT,degree:Math.min(1,0.5+0.5*r.defectArea/c.worstArea)}
             :{level:WARN,degree:0.5*r.defectArea/c.critArea};
}

/* 같은 지점에 도막 이상(두께 또는 손상)과 강판 이상이 함께 있음 (우선순위 점수의 복합 가산) */
export function isCompound(r){return isTop(r,'all');}

/* top: 최우선 보수 (isTop) — 강판을 먼저 고친 뒤 다시 칠한다 */
export function actionFor(r,layer,level,top){
  if(level===OK)return null;
  if(top)return ACTION.steelRepaint;
  if(layer==='plate')return level===CRIT?ACTION.steel:ACTION.local;
  return level===CRIT?ACTION.repaint:ACTION.local;
}

export function scoreOf(level,degree,compound){return level===OK?0:PRIORITY.level[level]+(compound?PRIORITY.compound:0)+degree*PRIORITY.degree;}
export function priority(r,layer){const {level,degree}=judge(r,layer);return scoreOf(level,degree,isCompound(r));}

/* 레이어 기준 이상 항목을 우선순위 내림차순으로: [{r, level, degree, compound, score, action}] */
export function rank(records,layer){
  const out=[];
  for(const r of records){
    const {level,degree}=judge(r,layer);if(level===OK)continue;
    const compound=isCompound(r);
    out.push({r,level,degree,compound,score:scoreOf(level,degree,compound),action:actionFor(r,layer,level,compound)});
  }
  return out.sort((a,b)=>b.score-a.score);
}
