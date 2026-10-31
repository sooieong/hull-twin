/* =========================================================
   보수 계획 출력 (SPEC 12.7, 13) — 보수 계획 화면의 버튼을 누를 때 불러온다 (plan/view.js).
   둘 다 누른 순간의 화면 그대로: 슬라이더 단계 · 수면 아래 전체 재도장 스위치 · 직접 추가한 판 (snap.name = 범위 한 줄).
   - 자재 발주 목록 (Excel, 13.6): 시트 강판 · 도료, 같은 양식 (제목 · 결재란 · 기본 정보 · 표 · 합계 SUM · 계산식). ExcelJS, 누를 때 불러온다.
     합계 = 보수 물량 및 효과 = PDF 2장. DR.DOCK_MaterialList_H-2491_YYYYMMDD.xlsx
     보수 이력(지난 도킹)은 같은 양식의 자재 사용 내역 (결재란 없음, 조치 = 한 작업): DR.DOCK_MaterialUsage_H-2491_YYYYMMDD.xlsx
   - 보수 도면 PDF (헤더 "보수 도면(PDF)"): A4 가로 2장, 보고서와 같은 흰 바탕·머리말·꼬리말 (report.css, report/index.pagesToPdf).
     1장 = 범위 한 줄 · 보수 물량 및 효과 (화면과 같은 칸) · 보수 도면 (화면과 같은 색과 범례: 조치 3색 + 추가한 판 주황)
     2장 = 강판 목록 + 도료 목록 (합계 = 보수 물량 및 효과). DR.DOCK_RepairPlan_H-2491_YYYYMMDD.pdf
   snap (view.js snapshot, taken at the press): {store, history, docTitle, range: {level, fullBelow, added}} — the plan and every number
   are computed from range here, fresh (scenario.stateResult), not taken from the screen (보수 이력: historyResult, the record of then)
   ========================================================= */
import { FS } from '../hull.js';
import { COLOR, FONT } from '../styles/tokens.js';
import { num, dateTime } from '../format.js';
import { PAINT_SPEC, STEEL_DENSITY } from '../data/baseline.js';
import { stepInfo } from '../data/repairSteps.js';
import { platesOf } from '../data/plates.js';
import { ymd } from '../saveFile.js';
import { dockContext } from '../report/data.js';
import { pagesToPdf } from '../report/index.js';
import { shellMapSvg } from '../report/charts.js';
import { stateResult, historyResult, paintZoneOf } from './scenario.js';
import { plateLoc, lookOf, KIND_LABEL, FILL } from './drawing.js';
import { PAINT_FORMULA, REPAINT_RULE, WORK_KINDS, workText, effectCuts, rangeName, historyName } from './view.js';
import logoReport from '../assets/report_logo.png';

/* the plan of the state at the press, computed again: {…snap, plan, res, added, name (범위), plates} */
function resolve(snap){
  const {store,range}=snap,plates=platesOf(store).plates;
  if(snap.history){const h=historyResult(store);return {...snap,plan:h.plan,res:h,added:new Set(),name:historyName(),plates};}
  const r=stateResult(store,range,{fresh:true});
  return {...snap,plan:r.plan,res:r,added:r.added,name:rangeName(range.level,range.fullBelow,r.added.size),plates};
}

/* ---------- 자재 발주 목록 (Excel) ----------
   Two sheets, 강판 and 도료, one form: big title (+ 담당·검토·승인 boxes, not on 자재 사용 내역) · 기본 정보 · the table
   (header row orange, thin grey borders, every other row faint grey) · 합계 by formula · small notes.
   맑은 고딕, numbers right-aligned with thousands commas, 중량 one decimal; columns fit their content; no frozen panes, the header
   row printed on every page (A4 가로, one page wide). Rows hold the unrounded values, so a SUM shows the screen's total */
const XL={orange:'FFF37321',white:'FFFFFFFF',grid:'FFBFBFBF',zebra:'FFF7F7F7',label:'FFF2F2F2',note:'FF6B7385',font:'맑은 고딕'};
const XL_TYPE='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const thin={style:'thin',color:{argb:XL.grid}},edges={top:thin,left:thin,bottom:thin,right:thin};
const fill=argb=>({type:'pattern',pattern:'solid',fgColor:{argb}});
const colName=n=>String.fromCharCode(64+n);   // 1 → A (at most 10 columns)
/* the width a text takes in Excel's character units (Hangul about twice a Latin letter) */
const textWidth=s=>[...String(s??'')].reduce((w,c)=>w+(c.charCodeAt(0)>0x2e80?1.9:1.05),0);

