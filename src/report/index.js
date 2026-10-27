/* =========================================================
   진단 보고서 (SPEC 6, 10.9) — 5장 HTML 페이지를 만들고 PDF로 저장한다.
   - ?report=preview : PDF 대신 5장을 화면에 바로 보여준다 (레이아웃 확인용)
   - 보고서 생성 버튼 : 매핑 중·중지 상태에서는 쓸 수 없다.
   저장 순서 (10.9): 클릭 직후 파일 핸들 받기 → 보고서 생성 → createWritable() → write(blob) → close()
     · showSaveFilePicker는 다른 비동기 작업보다 먼저 호출한다 (늦으면 사용자 동작 허용 시간이 지나 실패할 수 있다)
     · 저장 창에서 취소(AbortError)하면 조용히 끝낸다
     · 저장 창을 쓸 수 없는 브라우저·환경이면 일반 다운로드(다운로드 폴더)로 저장한다
     · 실패하면 알림에 단계와 오류 종류를 짧게 보여주고 콘솔에 전체 오류를 남긴다
   ========================================================= */
import './report.css';
import { COLOR } from '../styles/tokens.js';
import { buildReportData, dockContext } from './data.js';
import { renderHullViews } from './render3d.js';
import { pagesHtml } from './pages.js';
import { loadIconData } from '../gradeUi.js';

const VIEW_JOBS=[{key:'all',view:'iso',w:700,h:400},
  ...['dft','plate','defect'].flatMap(key=>[{key,view:'iso',w:500,h:250},{key,view:'bottom',w:500,h:250}])];
