/* =========================================================
   손상 사진: public/images/defects/manifest.json (scripts/build-defects.js가 만든다)
     below = 흘수선 아래(빨강 외판) · above = 흘수선 위(회색 외판), 각각 flaking / scratch
   손상 레코드의 위치가 설계 흘수선(DWL) 아래면 below, 위면 above에서 손상 종류에 맞는 사진을 고른다.
   같은 지점은 항상 같은 사진: 레코드 id로 정한다 (salt로 도킹 차수마다 다른 사진).
   목록이 없거나(저장소를 새로 받은 환경) 비어 있으면 사진 없이 두고, 화면은 "사진 없음"을 보여준다.
   ========================================================= */
import { T } from '../hull.js';

const EMPTY={below:{flaking:[],scratch:[]},above:{flaking:[],scratch:[]}};

export async function loadDefectPhotos(){
  const base=import.meta.env.BASE_URL+'images/defects/';
  try{
    const r=await fetch(base+'manifest.json',{cache:'no-store'});if(!r.ok)return EMPTY;
    const m=await r.json(),out={};
    for(const zone of ['below','above']){out[zone]={};
      for(const kind of ['flaking','scratch'])out[zone][kind]=((m[zone]||{})[kind]||[]).map(f=>base+f);}
    return out;
  }catch(_){return EMPTY;}
}

/* integer hash of a record id (+ salt): spreads neighbouring ids over the whole list */
function hash(id,salt){let h=Math.imul((id+1)^salt,2654435761)>>>0;h^=h>>>15;h=Math.imul(h,2246822519)>>>0;return (h^h>>>13)>>>0;}

/* the photo for a defect at height Z (m): below / above the design waterline, by kind, chosen by id */
export function photoFor(photos,kind,id,Z,salt=0){
  if(!kind)return null;
  const list=((photos||EMPTY)[Z<T?'below':'above']||{})[kind]||[];
  return list.length?list[hash(id,salt)%list.length]:null;
}