/* one sheet. cols: [{h: header, fmt: number format (a number column, right-aligned), dp, align}] · rows: arrays of values ·
   total: {label, cells: {column index (0-based): {fn: 'SUM'|'COUNTA' over that column, result, fmt, dp, unit}}} · notes: small lines below.
   결재란: three equal boxes over the last three sheet columns — so the wider of the table's last two columns, when much wider than
   the other, takes two sheet columns (merged on every table row) and the three get one width */
function buildSheet(wb,name,{title,approve,info,cols,rows,total,notes,empty}){
  const ws=wb.addWorksheet(name,{properties:{defaultRowHeight:16}});
  const font=(o={})=>({name:XL.font,size:10,...o});
  const style=(ref,s={})=>{const c=ws.getCell(ref);c.font=font(s.font);c.alignment={vertical:'middle',...s.alignment};
    if(s.fill)c.fill=fill(s.fill);if(s.border!==false)c.border=edges;if(s.numFmt)c.numFmt=s.numFmt;return c;};
  const put=(ref,value,s)=>{const c=style(ref,s);c.value=value;return c;};
  // widths by content (the table, not the merged title and 기본 정보), then the sheet columns of each table column
  const want=cols.map((c,i)=>{const shown=[c.h,...rows.map(r=>c.fmt&&typeof r[i]==='number'?num(r[i],c.dp??0):r[i])];
    const t=total.cells[i];if(t)shown.push(`${num(t.result,t.dp??0)} ${t.unit||''}`);
    return Math.min(60,Math.max(6,Math.ceil(Math.max(...shown.map(textWidth)))+3));});
  const span=cols.map(()=>1);
  if(approve){const a=cols.length-2,b=a+1,wide=want[a]>=want[b]?a:b,other=wide===a?b:a;if(want[wide]>=1.6*want[other])span[wide]=2;}
  const start=[];let next=1;cols.forEach((_,i)=>{start.push(next);next+=span[i];});
  const N=next-1,last=colName(N),L=i=>colName(start[i]);
  const width=cols.flatMap((_,i)=>Array(span[i]).fill(want[i]/span[i]));
  if(approve){const w=Math.max(11,...width.slice(-3));width.fill(w,N-3);}
  width.forEach((w,k)=>{ws.getColumn(k+1).width=Math.ceil(w);});
  // a table cell: in its column, merged over the column's sheet columns
  const cell=(i,r,value,s)=>{for(let k=1;k<span[i];k++)style(`${colName(start[i]+k)}${r}`,s);
    if(span[i]>1)ws.mergeCells(`${L(i)}${r}:${colName(start[i]+span[i]-1)}${r}`);return put(`${L(i)}${r}`,value,s);};
  // title (rows 1–2) · 담당 검토 승인: a label row and an empty row to sign in
  ws.mergeCells(`A1:${approve?colName(N-3):last}2`);put('A1',title,{font:{size:18,bold:true},border:false});
  ws.getRow(1).height=22;ws.getRow(2).height=38;
  if(approve)['담당','검토','승인'].forEach((t,i)=>{const col=colName(N-2+i);
    put(`${col}1`,t,{font:{bold:true},fill:XL.label,alignment:{horizontal:'center'}});put(`${col}2`,null);});
  // 기본 정보 (row 4 …): the label over A–B, the value over C–last
  const info0=4;
  info.forEach(([k,v],i)=>{const r=info0+i;for(let c=2;c<=N;c++)style(`${colName(c)}${r}`);
    ws.mergeCells(`A${r}:B${r}`);ws.mergeCells(`C${r}:${last}${r}`);
    put(`A${r}`,k,{font:{bold:true},fill:XL.label});put(`C${r}`,v,{alignment:{wrapText:true}});});
  // the table: header, rows (every other one faint grey), 합계
  const head=info0+info.length+1,r0=head+1;
  cols.forEach((c,i)=>cell(i,head,c.h,{font:{bold:true,color:{argb:XL.white}},fill:XL.orange,alignment:{horizontal:'center',wrapText:true}}));
  ws.getRow(head).height=22;
  const align=c=>({horizontal:c.align||(c.fmt?'right':'left')});
  rows.forEach((row,j)=>row.forEach((v,i)=>cell(i,r0+j,v,{numFmt:cols[i].fmt,alignment:align(cols[i]),fill:j%2?XL.zebra:null})));
  if(!rows.length){for(let c=2;c<=N;c++)style(`${colName(c)}${r0}`);ws.mergeCells(`A${r0}:${last}${r0}`);
    put(`A${r0}`,empty,{font:{color:{argb:XL.note}},alignment:{horizontal:'center'}});}
  const r1=r0+Math.max(rows.length,1)-1,rt=r1+1,sum={fill:XL.label,font:{bold:true}};
  cols.forEach((_,i)=>{const t=total.cells[i];
    cell(i,rt,i===0?total.label:t?{formula:`${t.fn}(${L(i)}${r0}:${L(i)}${r1})`,result:t.result}:null,
      {...sum,numFmt:t?.fmt,alignment:{horizontal:i===0?'center':'right'}});});
  // notes, small and grey, under the table
  notes.forEach((t,i)=>{const r=rt+2+i;ws.mergeCells(`A${r}:${last}${r}`);put(`A${r}`,t,{font:{size:8,color:{argb:XL.note}},border:false});});
  // the header row prints on every page; A4 landscape, one page wide. Printed, the notes are the footer of every page
  // (small, left; the page number right) — never a last page of their own — so the print area ends at 합계
  ws.pageSetup={paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,horizontalCentered:true,
    margins:{left:0.4,right:0.4,top:0.4,bottom:0.6,header:0.2,footer:0.25},printTitlesRow:`${head}:${head}`,printArea:`A1:${last}${rt}`};
  const ff=`&"${XL.font},Regular"&8&K6B7385`,esc8=t=>t.replace(/&/g,'&&');
  ws.headerFooter={oddFooter:`&L${ff}${esc8(notes.join('  '))}&R${ff}&P / &N`};
  return ws;
}

