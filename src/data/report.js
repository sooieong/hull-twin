/* =========================================================
   데이터 점검용 콘솔 출력: 측정점 개수, 레이어별 판정 건수, 레이어별 우선순위 상위 N건
   ========================================================= */
import { LAYERS, LAYER_LABEL, LEVEL_LABEL, judge, rank, plateLoss } from './criteria.js';

const DEFECT_LABEL={flaking:'도막 떨어짐',scratch:'스크래치'};

function valueText(r,layer){
  if(layer==='dft')return `${r.dft} / ${r.dftDesign} µm (${Math.round(r.dft/r.dftDesign*100)}%)`;
  if(layer==='plate')return `${r.plate.toFixed(1)} / ${r.plateOrig.toFixed(1)} mm (−${(plateLoss(r)*100).toFixed(1)}%)`;
  return `${DEFECT_LABEL[r.defect]} ${r.defectArea} m²`;
}

export function logDataSummary(store,top=5){
  const R=store.records,plan=store.plan.samples.length,blocked=store.plan.samples.filter(s=>s.blocked).length;
  console.log(`[DR.Dock] 측정점 ${R.length}개 (계획 ${plan}개 중 킬 블록 측정 불가 ${blocked}개 제외)`);

  console.log('[DR.Dock] 레이어별 판정 건수');
  console.table(Object.fromEntries(LAYERS.map(layer=>{
    const c=[0,0,0];R.forEach(r=>c[judge(r,layer).level]++);
    return [LAYER_LABEL[layer],Object.fromEntries(LEVEL_LABEL.map((l,i)=>[l,c[i]]))];
  })));

  LAYERS.forEach(layer=>{
    console.log(`[DR.Dock] ${LAYER_LABEL[layer]} · 우선순위 상위 ${top}건`);
    console.table(Object.fromEntries(rank(R,layer).slice(0,top).map((x,i)=>[i+1,{
      위치:`FR ${x.r.fr} · ${x.r.strake}(${x.r.side}) · ${x.r.zone}`,
      측정값:valueText(x.r,layer),
      판정:LEVEL_LABEL[x.level],
      복합:x.compound?'●':'',
      점수:Math.round(x.score),
      권장조치:x.action
    }])));
  });
}
