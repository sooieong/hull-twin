/* =========================================================
   파일 저장 (SPEC 10.9): 진단 보고서 PDF, 보수 계획 자재 목록 Excel·보수 도면 PDF가 같은 순서로 저장한다.
   클릭 직후 파일 핸들 받기 (pickHandle) → 파일 만들기 → createWritable() → write(blob) → close() (saveBlob)
     · showSaveFilePicker는 다른 비동기 작업보다 먼저 호출한다 (늦으면 사용자 동작 허용 시간이 지나 실패할 수 있다)
     · 저장 창에서 취소(AbortError)하면 조용히 끝낸다 (pickHandle → ABORT)
     · 저장 창을 쓸 수 없는 브라우저·환경이면 일반 다운로드(다운로드 폴더)로 저장한다 (handle null)
   ========================================================= */
export const ABORT=Symbol('abort');

/* type: {description, accept:{mime:[ext]}} → a file handle, null (no picker: download instead) or ABORT */
export async function pickHandle(name,type){
  if(typeof window.showSaveFilePicker!=='function')return null;
  try{return await window.showSaveFilePicker({suggestedName:name,types:[type]});}
  catch(e){if(e&&e.name==='AbortError')return ABORT;                       // cancelled: end quietly
    console.warn('[DR.DOCK] 저장 창을 쓸 수 없어 일반 다운로드로 저장합니다',e);return null;}   // e.g. inside an iframe
}
function download(blob,name){
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),10000);
}
/* write to the picked file, or download → where it went (for the toast): the file name or 다운로드 폴더·name */
export async function saveBlob(handle,blob,name){
  if(handle){const w=await handle.createWritable();await w.write(blob);await w.close();return handle.name;}
  download(blob,name);return `다운로드 폴더·${name}`;
}
export const shortError=e=>{const n=(e&&e.name)||'Error',m=e&&e.message?String(e.message).split('\n')[0]:'';return m&&m!==n?`${n}: ${m.length>60?m.slice(0,60)+'…':m}`:n;};
const pad=n=>String(n).padStart(2,'0');
export const ymd=d=>`${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