/* 자재 발주 목록 (보수 이력: 자재 사용 내역, no 결재란) — the state at the press, computed again (resolve) */
export async function materialsXlsx(state,now){
  const snap=resolve(state),{res,plan,added,store}=snap,S=dockContext(store.dockKey),{default:ExcelJS}=await import('exceljs');
  const wb=new ExcelJS.Workbook();wb.creator='DR.DOCK';wb.created=now;wb.calcProperties.fullCalcOnLoad=true;
  const kind=snap.docTitle,approve=!snap.history;
  const info=[['선박',S.name],['도킹',`${S.docking}${S.dock?`·${S.dock}`:''}`],['작성일',dateTime(now).split(' ')[0]],
    ['문서 번호',`${snap.history?'MU':'ML'}-${S.hull.replace(/-/g,'')}-${ymd(now)}`],['기준',snap.name.replace(/^기준:\s*/,'')],['작성','DR.DOCK']];
  // 조치: the step's action (보수 이력: the work done) · 비고: put in by hand · the note: how 중량 is computed (data/plates.js)
  const act=({p,w})=>snap.history?workText(w):stepInfo(p.step).action;
  buildSheet(wb,'강판',{title:`${kind} (강판)`,approve,info,notes:[`중량(t) = 가로(m) × 세로(m) × 원두께(mm) × ${STEEL_DENSITY} ÷ 1,000`],empty:'강판 교체·보강 판이 없습니다.',
    cols:[{h:'번호',fmt:'0',align:'center'},{h:'판 번호'},{h:'위치'},{h:'재질'},{h:'크기(m)',align:'right'},{h:'원두께(mm)',fmt:'#,##0.0',dp:1},{h:'중량(t)',fmt:'#,##0.0',dp:1},{h:'조치'},{h:'비고'}],
    rows:res.steelRows.map((r,i)=>[i+1,r.p.id,plateLoc(r.p),r.p.material,`${num(r.p.length,1)} × ${num(r.p.width,1)}`,r.p.orig,r.p.weight,act(r),added.has(r.p.id)?'직접 추가':'']),
    total:{label:'합계',cells:{1:{fn:'COUNTA',result:res.steelN,fmt:'#,##0"판"',unit:'판'},6:{fn:'SUM',result:res.steel,fmt:'#,##0.0" t"',dp:1,unit:'t'}}}});
  // 도료 비고: how many of the plates put in by hand each row takes (their repaint: the plate's paint zone · local: 국부 보수)
  const handIn={};
  for(const id of added){const w=plan.get(id),p=platesOf(store).byId.get(id);const k=w.paint==='full'?paintZoneOf(p):w.paint==='local'?'local':null;if(k)handIn[k]=(handIn[k]||0)+1;}
  buildSheet(wb,'도료',{title:`${kind} (도료)`,approve,info,notes:[`도료 ${PAINT_FORMULA}`],empty:'도장 작업이 없습니다.',
    cols:[{h:'번호',fmt:'0',align:'center'},{h:'도장 구역'},{h:'작업'},{h:'도료'},{h:'면적(m²)',fmt:'#,##0'},{h:'필요량(L)',fmt:'#,##0'},{h:'비고'}],
    rows:res.paintRows.map((r,i)=>[i+1,r.zone,r.work,r.paint,r.area,r.litres,handIn[r.key]?`직접 추가 ${handIn[r.key]}판`:'']),
    total:{label:'합계',cells:{4:{fn:'SUM',result:res.repaint,fmt:'#,##0" m²"',unit:'m²'},5:{fn:'SUM',result:res.paint,fmt:'#,##0" L"',unit:'L'}}}});
  return new Blob([await wb.xlsx.writeBuffer()],{type:XL_TYPE});
}

