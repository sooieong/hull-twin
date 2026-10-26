/* =========================================================
   진단 보고서 5장 (SPEC 6.2) — A4 가로 1123 × 794 px, 흰 바탕, 장마다 주제 하나
   1 표지·종합 진단 · 2 도막 두께 · 3 강판 두께 · 4 도막 손상 · 5 보수 계획
   ========================================================= */
import { CRITERIA, OK, WARN, CRIT, judge } from '../data/criteria.js';
import { LAYER_LABEL, LEVEL_LABEL, DEFECT_LABEL, value, recLoc, zoneLoc, thick, thickNum, drop, designRatio, lossRatio, ratio,
  pct, num, area, areaNum, dateTime } from '../format.js';
import { SHIP, REPORT_CONST } from './data.js';
const MAP_W=500,MAP_H=236;   // box content width of a half-page column
import { sideShellMap, histogram, ratioBar, LV_FILL } from './charts.js';
import { thickness, sectionSvg, THEME } from '../sectionSvg.js';

const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const chip=l=>`<span class="rp-lv rp-lv${l}">${LEVEL_LABEL[l]}</span>`;
const LOGO='<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M2 19h28l-4.5 7.5H7.5z" fill="#F37321"/><path d="M7 19v-8h6v8M15.5 19v-4.5h11V19" fill="none" stroke="#3A4252" stroke-width="1.6"/><path d="M9.5 11V6.5" stroke="#F37321" stroke-width="1.6"/></svg>';
const TYPE={dft:'도막',plate:'강판',defect:'손상'};

