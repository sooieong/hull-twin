/* =========================================================
   화면 공통 상태: 선택한 레이어와 선택한 측정점.
   메인, 보조 시각화 1·2, KPI가 모두 이 상태를 구독해 함께 바뀐다 (SPEC 4.3, 4.5).
   select(id, {fly:true}): KPI 목록·외판전개도에서 고른 경우 3D 카메라가 그 지점으로 이동한다 (SPEC 10.3).
   select(id, {auto:true}): 화면이 정한 기본 선택 (KPI 1위, 선택 해제). 카메라·목록 스크롤은 움직이지 않는다.
   이미 선택된 지점을 다시 고르면 'fly'만 알린다. 구독 함수: fn(kind, opts)
   ========================================================= */
export function createUiState(){
  let layer='dft',selId=null;const subs=new Set();
  const notify=(k,o={})=>subs.forEach(fn=>fn(k,o));
  return {
    subscribe(fn){subs.add(fn);return ()=>subs.delete(fn);},
    get layer(){return layer;},
    get selId(){return selId;},
    setLayer(l){if(l===layer)return;layer=l;notify('layer');},
    select(id,opts={}){if(id===selId){if(opts.fly)notify('fly',opts);return;}selId=id;notify('select',opts);}
  };
}
