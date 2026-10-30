/* =========================================================
   진단 보고서 5장 (SPEC 6.2) — A4 가로 1123 × 794 px, 흰 바탕, 장마다 주제 하나
   1 표지·종합 진단 · 2 강판 두께 · 3 도막 두께 · 4 도막 손상 · 5 보수 계획 (레이어 순서 = criteria.LAYERS)
   판정 순서는 어디서나 최우선 보수 → 경고 → 주의 (→ 정상).
   2·3·4장 위쪽은 2 × 2 격자: 왼쪽 위 큰 전개도 · 오른쪽 위 단면 비교(4장은 구역별 표) — 아래 경계가 같다,
   왼쪽 아래 작은 3D 2개 · 오른쪽 아래 구역별 표(4장은 사진) — 위·아래 경계가 같다.
   ========================================================= */
import { LAYERS, CRITERIA, OK, WARN, CRIT, TOP, TOP_RULE, ACTION, judge, isTop, gradeOf, gradeName } from '../data/criteria.js';
import { ACTION_ORDER } from '../data/repairSteps.js';
import { LAYER_LABEL, gradeLabel, DEFECT_LABEL, recLoc, zoneLoc, thick, thickNum, drop, dropNum, ratioNum,
  lossRate, THICK, pct, num, area, areaNum, dateTime, numHtml } from '../format.js';
import { REPORT_CONST, prevOf, thickOf } from './data.js';
import { COLOR } from '../styles/tokens.js';
import { gradeIcon } from '../gradeUi.js';
const MAP_W=500,MAP_H=222;   // box content width of a half-page column
const SEC_H=170;            // 단면 비교 그림 높이: its box ends level with the S.SHELL map box beside it
import { sideShellMap, LV_FILL } from './charts.js';
import { DAMAGE_RGB } from '../heatmap.js';
import { thickness, sectionSvg, THEME } from '../sectionSvg.js';

/* locations with their numbers marked (FR 600, tabular figures) */
const ptLocH=r=>numHtml(recLoc(r)),zoneLocH=z=>numHtml(zoneLoc(z));
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
/* judgement chip: 최우선 보수 / 경고 / 주의 / 정상 — cx: 최우선 보수 (a point: isTop(r, layer), a zone: z.top) */
const chip=(l,cx,layer)=>{const g=gradeOf(l,cx);return `<span class="rp-lv rp-lv${g}">${gradeIcon(g)}${gradeLabel(l,cx,layer)}</span>`;};
import logoReport from '../assets/report_logo.png';   // the report's own logo (dark letters and magnifier, orange "OC") for the white page
const GRADES=[TOP,CRIT,WARN];   // 최우선 보수 → 경고 → 주의

function page(n,title,body,d){
  const S=d.ship,now=d.now;
  return `<section class="rp-page" data-page="${n}">
    <header class="rp-head"><div class="rp-brand"><img src="${logoReport}" alt="DR.DOCK"></div>
      <div class="rp-doc"><b>선체 외판 진단 보고서</b><span>${S.name}</span></div>
      <div class="rp-ch"><i>${n}</i><b>${title}</b>${d.chNote&&d.chNote[n]?`<small>${d.chNote[n]}</small>`:''}</div></header>
    <div class="rp-body">${body}</div>
    <footer class="rp-foot"><span>${S.docking}${S.dock?`·${S.dock}`:''}</span><span>생성 ${dateTime(now)}</span><b>${n} / 5</b></footer>
  </section>`;
}
const box=(title,inner,cls='')=>`<section class="rp-box ${cls}"><h3>${title}</h3>${inner}</section>`;
/* 표: 단위는 열 제목 괄호 안 (면적 (m²)) 또는 모든 열이 같으면 표 제목 (구역별 보수 물량 (건)), 칸에는 숫자만.
   '#' = 숫자 열 (오른쪽 정렬) */
