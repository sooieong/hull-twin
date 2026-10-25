/* =========================================================
   손상 사진 찾기: public/images/defects/{flaking|scratch}_NN.jpg 를 01번부터 차례로 확인한다.
   폴더가 없거나(저장소를 새로 받은 환경) 사진이 없으면 빈 목록이 되고, 화면은 "사진 없음"을 보여준다.
   ========================================================= */
const KINDS=['flaking','scratch'];
const MAX_PER_KIND=50;

async function isImage(url){
  try{const r=await fetch(url,{method:'HEAD',cache:'no-store'});
    return r.ok&&(r.headers.get('content-type')||'').startsWith('image/');}
  catch(_){return false;}
}

export async function findDefectPhotos(){
  const base=import.meta.env.BASE_URL+'images/defects/',out={};
  for(const kind of KINDS){
    out[kind]=[];
    for(let n=1;n<=MAX_PER_KIND;n++){
      const url=`${base}${kind}_${String(n).padStart(2,'0')}.jpg`;
      if(!(await isImage(url)))break;
      out[kind].push(url);
    }
  }
  return out;
}
