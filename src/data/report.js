/* =========================================================
   데이터 점검용 콘솔 출력: 측정점 개수, 레이어별 판정 건수, 레이어별 보수 구역 우선순위 상위 N건
   ========================================================= */
import { LAYERS, judge } from './criteria.js';
import { LAYER_LABEL, LEVEL_LABEL, gradeLabel, value, zoneLoc, num } from '../format.js';
import { groupZones } from './zones.js';

export function logDataSummary(store,top=5){
  const R=store.records,plan=store.plan.samples.length,blocked=store.plan.samples.filter(s=>s.blocked).length;
  console.log(`[Dr.Dock] 측정점 ${num(R.length)}개 (계획 ${num(plan)}개 중 킬 블록 측정 불가 ${num(blocked)}개 제외)`);

  console.log('[Dr.Dock] 레이어별 판정 건수 (측정점)');
  console.table(Object.fromEntries(LAYERS.map(layer=>{
    const c=[0,0,0];R.forEach(r=>c[judge(r,layer).level]++);
    return [LAYER_LABEL[layer],Object.fromEntries(LEVEL_LABEL.map((l,i)=>[l,c[i]]))];
  })));

  LAYERS.forEach(layer=>{
    const zones=groupZones(R,layer);
    console.log(`[Dr.Dock] ${LAYER_LABEL[layer]}·보수 대상 ${zones.length}건 중 우선순위 상위 ${top}건`);
    console.table(Object.fromEntries(zones.slice(0,top).map((z,i)=>[i+1,{
      위치:zoneLoc(z),
      측정점:z.count,
      최악값:value(z.worst,layer),
      판정:gradeLabel(z.level,z.top,layer),
      복합:z.compound?'●':'',   // 도막·강판 이상이 함께 있는 점 포함 (최우선 보수 판정은 '판정' 칸)
      점수:Math.round(z.score),
      권장조치:z.action
    }])));
  });
}