function page(n,title,body,now){
  return `<section class="rp-page" data-page="${n}">
    <header class="rp-head"><div class="rp-brand">${LOGO}<span>Dr.Dock</span></div>
      <div class="rp-doc"><b>선체 외판 진단 보고서</b><span>${SHIP.name} · ${SHIP.hull}</span></div>
      <div class="rp-ch"><i>${n}</i><b>${title}</b></div></header>
    <div class="rp-body">${body}</div>
    <footer class="rp-foot"><span>${SHIP.docking} · ${SHIP.dock}</span><span>생성 ${dateTime(now)}</span><span>판정 기준은 예시값입니다</span><b>${n} / 5</b></footer>
  </section>`;
}
const box=(title,inner,cls='')=>`<section class="rp-box ${cls}"><h3>${title}</h3>${inner}</section>`;
const table=(head,rows,cls='')=>`<table class="rp-tbl ${cls}"><thead><tr>${head.map(h=>`<th${h.startsWith('#')?' class="n"':''}>${h.replace(/^#/,'')}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
const td=(v,cls='')=>`<td${cls?` class="${cls}"`:''}>${v}</td>`;
const views=(imgs,key)=>`<div class="rp-3d2"><figure><img src="${imgs[key+'_iso']}" alt=""><figcaption>우현 ISO</figcaption></figure><figure><img src="${imgs[key+'_bottom']}" alt=""><figcaption>선저</figcaption></figure></div>`;
const legend=(items)=>`<div class="rp-legend">${items.map(([c,t,shape])=>`<span><i class="${shape||''}" style="${shape?`border-color:${c}`:`background:${c}`}"></i>${t}</span>`).join('')}</div>`;

/* ---------- 1. cover · overall ---------- */
function page1(d,imgs){
  const cards=['dft','plate','defect'].map(l=>{const L=d.layers[l],c=L.counts,t=L.total||1;
    return `<div class="rp-card"><h3>${LAYER_LABEL[l]}</h3>
      <div class="rp-cnt">${c.map((v,i)=>`<span><small>${LEVEL_LABEL[i]}</small><b>${num(v)}</b></span>`).join('')}</div>
      ${ratioBar(c,308,12)}<div class="rp-pcts">${c.map(v=>pct(v/t*100)).join('<span>·</span>')}</div>
      <p class="rp-worst">${L.worst.label} <b>${L.worst.value}</b><small>${esc(L.worst.where)}</small></p></div>`;}).join('');
  const cv=d.coverage;
  return `<div class="rp-cover"><div><h1>선체 외판 진단 보고서</h1><p>${SHIP.name} · ${SHIP.hull}</p></div>
      <dl><dt>도킹</dt><dd>${SHIP.docking}</dd><dt>도크</dt><dd>${SHIP.dock}</dd><dt>측정 로봇</dt><dd>${SHIP.robot}</dd>
        <dt>이전 도킹</dt><dd>${SHIP.prevDock}</dd><dt>작성 일시</dt><dd>${dateTime(d.now)}</dd></dl></div>
    <div class="rp-verdict"><small>종합 판정</small><b>최우선 보수 ${d.headline.top}구역 · 강판 교체·보강 ${d.headline.steel}구역 · 재도장 ${area(d.headline.repaint)}</b></div>
    <div class="rp-p1">
      <div class="rp-cards">${cards}</div>
      <figure class="rp-big3d"><img src="${imgs.all_iso}" alt="">
        <figcaption><b>종합 위험도</b> · 도막·강판·손상 중 가장 나쁜 판정 · 우현 ISO
          <span class="rp-ramp"><i></i>주의 → 심각</span></figcaption></figure>
    </div>
    <div class="rp-p1b">
      ${box('주요 발견',`<ol class="rp-find">${d.findings.map(f=>`<li>${esc(f)}</li>`).join('')}</ol>`)}
      ${box('측정 범위',`<dl class="rp-kv"><dt>측정 면적</dt><dd>${area(cv.measuredArea)} <small>(전체 외판 ${area(cv.shellArea)}의 ${pct(cv.ratio)})</small></dd>
        <dt>측정점</dt><dd>${num(cv.points)}점 <small>/ 계획 ${num(cv.planned)}점</small></dd>
        <dt>측정 불가</dt><dd>${num(cv.blocked)}점 · ${area(cv.blockedArea)} <small>(킬 블록 접촉면)</small></dd></dl>`)}
    </div>`;
}

/* ---------- 2. coating thickness ---------- */
function page2(d,imgs){
  const c=CRITERIA.dft;
  const hist=histogram(d.dft.values,{W:MAP_W,H:196,min:0,max:120,step:5,xLabel:'설계 대비 도막 두께 (%)',
    thresholds:[{v:c.crit*100,label:`심각 ${c.crit*100}%`,color:LV_FILL[2]},{v:c.warn*100,label:`주의 ${c.warn*100}%`,color:'#B87400'}],
    bandOf:v=>v<c.crit*100?CRIT:v<c.warn*100?WARN:OK});
  const zt=table(['구역','#평균','#최소','#주의','#심각','#재도장 대상 (m²)'],d.dft.zones.map(z=>`<tr>${td(z.zone)}${td(pct(z.avg),'n')}${td(ratio(z.min/100),'n')}${td(z.warn,'n')}${td(z.crit,'n')}${td(areaNum(z.area),'n')}</tr>`));
  const thin=table(['#순위','위치','#현재 / 설계 (µm)','#설계 대비','판정'],d.dft.thinnest.map((r,i)=>{const l=judge(r,'dft').level;
    return `<tr>${td(i+1,'n')}${td(recLoc(r))}${td(`${thickNum(r.dft,'dft')} / ${thickNum(r.dftDesign,'dft')}`,'n m')}${td(designRatio(r),'n m')}${td(chip(l))}</tr>`;}));
  return `<div class="rp-grid2">
      <div class="rp-col">${box('Side Shell 전개도 · 설계 대비 도막 두께',sideShellMap(d.records,'dft',MAP_W,MAP_H)+legend([['#DCE1E8','정상'],[LV_FILL[1],`주의 · ${c.warn*100}% 미만`],[LV_FILL[2],`심각 · ${c.crit*100}% 미만`]]))}
        ${views(imgs,'dft')}</div>
      <div class="rp-col">${box('분포 · 설계 대비 %',hist)}${box('구역별',zt)}</div>
    </div>
    ${box('가장 얇은 5곳',thin)}`;
}

/* ---------- 3. plate thickness ---------- */
function page3(d,imgs){
  const c=CRITERIA.plate,yrs=REPORT_CONST.yearsToNext;
  const secs=d.plate.top3.map((r,i)=>{const l=judge(r,'plate').level;
    return `<figure class="rp-sec">${sectionSvg(thickness(r,'plate'),l,160,124,THEME.light,1,{note:false})}<figcaption><b>${i+1}</b> ${esc(recLoc(r))}<br>${thick(r.platePrev,'plate')} → ${thick(r.plate,'plate')} (${drop(r.platePrev,r.plate,'plate')}) · 감소율 ${lossRatio(r)} ${chip(l)}</figcaption></figure>`;}).join('');
  const zt=table(['구역','#평균 감소율','#최대 감소율','#주의','#심각'],d.plate.zones.map(z=>`<tr>${td(z.zone)}${td(pct(z.avg),'n')}${td(ratio(z.max/100),'n')}${td(z.warn,'n')}${td(z.crit,'n')}</tr>`));
  const fast=table(['위치','#이전 → 현재 (mm)','#연간 감소','#현재 감소율'],d.plate.fastest.map(x=>`<tr>${td(recLoc(x.r))}${td(`${thickNum(x.r.platePrev,'plate')} → ${thickNum(x.r.plate,'plate')}`,'n m')}${td(`${num(x.rate,2)} mm/년`,'n m')}${td(lossRatio(x.r),'n m')}</tr>`));
  const pr=d.plate.predicted;
  const pred=pr.length?table(['위치','#현재 감소율','#예상 감소율','현재'],pr.slice(0,5).map(x=>`<tr>${td(recLoc(x.r))}${td(lossRatio(x.r),'n m')}${td(ratio(x.pred),'n m')}${td(chip(judge(x.r,'plate').level))}</tr>`))
    :'<p class="rp-none">지금 속도로는 다음 도킹까지 심각 등급에 도달할 곳이 없습니다.</p>';
  return `<div class="rp-grid2">
      <div class="rp-col">${box('Side Shell 전개도 · 원두께 대비 감소율',sideShellMap(d.records,'plate',MAP_W,MAP_H)+legend([['#DCE1E8','정상'],[LV_FILL[1],`주의 · ${c.warn*100}% 이상`],[LV_FILL[2],`심각 · ${c.crit*100}% 이상`]]))}
        ${views(imgs,'plate')}</div>
      <div class="rp-col">${box('감소율 상위 3곳 · 단면 비교',`<div class="rp-secs">${secs}</div>`)}${box('구역별',zt)}</div>
    </div>
    <div class="rp-grid2 rp-tight">${box('감소 속도 상위 5곳 · 이전 도킹 대비',fast)}${box(`다음 도킹(${yrs}년 후) 심각 도달 예상 · ${pr.length}곳`,pred)}</div>`;
}

/* ---------- 4. coating damage ---------- */
function page4(d,imgs){
  const z=d.defect.zones,tot=z.reduce((a,r)=>({fN:a.fN+r.fN,fA:a.fA+r.fA,sN:a.sN+r.sN,sA:a.sA+r.sA}),{fN:0,fA:0,sN:0,sA:0});
  const row=(name,r,cls='')=>`<tr class="${cls}">${td(name)}${td(r.fN,'n')}${td(areaNum(r.fA),'n')}${td(r.sN,'n')}${td(areaNum(r.sA),'n')}${td(r.fN+r.sN,'n')}</tr>`;
  const agg=table(['구역',`#${DEFECT_LABEL.flaking} (건)`,'#면적 (m²)',`#${DEFECT_LABEL.scratch} (건)`,'#면적 (m²)','#합계 (건)'],[...z.map(r=>row(r.zone,r)),row('합계',tot,'rp-sum')]);
  const photos=Array.from({length:6},(_,i)=>{const r=d.defect.photos[i];if(!r)return '<figure class="rp-ph empty"><div>—</div></figure>';
    const l=judge(r,'defect').level;
    return `<figure class="rp-ph">${r.photo?`<img src="${esc(r.photo)}" alt="">`:'<div class="rp-nophoto">사진 없음</div>'}
      <figcaption><span>${esc(recLoc(r))}</span><span>${DEFECT_LABEL[r.defect]} · ${area(r.defectArea)} ${chip(l)}</span></figcaption></figure>`;}).join('');
  return `<div class="rp-grid2">
      <div class="rp-col">${box('Side Shell 전개도 · 손상 위치',sideShellMap(d.records,'defect',MAP_W,MAP_H,'markers')+legend([[LV_FILL[2],DEFECT_LABEL.flaking,'dot'],[LV_FILL[1],DEFECT_LABEL.scratch,'dia']]))}
        ${views(imgs,'defect')}</div>
      <div class="rp-col">${box(`종류별 · 구역별 · 총 ${d.defect.count}건`,agg)}${box('대표 손상 사진 · 심각한 순',`<div class="rp-phs">${photos}</div>`)}</div>
    </div>`;
}

/* ---------- 5. repair plan ---------- */
function page5(d){
  const C=REPORT_CONST,rp=d.repair;
  const rows=rp.zones.map((z,i)=>`<tr class="${z.compound?'rp-cx':''}">${td(i+1,'n')}${td(esc(zoneLoc(z)))}${td(z.types.map(t=>`<span class="rp-tag">${TYPE[t]}</span>`).join(''))}
    ${td(esc(value(z.worst,z.primary)),z.primary==='defect'?'':'m')}${td(chip(z.level))}${td(esc(z.action))}${td(areaNum(z.area),'n')}</tr>`);
  const list=table(['#순위','위치 (FR · 외판열 · 현측 · 구역)','이상 항목','측정값 / 기준값','판정','권장 조치','#대상 면적 (m²)'],rows,'rp-plan');
  const pr=d.plate.predicted;
  const watch=pr.length?`<p>지금의 감소 속도가 이어지면 다음 도킹(${C.yearsToNext}년 후)에 <b>${pr.length}곳</b>이 심각 등급(감소율 ${CRITERIA.plate.crit*100}% 이상)에 도달할 것으로 예상됩니다.</p>
      <ul>${pr.slice(0,3).map(x=>`<li>${esc(recLoc(x.r))} — 현재 ${lossRatio(x.r)} → 예상 ${ratio(x.pred)}</li>`).join('')}</ul>`
    :'<p>지금 속도로는 다음 도킹까지 심각 등급에 도달할 곳이 없습니다.</p>';
  const crit=CRITERIA;
  const ctab=table(['항목','정상','주의','심각'],[
    `<tr>${td('도막 두께 (현재 / 설계)')}${td(`${crit.dft.warn*100}% 이상`)}${td(`${crit.dft.crit*100}% 이상 ${crit.dft.warn*100}% 미만`)}${td(`${crit.dft.crit*100}% 미만`)}</tr>`,
    `<tr>${td('강판 감소율 (원두께 대비)')}${td(`${crit.plate.warn*100}% 미만`)}${td(`${crit.plate.warn*100}% 이상 ${crit.plate.crit*100}% 미만`)}${td(`${crit.plate.crit*100}% 이상`)}</tr>`,
    `<tr>${td('도막 손상')}${td('없음')}${td(DEFECT_LABEL.scratch)}${td(`${DEFECT_LABEL.flaking}, 또는 면적 ${crit.defect.critArea} m² 이상`)}</tr>`],'rp-crit');
  return `${box(`보수 대상 상위 ${rp.zones.length}구역 · 전체 ${rp.all.length}구역 중`,list)}
    <div class="rp-qty">
      <div><small>재도장 면적</small><b>≈ ${areaNum(rp.repaintArea)}<i>m²</i></b><span>도막 두께·손상 심각 측정점 기준</span></div>
      <div><small>도료 예상 물량</small><b>${num(rp.paintL)}<i>L</i></b><span>면적 × 설계 두께 ÷ 고형분 ${C.solids*100}%</span></div>
      <div><small>강판 교체·보강</small><b>${rp.steel.count}<i>구역</i></b><span>${area(rp.steel.area)}</span></div>
      <div><small>국부 보수</small><b>${rp.local}<i>건</i></b><span>주의 단계 구역</span></div>
    </div>
    <div class="rp-grid2 rp-tight">${box('다음 도킹 관찰 권고',`<div class="rp-watch">${watch}</div>`)}${box('판정 기준 (SPEC 3.3, 예시값)',ctab)}</div>`;
}

export function pagesHtml(d,imgs){
  return [page(1,'표지 · 종합 진단',page1(d,imgs),d.now),page(2,'도막 두께',page2(d,imgs),d.now),page(3,'강판 두께',page3(d,imgs),d.now),
    page(4,'도막 손상',page4(d,imgs),d.now),page(5,'보수 계획',page5(d),d.now)].join('');
}
