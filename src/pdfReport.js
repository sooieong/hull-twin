/* =========================================================
   보고서 생성 (SPEC 6, 최소 기능): 현재 대시보드 화면 캡처 + 현재 레이어 KPI 상위 10건 → A4 가로 PDF 2쪽.
   jsPDF 기본 글꼴은 한글을 못 쓰므로, 보고서 페이지를 화면 밖 HTML로 만들어 html2canvas로 이미지화해 넣는다.
   3D 캔버스는 preserveDrawingBuffer 없이, 캡처 직전에 한 번 렌더링해서 얻은 이미지로 바꿔 끼운다.
   저장: showSaveFilePicker 지원 브라우저(Chrome, Edge)는 저장 창, 그 밖에는 일반 다운로드.
   ========================================================= */
import { CRIT, WARN, LAYER_LABEL, LEVEL_LABEL, formatValue } from './data/criteria.js';
import { groupZones } from './data/zones.js';
import { zoneText } from './data/report.js';

export const HULL_NO='H-2491';
const TOP=10;
const PAGE={w:1123,h:794};   // A4 가로 @96dpi (px)
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>`${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
const stamp=d=>`${d.getFullYear()}.${pad(d.getMonth()+1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function setupReport({button,store,ui,snapshot3D,toast,ship}){
  let busy=false;
  button.addEventListener('click',async()=>{
    if(busy||!store())return;
    const now=new Date(),name=`DRDock_Report_${HULL_NO}_${ymd(now)}.pdf`;
    // ask for the location first, while the click still counts as a user gesture
    let handle=null;
    if('showSaveFilePicker' in window){
      try{handle=await window.showSaveFilePicker({suggestedName:name,types:[{description:'PDF 문서',accept:{'application/pdf':['.pdf']}}]});}
      catch(e){if(e&&e.name==='AbortError')return;handle=null;}   // cancelled → stop; not allowed (e.g. iframe) → plain download
    }
    busy=true;const label=button.textContent;button.textContent='생성 중…';button.disabled=true;
    try{
      const blob=await buildPdf(store(),ui,snapshot3D,ship(),now,label);
      if(handle){const w=await handle.createWritable();await w.write(blob);await w.close();toast(`보고서를 저장했습니다 · ${handle.name}`);}
      else{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();
        setTimeout(()=>URL.revokeObjectURL(a.href),10000);toast(`다운로드 폴더에 저장했습니다 · ${name}`);}
    }catch(e){console.error(e);toast('보고서를 만들지 못했습니다');}
    finally{busy=false;button.textContent=label;button.disabled=false;}
  });
}

async function buildPdf(store,ui,snapshot3D,ship,now,buttonLabel){
  const [{default:html2canvas},{jsPDF}]=await Promise.all([import('html2canvas'),import('jspdf')]);
  // 1) dashboard as it is on screen
  const shot3d=snapshot3D();
  const dash=await html2canvas(document.querySelector('.app'),{backgroundColor:'#04070D',scale:1.5,logging:false,
    onclone:doc=>{
      const c=doc.querySelector('#vp canvas');
      if(c&&shot3d){const img=doc.createElement('img');img.src=shot3d;img.style.cssText=c.style.cssText;img.style.display='block';c.replaceWith(img);}
      const t=doc.querySelector('#toast');if(t)t.hidden=true;
      const b=doc.querySelector('#reportBtn');if(b){b.textContent=buttonLabel;b.disabled=false;}   // not the "생성 중…" state
      // html2canvas draws range inputs as text boxes: show the section slider as a plain bar
      doc.querySelectorAll('input[type=range]').forEach(r=>{const pct=(r.value-r.min)/((r.max-r.min)||1)*100,bar=doc.createElement('div');
        bar.style.cssText=`height:4px;margin:8px 0 12px;border-radius:2px;background:linear-gradient(90deg,#F37321 ${pct}%,#2A3A58 ${pct}%)`;r.replaceWith(bar);});
    }});
  // 2) report pages (offscreen HTML → images)
  const layer=ui.layer,zones=groupZones(store.records,layer),top=zones.slice(0,TOP);
  const measurable=store.plan.samples.filter(s=>!s.blocked).length;
  const mapping=store.mapState==='mapping';
  const meta=[['생성',stamp(now)],['레이어',LAYER_LABEL[layer]],
    ['매핑',mapping?`진행 중 ${Math.floor(store.progress*100)}%`:'완료'],
    ['측정점',`${store.records.length.toLocaleString()} / ${measurable.toLocaleString()}`],
    ['마지막 측정',store.lastTs?stamp(new Date(store.lastTs)):'—']];
  const head=(title,pg)=>`<header class="rpt-head"><div><div class="rpt-brand">DR.Dock <span>선체 진단 보고서</span></div>
      <div class="rpt-ship">${esc(ship.name)} · ${HULL_NO} · ${esc(ship.dock)}</div></div>
      <dl>${meta.map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl></header>
    <h2 class="rpt-h2">${title}<span>${pg} / 2</span></h2>`;
  const count=lv=>zones.filter(z=>z.level===lv).length;
  const rows=top.map((z,i)=>`<tr><td class="n">${i+1}</td><td>${esc(zoneText(z))}</td><td class="n">${z.count}</td>
      <td class="m">${esc(formatValue(z.worst,layer))}</td><td><span class="rpt-lv rpt-lv${z.level}">${LEVEL_LABEL[z.level]}</span></td>
      <td class="c">${z.compound?'●':''}</td><td>${esc(z.action)}</td></tr>`).join('');
  const sheet=document.createElement('div');sheet.className='rpt';
  sheet.innerHTML=`<section class="rpt-page">${head('대시보드 화면',1)}<div class="rpt-shot"><img alt="" src="${dash.toDataURL('image/jpeg',0.9)}"></div>
      <footer class="rpt-foot">화면 캡처 · ${stamp(now)}</footer></section>
    <section class="rpt-page">${head(`보수 우선순위 상위 ${TOP} · ${LAYER_LABEL[layer]}`,2)}
      <div class="rpt-sum"><span>심각 <b>${count(CRIT)}</b>구역</span><span>주의 <b>${count(WARN)}</b>구역</span>
        <span>최우선(도막·강판 복합) <b>${zones.filter(z=>z.compound).length}</b>구역</span><span>전체 <b>${zones.length}</b>구역</span></div>
      ${top.length?`<table class="rpt-tbl"><thead><tr><th>순위</th><th>위치</th><th>측정점</th><th>최악값 / 기준값</th><th>판정</th><th>복합</th><th>권장 조치</th></tr></thead><tbody>${rows}</tbody></table>`
        :'<p class="rpt-none">이상 구역이 없습니다.</p>'}
      <footer class="rpt-foot">순위: 심각 → 주의, 같은 단계 안에서는 도막·강판 복합 우선. 판정 기준과 상세 양식은 예시이며 다음 단계에서 정합니다.</footer></section>`;
  document.body.appendChild(sheet);
  try{
    await Promise.all([...sheet.querySelectorAll('img')].map(i=>i.decode().catch(()=>{})));
    const pdf=new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
    const pages=[...sheet.querySelectorAll('.rpt-page')];
    for(let i=0;i<pages.length;i++){
      const c=await html2canvas(pages[i],{backgroundColor:'#ffffff',scale:2,logging:false,width:PAGE.w,height:PAGE.h});
      if(i)pdf.addPage();
      pdf.addImage(c.toDataURL('image/jpeg',0.92),'JPEG',0,0,297,210);
    }
    pdf.setProperties({title:`DR.Dock Report ${HULL_NO} ${ymd(now)}`,creator:'DR.Dock'});
    return pdf.output('blob');
  }finally{sheet.remove();}
}
