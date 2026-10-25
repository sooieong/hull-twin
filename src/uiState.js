/* =========================================================
   화면 공통 상태: 선택한 레이어와 선택한 측정점.
   메인, 보조 시각화 1·2, KPI가 모두 이 상태를 구독해 함께 바뀐다 (SPEC 4.3, 4.5).
   ========================================================= */
export function createUiState(){
  let layer='dft',selId=null;const subs=new Set();
  const notify=k=>subs.forEach(fn=>fn(k));
  return {
    subscribe(fn){subs.add(fn);return ()=>subs.delete(fn);},
    get layer(){return layer;},
    get selId(){return selId;},
    setLayer(l){if(l===layer)return;layer=l;notify('layer');},
    select(id){if(id===selId)return;selId=id;notify('select');}
  };
}
