/* =========================================================
   진단 보고서 (SPEC 6, 10.9) — 5장 HTML 페이지를 만든다.
   - ?report=preview : PDF 대신 5장을 화면에 바로 보여준다 (레이아웃 확인용)
   - 보고서 생성 버튼 : 매핑 중·중지 상태에서는 쓸 수 없다. PDF 저장은 미리보기 확인 후 연결한다 (SPEC 8.7).
   ========================================================= */
import './report.css';
import { buildReportData } from './data.js';
import { renderHullViews } from './render3d.js';
import { pagesHtml } from './pages.js';

const VIEW_JOBS=[{key:'all',view:'iso',w:700,h:400},
  ...['dft','plate','defect'].flatMap(key=>[{key,view:'iso',w:500,h:250},{key,view:'bottom',w:500,h:250}])];

/* the 5 report pages as one element (images decoded, ready to show or to rasterise) */
export async function buildReportPages(store){
  const data=buildReportData(store),imgs=renderHullViews(store.records,VIEW_JOBS);
  const root=document.createElement('div');root.className='rp-root';root.innerHTML=pagesHtml(data,imgs);
  await Promise.all([...root.querySelectorAll('img')].map(img=>img.decode?img.decode().catch(()=>{}):null));
  return root;
}

export async function showPreview(store){
  document.body.classList.add('rp-preview');
  const pv=document.createElement('div');pv.className='rp-pv';
  pv.innerHTML=`<div class="rp-pv-bar"><b>DR.Dock</b> 진단 보고서 미리보기<span>A4 가로 5장 · 1123 × 794 px · 전체 측정 데이터 기준</span><a href="${location.pathname}">대시보드로 돌아가기</a></div><div class="rp-pv-wait">보고서를 만드는 중…</div>`;
  document.body.appendChild(pv);
  if(document.fonts&&document.fonts.ready)await document.fonts.ready;
  const root=await buildReportPages(store);
  pv.querySelector('.rp-pv-wait').replaceWith(root);
}

/* header button: disabled while a run is going or paused; for now it opens the preview */
export function setupReportButton(button,store,toast){
  const sync=()=>{const busy=store.mapState==='mapping'||store.mapState==='paused';
    button.setAttribute('aria-disabled',String(busy));button.classList.toggle('is-disabled',busy);
    button.title=busy?'매핑이 끝난 뒤 생성할 수 있습니다':'진단 보고서 (PDF 5장)';};
  button.addEventListener('click',()=>{
    if(button.getAttribute('aria-disabled')==='true'){toast('매핑이 끝난 뒤 생성할 수 있습니다');return;}
    window.open(`${location.pathname}?report=preview`,'_blank','noopener');
    toast('보고서 미리보기를 새 탭에 열었습니다 · PDF 저장은 미리보기 확인 후 연결합니다');
  });
  store.subscribe(k=>{if(k.has('state'))sync();});sync();
}
