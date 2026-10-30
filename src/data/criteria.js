/* =========================================================
   판정 기준 · 보수 우선순위 (SPEC 3.3)
   기준값은 모두 예시값이며 이 파일의 상수만 바꾸면 전체 화면에 반영된다.
   ========================================================= */
/* 레이어 순서 (버튼·보고서 장·요약 카드·주요 발견·판정 기준 표): 강판 두께 → 도막 두께 → 도막 손상 */
export const LAYERS=['plate','dft','defect'];
export const LAYER_LABEL={plate:'강판 두께',dft:'도막 두께',defect:'도막 손상'};

export const OK=0, WARN=1, CRIT=2;
export const LEVEL_LABEL=['정상','주의','경고'];   // 레이어별 판정 (통계용)

/* 화면·보고서의 판정 단계: 최우선 보수 / 경고 / 주의 (서로 겹치지 않는다). 최우선 보수는 레이어별 기준(isTop)이며 목록 맨 위에 온다.
   gradeOf(level, top): top = isTop(r, layer) (지점) 또는 zone.top (구역) */
export const TOP=3;
export const GRADE_LABEL=['정상','주의','경고','최우선 보수'];   // 단계 이름 (CRIT = 경고)
/* 도막 손상 레이어는 단계 이름이 손상 종류다 (아이콘·색은 같은 단계 그대로): 주의 = 스크래치, 경고 = 도막 떨어짐 */
export const DEFECT_GRADE_LABEL=['정상','스크래치','도막 떨어짐','최우선 보수'];
export const gradeName=(g,layer)=>(layer==='defect'?DEFECT_GRADE_LABEL:GRADE_LABEL)[g];
export function gradeOf(level,top){return top?TOP:level;}

/* 최우선 보수 지점 — 레이어별 기준
   강판 두께 · 도막 두께: 같은 곳의 강판과 도막 중 하나는 경고, 다른 하나는 주의 이상 (두 레이어가 같은 기준 → 같은 구역)
   도막 손상: 손상(스크래치 또는 도막 떨어짐)이 있고 그 자리 강판이 주의 이상
   'all'(보고서 보수 계획): 둘 중 하나라도 해당 */
export const TOP_RULE={coat:'강판·도막 중 하나는 경고, 다른 하나는 주의 이상',defect:'손상이 있고 그 자리 강판이 주의 이상'};
export const topGroup=layer=>layer==='defect'||layer==='all'?layer:'coat';
export function isTop(r,layer){
  const p=judge(r,'plate').level;if(p===OK)return false;
  const g=topGroup(layer),coat=()=>{const d=judge(r,'dft').level;return d>OK&&(d===CRIT||p===CRIT);};
  return g==='defect'?!!r.defect:g==='all'?coat()||!!r.defect:coat();
}

/* 강판·도막 모두 감소율 (기준 두께 대비 줄어든 비율, 0–1), 같은 비교: warn 미만 정상, crit 미만 주의, 이상 경고 (reaches).
   worst = 이상 정도 최대 */
export const CRITERIA={
  dft:{warn:0.20,crit:0.50,worst:0.80},    // 감소율 (설계 기준)
  plate:{warn:0.10,crit:0.20,worst:0.30},  // 감소율 (원두께 기준)
  defect:{worstArea:1.5}                   // 판정은 종류만: 스크래치 = 주의, 도막 떨어짐 = 경고. worstArea(m²) = 히트맵 진하기의 최대 면적
};

/* 우선순위 점수 = 판정 단계 점수 + 복합 가산 + 이상 정도(0–1) × degree
   경고가 항상 주의보다 위, 같은 단계 안에서는 복합(같은 지점의 도막 이상 + 강판 이상)이 위에 온다.
   (level 간격 > compound + degree 이어야 이 순서가 유지된다) */
export const PRIORITY={level:[0,1000,2000],compound:500,degree:100};

/* 판정별 조치 (actionFor): 최우선 보수 → 강판 교체·보강 후 재도장 (모든 레이어)
   강판 두께: 경고 → 강판 교체·보강 / 주의 → 국부 보수 · 도막 두께: 경고 → 재도장 / 주의 → 국부 보수
   도막 손상: 경고(도막 떨어짐) → 재도장 / 주의(스크래치) → 터치업 */
export const ACTION={repaint:'재도장',local:'국부 보수',steel:'강판 교체·보강',steelRepaint:'강판 교체·보강 후 재도장',touchUp:'터치업'};
/* 무거운 조치 → 가벼운 조치 (ACTION_ORDER)와 세 레이어 통합 보수 단계는 repairSteps.js */
export const DEFECT_LABEL={flaking:'도막 떨어짐',scratch:'스크래치'};

/* 이상 정도 0–1: 정상 경계 0, 경고 경계 0.5, worst 1 (x가 클수록 나쁨) */
function degreeOf(x,warn,crit,worst){
  if(x<warn)return 0;
  if(x<crit)return 0.5*(x-warn)/(crit-warn);
  return Math.min(1,0.5+0.5*(x-crit)/(worst-crit));
}

/* 감소율 (0–1): 도막은 설계 대비, 강판은 원두께 대비 */
export function dftLoss(r){return (r.dftDesign-r.dft)/r.dftDesign;}
export function plateLoss(r){return (r.plateOrig-r.plate)/r.plateOrig;}
/* 표시 형식(측정값 / 기준값, 감소율 %)은 format.js */
/* 감소율이 기준 이상인가 (판정 기준 문구의 "이상"). 정확히 기준인 값(16 → 14.4 mm = 10%)이 부동소수점 오차(0.0999…)로
   미만이 되지 않도록 아주 작은 여유를 둔다 — 판정·보수 효과 예측·보고서 예측이 모두 이것으로 비교한다 */
export const reaches=(loss,t)=>loss>=t-1e-9;

/* 한 레코드의 레이어별 판정: {level, degree} — 강판·도막 같은 비교 */
export function judge(r,layer){
  if(layer==='dft'||layer==='plate'){const c=CRITERIA[layer],loss=layer==='dft'?dftLoss(r):plateLoss(r);
    return {level:reaches(loss,c.crit)?CRIT:reaches(loss,c.warn)?WARN:OK,degree:degreeOf(loss,c.warn,c.crit,c.worst)};}
  const c=CRITERIA.defect;
  if(!r.defect)return {level:OK,degree:0};
  const a=Math.min(1,r.defectArea/c.worstArea);   // the area only sets how strong the colour is within the band
  return r.defect==='flaking'?{level:CRIT,degree:0.5+0.5*a}:{level:WARN,degree:0.5*a};
}

/* 같은 지점에 도막 이상(두께 또는 손상)과 강판 이상이 함께 있음 (우선순위 점수의 복합 가산) */
export function isCompound(r){return isTop(r,'all');}

/* top: 최우선 보수 (isTop) — 강판을 먼저 고친 뒤 다시 칠한다 */
export function actionFor(r,layer,level,top){
  if(level===OK)return null;
  if(top)return ACTION.steelRepaint;
  if(layer==='defect')return level===CRIT?ACTION.repaint:ACTION.touchUp;
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