const table=(head,rows,cls='')=>`<table class="rp-tbl ${cls}"><thead><tr>${head.map(h=>`<th${h.startsWith('#')?' class="n"':''}>${h.replace(/^#/,'')}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
/* a number cell ('n') that shows 0 (0, 0.0, −0) is written as — in every table */
const DASH='<span class="rp-dash">—</span>',isZero=v=>/^[−-]?0(\.0+)?$/.test(String(v).trim());
const td=(v,cls='')=>`<td${cls?` class="${cls}"`:''}>${cls.split(' ').includes('n')&&isZero(v)?DASH:v}</td>`;
const views=(imgs,key,cls='')=>`<div class="rp-3d2 ${cls}"><figure><img src="${imgs[key+'_iso']}" alt=""><figcaption>우현 ISO</figcaption></figure><figure><img src="${imgs[key+'_bottom']}" alt=""><figcaption>선저</figcaption></figure></div>`;
const legend=(items)=>`<div class="rp-legend">${items.map(([c,t,shape])=>`<span><i class="${shape||''}" style="${shape?`border-color:${c}`:`background:${c}`}"></i>${t}</span>`).join('')}</div>`;
const sub=t=>`<small>${t}</small>`;   // a box title's note (기준 …)
const pctR=x=>Math.round(x*100);       // 0.2 → 20 (criteria as whole percents)
const pctNum=x=>num(x,1);              // a % value in a table cell (the unit is in the column title)

/* ---------- 1. cover · overall ---------- */
function page1(d,imgs){
  // the dashboard's KPI counts per layer (repair zones): 최우선 보수 · 경고 · 주의 (도막 손상: 최우선 보수 · 도막 떨어짐 · 스크래치)
  const cards=LAYERS.map(l=>{const L=d.layers[l],c=L.counts;
    return `<div class="rp-card"><h3>${LAYER_LABEL[l]}<small>보수 대상 ${num(L.total)}건</small></h3>
      <div class="rp-cnt">${GRADES.map(g=>`<span class="g${g}"><small>${gradeIcon(g)}${gradeName(g,l)}</small><b>${num(c[g])}<i>건</i></b></span>`).join('')}</div>
      <p class="rp-worst">${L.worst.label} <b>${L.worst.value}</b><small>${esc(L.worst.where)}</small></p></div>`;}).join('');
  const cv=d.coverage;
  const S=d.ship;
  return `<div class="rp-cover"><div><h1>선체 외판 진단 보고서</h1><p>${S.name}</p></div>
      <dl><dt>도킹</dt><dd>${S.docking}</dd>${S.dock?`<dt>도크</dt><dd>${S.dock}</dd>`:''}<dt>측정 로봇</dt><dd>${S.robot}</dd>
        <dt>${S.prevDock.name}</dt><dd>${S.prevDock.date}</dd><dt>작성 일시</dt><dd>${dateTime(d.now)}</dd></dl></div>
    <div class="rp-verdict"><small>종합 판정</small><b>최우선 보수 ${d.headline.top}건·강판 교체·보강 ${num(d.headline.steel)}판·재도장 ${area(d.headline.repaint)}</b></div>
    <div class="rp-p1">
      <div class="rp-cards">${cards}</div>
      <figure class="rp-big3d"><img src="${imgs.all_iso}" alt="">
        <figcaption><b>종합 위험도</b>
          <span class="rp-ramp"><i></i>주의 → 경고</span></figcaption></figure>
    </div>
    <div class="rp-p1b">
      ${box('주요 발견',`<ol class="rp-find">${d.findings.map(f=>`<li>${esc(f)}</li>`).join('')}</ol>`)}
      ${box('측정 범위',`<dl class="rp-kv"><dt>측정 면적</dt><dd>${area(cv.measuredArea)} <small>(전체 외판 ${area(cv.shellArea)}의 ${pct(cv.ratio)})</small></dd>
        <dt>측정 불가</dt><dd>${area(cv.blockedArea)} <small>(킬 블록 접촉면)</small></dd></dl>`)}
    </div>`;
}

/* ---------- 2. plate thickness · 3. coating thickness (same layout) ---------- */
/* 감소율 상위 3건: one section per place — the 1차 (or 신조) value → now, the reduction against the reference */
function sections(d,layer){
  return d[layer].top3.map((r,i)=>{const l=judge(r,layer).level,prev=prevOf(r,layer),cur=thickOf(r,layer);
    return `<figure class="rp-sec">${sectionSvg(thickness(r,layer),l,150,SEC_H,THEME.light,1,{minK:0.8,dims:['cur']})}<figcaption><b>${i+1}</b> ${ptLocH(r)}<br>${thick(prev,layer)} → ${thick(cur,layer)} (${drop(prev,cur,layer)})<br>감소율 ${pct(lossRate(r,layer))} ${chip(l,isTop(r,layer))}</figcaption></figure>`;}).join('');
}
/* 구역별: fixed rows (선저 … 선미), counts = the dashboard's repair zones in that area */
function areaTable(d,layer){
  const dash=DASH;
  return table(['구역','#평균 감소율 (%)','#최대 감소율 (%)',...GRADES.map(g=>`#${gradeName(g)} (건)`)],
    d[layer].zones.map(z=>`<tr>${td(z.zone)}${td(z.n?pctNum(z.avg):dash,'n')}${td(z.n?pctNum(z.max):dash,'n')}${td(z.n?num(z.top):dash,'n')}${td(z.n?num(z.crit):dash,'n')}${td(z.n?num(z.warn):dash,'n')}</tr>`),'rp-area');
}
/* 감소율 상위 5건: repair zones by 설계(도막) / 원두께(강판) 대비 감소율, largest first — no judgement or action columns.
   강판·도막 the same columns and names (only the unit differs; which 기준 is in the box title) */
function topDropTable(d,layer){
  const T=THICK[layer],since=d.ship.prevDock.key==='newbuild'?d.ship.prevDock.name:'직전 리도킹';
  const rows=d[layer].top5.map(({z,r,prev,cur,rate},i)=>`<tr>${td(i+1,'n')}${td(zoneLocH(z))}
    ${td(`${thickNum(cur,layer)} / ${thickNum(layer==='plate'?r.plateOrig:r.dftDesign,layer)}`,'n')}${td(pctNum(lossRate(r,layer)),'n')}
    ${td(dropNum(prev,cur,layer),'n')}${td(num(rate,layer==='plate'?2:0),'n')}</tr>`);
  return table(['#순위','위치',`#현재 / 기준 (${T.unit})`,'#감소율 (%)',`#${since} 대비 (${T.unit})`,`#연간 감소 속도 (${T.unit}/년)`],rows,'rp-prio');
}
function thicknessPage(d,imgs,layer){
  const ref=layer==='plate'?'원두께 기준':'설계 기준';
  // legend: swatch and name only (경고 · 주의 · 정상) — the thresholds are in 5장 판정 기준
  const lg=[[LV_FILL[CRIT],gradeName(CRIT)],[LV_FILL[WARN],gradeName(WARN)],[COLOR.rp.normalFill,gradeName(OK)]];
  return `<div class="rp-dist">
      ${box(`위치 분포${sub(ref)}`,sideShellMap(d.records,layer,MAP_W,MAP_H)+legend(lg))}
      ${box('감소율 상위 3건 단면 비교',`<div class="rp-secs">${sections(d,layer)}</div>`)}
      ${views(imgs,layer)}
      ${box('구역별',areaTable(d,layer))}
    </div>
    ${box(`감소율 상위 5건${sub(ref)}`,topDropTable(d,layer))}`;
}

/* ---------- 4. coating damage ---------- */
function page4(d,imgs){
  // 최우선 보수 → 도막 떨어짐 → 스크래치 (repair zones, as the dashboard counts them)
  const keys=['tN','tA','fN','fA','sN','sA'],z=d.defect.zones,tot=Object.fromEntries(keys.map(k=>[k,z.reduce((a,r)=>a+r[k],0)]));
  const row=(name,r,cls='')=>`<tr class="${cls}">${td(name)}${td(r.tN,'n')}${td(areaNum(r.tA),'n')}${td(r.fN,'n')}${td(areaNum(r.fA),'n')}${td(r.sN,'n')}${td(areaNum(r.sA),'n')}${td(r.tN+r.fN+r.sN,'n')}</tr>`;
  const agg=table(['구역',...GRADES.flatMap(g=>[`#${gradeName(g,'defect')} (건)`,'#면적 (m²)']),'#합계 (건)'],[...z.map(r=>row(r.zone,r)),row('합계',tot,'rp-sum')]);
  // the damage paint colours (heatmap.DAMAGE_RGB): 최우선 보수 · 도막 떨어짐 · 스크래치, then the measured normal shell
  const dmgLegend=legend([...GRADES.map(g=>[`rgb(${DAMAGE_RGB[g].join(',')})`,gradeName(g,'defect')]),[COLOR.rp.normalFill,'정상']]);
  const photos=Array.from({length:6},(_,i)=>{const r=d.defect.photos[i];if(!r)return '<figure class="rp-ph empty"><div>—</div></figure>';
    const l=judge(r,'defect').level;
    return `<figure class="rp-ph">${r.photo?`<img src="${esc(r.photo)}" alt="">`:'<div class="rp-nophoto">사진 없음</div>'}
      <figcaption><span>${ptLocH(r)}</span><span>${area(r.defectArea)} ${chip(l,isTop(r,'defect'),'defect')}</span></figcaption></figure>`;}).join('');
  return `<div class="rp-dist">
      ${box('위치 분포',sideShellMap(d.records,'defect',MAP_W,MAP_H)+dmgLegend)}
      ${box('구역별',agg)}
      ${views(imgs,'defect','rp-stack')}
      ${box('대표 손상 사진·급한 순',`<div class="rp-phs">${photos}</div>`)}
    </div>`;
}

/* ---------- 5. repair plan ---------- */
/* 다음 도킹 관찰 권고: the first WATCH_SHOW zones (furthest past the 경고 limit first, no action — they are to be watched);
   the current judgement of all of them goes in the sentence above the table (주의 39건·정상 6건) */
const WATCH_SHOW=4;
const WATCH_ITEM={plate:'강판',dft:'도막',defect:DEFECT_LABEL.flaking};
const watchRows=pr=>pr.slice(0,WATCH_SHOW).map(x=>`<tr>${td(zoneLocH(x.z))}${td(WATCH_ITEM[x.layer])}`
  +`${td(x.layer==='defect'?DASH:pctNum(lossRate(x.r,x.layer)),'n')}${td(x.pred==null?DASH:ratioNum(x.pred),'n')}</tr>`);
function watchMix(pr){
  return [...GRADES,OK].map(g=>[g,pr.filter(x=>Math.min(x.grade,TOP)===g).length]).filter(([,n])=>n).map(([g,n])=>`${gradeName(g)} ${num(n)}건`).join('·');
}
function page5(d){
  const C=REPORT_CONST,rp=d.repair,e=d.effect;
  /* KPI 카드 두 줄 (줄 이름 위, 안내 줄 아래):
     보수 효과 (estimates, private/보수효과_시안_v3.png) — 제목과 현재 → 보수 후 두 숫자, 보수 후는 초록 (보수 후 = 권장 보수, 보수 범위 3단계)
     보수 물량 — 제목과 필요한 양 하나 (굵게, 초록 없음) · 두 줄 모두 같은 3칸 */
  const big=(n,u)=>`${n}<i>${u}</i>`;
  const kpi=(title,now,after,note='')=>`<div class="rp-eff-c"><small>${title}</small>
      <p><span>${now}</span><i>→</i><b class="good">${after}</b></p>${note?`<span class="rp-eff-n">${note}</span>`:''}</div>`;
  const qty=(title,value)=>`<div class="rp-eff-c"><small>${title}</small><p><b>${value}</b></p></div>`;
  const kpis=`<div class="rp-kpis">
      <p class="rp-kpi-h">보수 효과</p>
      ${kpi('외판 두께 잔존율',pct(e.remain.now),big(num(e.remain.after,1),'%'))}
      ${kpi('허용 마모 초과 면적',area(e.worn.now),e.worn.after?`≈ ${big(areaNum(e.worn.after),'m²')}`:big('0','m²'))}
      ${kpi('마찰 저항',pct(e.friction.now),big(num(e.friction.after,1),'%'),'새 선체 대비 증가분')}
      <p class="rp-kpi-h">보수 물량</p>
      ${qty('재도장 면적',`≈ ${big(areaNum(rp.repaintArea),'m²')}`)}
      ${qty('도료 예상 물량',big(num(rp.paintL),'L'))}
      ${qty('강판 교체 중량',big(num(rp.steelT,1),'t'))}
      <p class="rp-eff-foot">현재 → 보수 후·추정값(Townsin 식)</p>
    </div>`;
  // 구역별 보수 물량: rows 선저 … 선미 + 합계, zones counted by action (ACTION_ORDER, heaviest first) — one count per place; 0 → —
  const qtyRow=(name,n,cls='')=>`<tr class="${cls}">${td(name)}${n.map(x=>td(num(x),'n')).join('')}</tr>`;
  const tot=ACTION_ORDER.map((_,i)=>rp.byZone.reduce((s,z)=>s+z.n[i],0));
  const list=table(['구역',...ACTION_ORDER.map(a=>`#${a}`)],[...rp.byZone.map(z=>qtyRow(z.zone,z.n)),qtyRow('합계',tot,'rp-sum')],'rp-qty-t');
  // 다음 도킹 관찰 권고: zones still crossing the 경고 limit at the next docking after the 권장 보수 (= 보수 계획 3단계 "다음 도킹 경고 예상")
  const pr=d.plate.predicted;
  const watch=pr.length?`<p>권장 보수 후에도 지금의 감소 속도가 이어지면 다음 도킹(${d.ship.next}, ${C.yearsToNext}년 후)에 <b>${num(pr.length)}건</b>(현재 ${watchMix(pr)})이 경고 기준(강판 감소율 ${pctR(CRITERIA.plate.crit)}%·도막 감소율 ${pctR(CRITERIA.dft.crit)}% 이상)을 넘을 것으로 예측됩니다.</p>
      ${table(['위치','항목','#현재 감소율 (%)','#예상 감소율 (%)'],watchRows(pr),'rp-watch-t')}`
    :'<p>권장 보수 후에는 지금 속도로 다음 도킹까지 경고 기준을 넘을 곳이 없습니다.</p>';
  const crit=CRITERIA,dc=crit.dft,pc=crit.plate;
  // 최우선 보수 does not fit the 경고·주의·정상 columns: its rule sits between the box title and the table
  const topRule=`<div class="rp-toprule"><b>${gradeIcon(TOP)}${gradeName(TOP)}</b><p>${TOP_RULE.coat}<br>또는 ${TOP_RULE.defect} (세 레이어 공통)</p></div>`;
  const ctab=table(['항목','경고','주의','정상'],[
    `<tr>${td('강판 감소율 (원두께 기준)')}${td(`${pctR(pc.crit)}% 이상`)}${td(`${pctR(pc.warn)}% 이상 ${pctR(pc.crit)}% 미만`)}${td(`${pctR(pc.warn)}% 미만`)}</tr>`,
    `<tr>${td('도막 감소율 (설계 기준)')}${td(`${pctR(dc.crit)}% 이상`)}${td(`${pctR(dc.warn)}% 이상 ${pctR(dc.crit)}% 미만`)}${td(`${pctR(dc.warn)}% 미만`)}</tr>`,
    `<tr>${td('도막 손상')}${td(`${DEFECT_LABEL.flaking} → ${ACTION.repaint}`)}${td(`${DEFECT_LABEL.scratch} → ${ACTION.touchUp}`)}${td('없음')}</tr>`],'rp-crit');
  return `${kpis}
    ${box('구역별 보수 물량 (건)',list)}
    <div class="rp-grid2 rp-tight">${box('다음 도킹 관찰 권고',`<div class="rp-watch">${watch}</div>`)}
      ${box('판정 기준',`${topRule}${ctab}<p class="rp-disclaim">판정 기준은 표준 가정값이며, 보수 효과 지표는 추정값입니다. 실제 구조 강도는 선급 계산이 필요합니다.</p>`)}</div>`;
}

/* 5장 is fixed to 권장 보수 (range level 3, SPEC 12.8) — not linked to the 보수 계획 screen */
const CH_NOTE={5:'기준: 권장 보수'};
export function pagesHtml(d,imgs){
  d={...d,chNote:CH_NOTE};
  return [page(1,'표지·종합 진단',page1(d,imgs),d),page(2,'강판 두께',thicknessPage(d,imgs,'plate'),d),page(3,'도막 두께',thicknessPage(d,imgs,'dft'),d),
    page(4,'도막 손상',page4(d,imgs),d),page(5,'보수 계획',page5(d),d)].join('');
}