/* ---------- PDF ---------- */
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function page(n,title,body,S,now){
  return `<section class="rp-page" data-page="${n}">
    <header class="rp-head"><div class="rp-brand"><img src="${logoReport}" alt="DR.DOCK"></div>
      <div class="rp-doc"><b>보수 도면</b><span>${S.name}</span></div>
      <div class="rp-ch"><i>${n}</i><b>${title}</b></div></header>
    <div class="rp-body">${body}</div>
    <footer class="rp-foot"><span>${S.docking}${S.dock?`·${S.dock}`:''}</span><span>생성 ${dateTime(now)}</span><b>${n} / 2</b></footer>
  </section>`;
}
const box=(title,inner,cls='')=>`<section class="rp-box ${cls}"><h3>${title}</h3>${inner}</section>`;
const table=(head,rows,foot,cls='')=>`<table class="rp-tbl ${cls}"><thead><tr>${head.map(h=>`<th${h.startsWith('#')?' class="n"':''}>${h.replace(/^#/,'')}</th>`).join('')}</tr></thead><tbody>${rows.join('')}${foot}</tbody></table>`;

/* the 보수 도면 on white, as on the screen (plan/drawing.js): faint plate grid, plates in the plan in solid fills by look
   (조치 3색 · 추가한 판 주황) with a 1px gap; steel plate numbers where they fit */
function drawingSvg(snap,W,H){
  const looks={plan:snap.plan,added:snap.added,cands:false};
  return shellMapSvg(W,H,'rdClip',({px,py})=>{
    const r=p=>{const x=px(p.x0/FS),y=py(p.uLo);return {x,y,w:px(p.x1/FS)-x,h:py(p.uHi)-y};},out=[];
    for(const p of snap.plates){const b=r(p);out.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="${COLOR.rp.line}" stroke-width="0.4"/>`);}
    const marks=snap.plates.map(p=>({p,look:lookOf(p,looks)})).filter(m=>m.look);
    for(const {p,look} of marks){const b=r(p);
      out.push(`<rect x="${b.x+0.5}" y="${b.y+0.5}" width="${Math.max(0,b.w-1)}" height="${Math.max(0,b.h-1)}" fill="${FILL[look]}"/>`);}
    for(const {p} of marks){if(!snap.plan.get(p.id).steel)continue;const b=r(p);if(b.w<26||b.h<9)continue;
      out.push(`<rect x="${b.x+b.w/2-12.5}" y="${b.y+b.h/2-4.5}" width="25" height="9" fill="${COLOR.rp.bg}" fill-opacity="0.85"/><text x="${b.x+b.w/2}" y="${b.y+b.h/2+2.6}" text-anchor="middle" font-family="${FONT}" font-size="7" font-weight="600" fill="${COLOR.rp.text}">${p.id}</text>`);}
    return out.join('');
  });
}
/* the screen's legend: "보수 범위" ■■■ ■추가한 판 (보수 이력: "보수한 판" ■■■) */
const legend=snap=>{const sw=k=>`<span><i style="background:${FILL[k]}"></i>${KIND_LABEL[k]}</span>`;
  return `<div class="rp-legend"><span class="rp-lg-grp">${snap.history?'보수한 판':'보수 범위'}</span>${WORK_KINDS.map(sw).join('')}${snap.history?'':sw('added')}</div>`;};

/* 보수 물량 및 효과, the screen's cells: 강판 교체 · 재도장 · 마찰 저항 · 다음 도킹 경고 예상 (보수 이력: the first three) */
function effectRow(snap){
  const r=snap.res,c=effectCuts(snap.store,r),cmp=n=>n!=null?`<span class="rp-ef-cmp">(${num(n)}% 감소)</span>`:'';
  const cellH=(label,value,unit,side)=>`<div><small>${label}</small><b>${value}<i>${unit}</i>${side}</b></div>`;
  const cells=[cellH('강판 교체',num(r.steelN),'판',`<span class="rp-ef-sub">· ${num(r.steel,1)} t</span>`),
    cellH('재도장',num(r.repaint),'m²',`<span class="rp-ef-sub">· 도료 ${num(r.paint)} L</span>`),
    cellH('마찰 저항',num(r.friction,1),'%',cmp(c.friction))];
  if(!snap.history)cells.push(cellH('다음 도킹 경고 예상',num(r.nextWarn),'건',cmp(c.nextWarn)));
  return `<div class="rp-plan-sum" style="grid-template-columns:repeat(${cells.length},1fr)">${cells.join('')}</div>`;
}
function page1(snap){
  return `<p class="rp-plan-range">${esc(snap.name).replace(/^기준:/,'<b>기준:</b>')}</p>
    ${effectRow(snap)}
    ${box('보수 도면',drawingSvg(snap,1035,480)+legend(snap),'rp-plan-map')}
    <p class="rp-disclaim">마찰 저항 = 새 선체 대비 증가분 (Townsin 식 추정) · (N% 감소) = 보수하지 않을 때 대비${snap.history?''
      :' · 다음 도킹 경고 예상 = 지금 감소 속도로 다음 도킹에 경고 기준을 넘을 것으로 예상되는 판 수 (보수한 판은 0부터 다시 계산)'}</p>`;
}
/* 강판 목록: one table, or two side by side when long (STEEL_ROWS a column); beyond two columns the rest is in the Excel */
const STEEL_ROWS=32;
function page2(snap){
  const r=snap.res,rows=r.steelRows.map(({p})=>`<tr><td><b>${p.id}</b></td><td>${plateLoc(p)}</td><td class="n">${num(p.length,1)} × ${num(p.width,1)}</td><td class="n">${num(p.orig,1)}</td><td class="n">${num(p.weight,2)}</td></tr>`);
  const head=['판 번호','위치','#크기 (m)','#원두께 (mm)','#중량 (t)'],sum=`<tr class="rp-sum"><td>합계</td><td>${num(r.steelN)}판</td><td></td><td></td><td class="n">${num(r.steel,1)}</td></tr>`;
  const cols=rows.length>STEEL_ROWS?[rows.slice(0,STEEL_ROWS),rows.slice(STEEL_ROWS,2*STEEL_ROWS)]:[rows];
  const more=rows.length>2*STEEL_ROWS?`<p class="rp-none">외 ${num(rows.length-2*STEEL_ROWS)}판은 ${snap.docTitle}(Excel)에 있습니다.</p>`:'';
  const steel=rows.length?`<div class="rp-steel-cols">${cols.map((c,i)=>table(head,c,i===cols.length-1?sum:'','rp-steel')).join('')}</div>${more}`
    :'<p class="rp-none">이 계획에는 강판 교체·보강 판이 없습니다.</p>';
  const paint=r.paintRows.length?table(['도장 구역','작업','#면적 (m²)','도료','#필요량 (L)'],
      r.paintRows.map(x=>`<tr><td>${x.zone}</td><td>${x.work}</td><td class="n">${num(x.area)}</td><td>${x.paint}</td><td class="n">${num(x.litres)}</td></tr>`),
      `<tr class="rp-sum"><td>합계</td><td></td><td class="n">${num(r.repaint)}</td><td></td><td class="n">${num(r.paint)}</td></tr>`)
    :'<p class="rp-none">이 계획에는 도장 작업이 없습니다.</p>';
  const spec=table(['도장 구역','도료','#설계 두께 (µm)','#고형분 비율'],Object.values(PAINT_SPEC).map(s=>`<tr><td>${s.zone}</td><td>${s.paint}</td><td class="n">${num(s.dft)}</td><td class="n">${num(s.solids,2)}</td></tr>`),'');
  return `<div class="rp-plan-lists">
      ${box('강판 목록',steel)}
      <div class="rp-col">${box('도료 목록',paint+`<p class="rp-disclaim">${PAINT_FORMULA}<br>${REPAINT_RULE}</p>`)}${box('도료 사양',spec)}</div>
    </div>`;
}

export async function repairPlanPdf(state,now){
  const snap=resolve(state),S=dockContext(snap.store.dockKey),root=document.createElement('div');root.className='rp-root';
  root.innerHTML=page(1,'보수 도면',page1(snap),S,now)+page(2,'자재 목록',page2(snap),S,now);
  return pagesToPdf(root,`DR.DOCK 보수 도면 ${S.hull} ${S.dockInfo.date} ${snap.name}`);
}