const PAGE={w:1123,h:794,mmW:297,mmH:210};   // A4 가로
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>`${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
/* Dr.Dock_Report_H-2491_20261027.pdf — hull number, date made */
export const reportFileName=(d,dockKey)=>`Dr.Dock_Report_${dockContext(dockKey).hull}_${ymd(d)}.pdf`;

/* the 5 report pages as one element (images decoded, ready to show or to rasterise) */
export async function buildReportPages(store,now=new Date()){
  await loadIconData();   // judgement icons as data URIs for the maps (they become images in the PDF)
  const data=buildReportData(store,now),imgs=renderHullViews(store.records,VIEW_JOBS);
  const root=document.createElement('div');root.className='rp-root';root.innerHTML=pagesHtml(data,imgs);
  await Promise.all([...root.querySelectorAll('img')].map(img=>img.decode?img.decode().catch(()=>{}):null));
  return root;
}

export async function showPreview(store){
  document.body.classList.add('rp-preview');
  const pv=document.createElement('div');pv.className='rp-pv';
  pv.innerHTML=`<div class="rp-pv-bar"><b>Dr.Dock</b> 진단 보고서 미리보기<span>A4 가로 5장·1123 × 794 px·전체 측정 데이터 기준</span><a href="${location.pathname}">대시보드로 돌아가기</a></div><div class="rp-pv-wait">보고서를 만드는 중…</div>`;
  document.body.appendChild(pv);
  if(document.fonts&&document.fonts.ready)await document.fonts.ready;
  const root=await buildReportPages(store);
  pv.querySelector('.rp-pv-wait').replaceWith(root);
}

/* inline SVG (maps with thousands of cells, charts) → <img>, so html2canvas draws one image instead of walking the nodes */
async function svgsToImages(root){
  const ser=new XMLSerializer();
  await Promise.all([...root.querySelectorAll('svg[width][height]')].map(svg=>{   // charts only; the CSS-sized logo stays inline
    const img=new Image();img.width=+svg.getAttribute('width');img.height=+svg.getAttribute('height');img.alt='';
    img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(ser.serializeToString(svg));
    svg.replaceWith(img);return img.decode().catch(()=>{});
  }));
}

/* 5 pages → one html2canvas pass (scale 2, dashboard left out of the clone) → sliced into A4 landscape pages → jsPDF */
export async function makeReportPdf(store,now=new Date()){
  const [{default:html2canvas},{jsPDF}]=await Promise.all([import('html2canvas'),import('jspdf')]);
  if(document.fonts&&document.fonts.ready)await document.fonts.ready;
  const root=await buildReportPages(store,now);
  await svgsToImages(root);
  const host=document.createElement('div');host.className='rp-offscreen';host.setAttribute('aria-hidden','true');
  host.appendChild(root);document.body.appendChild(host);
  try{
    const S=2,shot=await html2canvas(root,{scale:S,backgroundColor:COLOR.rp.bg,logging:false,
      ignoreElements:el=>el.classList&&(el.classList.contains('app')||el.classList.contains('toast')||el.classList.contains('lightbox'))});
    const pdf=new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
    const top0=root.getBoundingClientRect().top,page=document.createElement('canvas');page.width=PAGE.w*S;page.height=PAGE.h*S;
    const ctx=page.getContext('2d');
    [...root.querySelectorAll('.rp-page')].forEach((el,i)=>{
      const y=Math.round((el.getBoundingClientRect().top-top0)*S);
      ctx.fillStyle=COLOR.rp.bg;ctx.fillRect(0,0,page.width,page.height);ctx.drawImage(shot,0,y,page.width,page.height,0,0,page.width,page.height);
      if(i)pdf.addPage();
      pdf.addImage(page.toDataURL('image/jpeg',0.92),'JPEG',0,0,PAGE.mmW,PAGE.mmH);
    });
    const dc=dockContext(store.dockKey);pdf.setProperties({title:`Dr.Dock Hull Report ${dc.hull} ${dc.dockInfo.date} ${ymd(now)}`,creator:'Dr.Dock'});
    return pdf.output('blob');
  }finally{host.remove();}
}

function download(blob,name){
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),10000);
}
const shortError=e=>{const n=(e&&e.name)||'Error',m=e&&e.message?String(e.message).split('\n')[0]:'';return m&&m!==n?`${n}: ${m.length>60?m.slice(0,60)+'…':m}`:n;};

/* header button: disabled while a run is going or paused, and while a report is being made */
export function setupReportButton(button,store,toast){
  const label=button.textContent;let busy=false;
  const mapping=()=>store.mapState==='mapping'||store.mapState==='paused';
  const sync=()=>{const off=busy||mapping();
    button.setAttribute('aria-disabled',String(off));button.classList.toggle('is-disabled',off);button.setAttribute('aria-busy',String(busy));
    button.title=busy?'보고서 생성 중…':mapping()?'매핑이 끝난 뒤 생성할 수 있습니다':'진단 보고서 저장 (PDF 5장)';};
  button.addEventListener('click',async()=>{
    if(busy)return;
    if(mapping()){toast('매핑이 끝난 뒤 생성할 수 있습니다');return;}
    const now=new Date(),name=reportFileName(now,store.dockKey);
    // 1) file handle first, while the click still counts as a user gesture
    let handle=null;
    if(typeof window.showSaveFilePicker==='function'){
      try{handle=await window.showSaveFilePicker({suggestedName:name,types:[{description:'PDF 문서',accept:{'application/pdf':['.pdf']}}]});}
      catch(e){if(e&&e.name==='AbortError')return;                      // cancelled: end quietly
        console.warn('[Dr.Dock] 저장 창을 쓸 수 없어 일반 다운로드로 저장합니다',e);handle=null;}   // e.g. inside an iframe
    }
    busy=true;button.textContent='보고서 생성 중…';sync();
    let stage='make';
    try{
      // 2) make the report, 3) write it
      const blob=await makeReportPdf(store,now);
      stage='save';
      if(handle){const w=await handle.createWritable();await w.write(blob);await w.close();toast(`보고서를 저장했습니다·${handle.name}`,4000);}
      else{download(blob,name);toast(`보고서를 저장했습니다·다운로드 폴더·${name}`,4000);}
    }catch(e){
      console.error(`[Dr.Dock] 보고서 ${stage==='make'?'생성':'저장'} 실패`,e);
      toast(`보고서를 ${stage==='make'?'만들지':'저장하지'} 못했습니다·${shortError(e)}`,8000);
    }finally{busy=false;button.textContent=label;sync();}
  });
  store.subscribe(k=>{if(k.has('state'))sync();});sync();
}
