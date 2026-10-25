/* =========================================================
   판정 기준 · 보수 우선순위 (SPEC 3.3)
   기준값은 모두 예시값이며 이 파일의 상수만 바꾸면 전체 화면에 반영된다.
   ========================================================= */
export const LAYERS=['dft','plate','defect'];
export const LAYER_LABEL={dft:'도막 두께',plate:'강판 두께',defect:'도막 손상'};

export const OK=0, WARN=1, CRIT=2;
export const LEVEL_LABEL=['정상','주의','심각'];

export const CRITERIA={
  dft:{warn:0.8,crit:0.5,worst:0.2},       // 현재/설계 비율: warn 이상 정상, crit 이상 주의, 미만 심각. worst = 이상 정도 최대
  plate:{warn:0.10,crit:0.20,worst:0.30},  // 원두께 대비 감소율: warn 미만 정상, crit 미만 주의, 이상 심각
  defect:{critArea:0.5,worstArea:1.5}      // m²: 스크래치는 주의, 도막 떨어짐 또는 critArea 이상은 심각
};

/* 우선순위 점수 = 복합 가산 + 판정 단계 점수 + 이상 정도(0–1) × degree
   복합(같은 지점의 도막 이상 + 강판 이상)은 compound 가산으로 항상 맨 위에 온다. */
export const PRIORITY={compound:1000,level:[0,100,200],degree:100};

export const ACTION={repaint:'재도장',local:'국부 보수',steel:'강판 교체·보강'};

/* 이상 정도 0–1: 정상 경계 0, 심각 경계 0.5, worst 1 (x가 클수록 나쁨) */
function degreeOf(x,warn,crit,worst){
  if(x<warn)return 0;
  if(x<crit)return 0.5*(x-warn)/(crit-warn);
  return Math.min(1,0.5+0.5*(x-crit)/(worst-crit));
}

export function dftRatio(r){return r.dft/r.dftDesign;}
export function plateLoss(r){return (r.plateOrig-r.plate)/r.plateOrig;}

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

/* 같은 지점에 도막 이상(두께 또는 손상)과 강판 이상이 함께 있음 */
export function isCompound(r){
  return (judge(r,'dft').level>OK||judge(r,'defect').level>OK)&&judge(r,'plate').level>OK;
}

export function actionFor(r,layer,level,compound){
  if(level===OK)return null;
  if(compound)return ACTION.steel;                     // 강판 보수 후 재도장
  if(layer==='plate')return level===CRIT?ACTION.steel:ACTION.local;
  return level===CRIT?ACTION.repaint:ACTION.local;
}

function score(level,degree,compound){return level===OK?0:(compound?PRIORITY.compound:0)+PRIORITY.level[level]+degree*PRIORITY.degree;}
export function priority(r,layer){const {level,degree}=judge(r,layer);return score(level,degree,isCompound(r));}

/* 레이어 기준 이상 항목을 우선순위 내림차순으로: [{r, level, degree, compound, score, action}] */
export function rank(records,layer){
  const out=[];
  for(const r of records){
    const {level,degree}=judge(r,layer);if(level===OK)continue;
    const compound=isCompound(r);
    out.push({r,level,degree,compound,score:score(level,degree,compound),action:actionFor(r,layer,level,compound)});
  }
  return out.sort((a,b)=>b.score-a.score);
}
