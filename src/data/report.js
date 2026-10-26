/* =========================================================
   데이터 점검용 콘솔 출력: 측정점 개수, 레이어별 판정 건수, 레이어별 보수 구역 우선순위 상위 N건
   ========================================================= */
import { LAYERS, LAYER_LABEL, LEVEL_LABEL, judge, formatValue } from './criteria.js';
import { groupZones } from './zones.js';

const sideLabel={S:'우현',P:'좌현',PS:'좌우현'};
export function zoneText(z){
  const fr=z.frMin===z.frMax?`FR ${z.frMin}`:`FR ${z.frMin}–${z.frMax}`;
  const st=z.strakeMin===z.strakeMax?z.strakeMin:`${z.strakeMin}–${z.strakeMax}`;
  return `${fr} · ${st} · ${sideLabel[z.side]} · ${z.zone}`;
}

export function logDataSummary(store,top=5){
  const R=store.records,plan=store.plan.samples.length,blocked=store.plan.samples.filter(s=>s.blocked).length;
  console.log(`[Dr.Dock] 측정점 ${R.length}개 (계획 ${plan}개 중 킬 블록 측정 불가 ${blocked}개 제외)`);

  console.log('[Dr.Dock] 레이어별 판정 건수 (측정점)');
  console.table(Object.fromEntries(LAYERS.map(layer=>{
    const c=[0,0,0];R.forEach(r=>c[judge(r,layer).level]++);
    return [LAYER_LABEL[layer],Object.fromEntries(LEVEL_LABEL.map((l,i)=>[l,c[i]]))];
  })));

  LAYERS.forEach(layer=>{
    const zones=groupZones(R,layer);
    console.log(`[Dr.Dock] ${LAYER_LABEL[layer]} · 보수 구역 ${zones.length}곳 중 우선순위 상위 ${top}건`);
    console.table(Object.fromEntries(zones.slice(0,top).map((z,i)=>[i+1,{
      위치:zoneText(z),
      측정점:z.count,
      최악값:formatValue(z.worst,layer),
      판정:LEVEL_LABEL[z.level],
      복합:z.compound?'●':'',
      점수:Math.round(z.score),
      권장조치:z.action
    }])));
  });
}
