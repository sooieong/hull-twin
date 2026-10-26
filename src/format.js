/* =========================================================
   표시 형식: 목록·상세·3D 툴팁·외판 전개도·KPI 타일·상태바·보고서가 모두 이 함수만 쓴다.
   - 위치: FR 261 · B · 좌현 (현측은 좌현/우현, P/S 표기는 쓰지 않는다)
   - 좌표: X 154.70 · Y −21.84 · Z 1.92 m (소수 둘째 자리, 음수는 −)
   - 두께: 도막 정수 µm (215 µm), 강판 소수 첫째 자리 mm (12.4 mm)
   - 감소량: 부호 포함 (−253 µm, −2.2 mm) · 비율: 소수 첫째 자리 % (22.5%)
   - 면적: ≈ 18 m² (1 m² 미만은 소수 첫째 자리)
   - 숫자와 단위 사이는 한 칸, %만 붙여 쓴다. 천 단위 쉼표.
   - 날짜 2026.10.26 · 시각 14:05
   - 용어(판정·권장 조치·구역·손상 종류·레이어)는 정의된 곳의 값을 그대로 다시 내보낸다.
   ========================================================= */
import { dftRatio, plateLoss, LEVEL_LABEL, ACTION, DEFECT_LABEL, LAYER_LABEL } from './data/criteria.js';
import { ZONES } from './hull.js';

export { LEVEL_LABEL, ACTION, DEFECT_LABEL, LAYER_LABEL, ZONES };

export const MINUS='−';
const NF=[0,1,2].map(dp=>new Intl.NumberFormat('en-US',{minimumFractionDigits:dp,maximumFractionDigits:dp}));

/* number with thousands commas, typographic minus; −0 shows as 0 */
export function num(v,dp=0){const s=NF[dp].format(Math.abs(v));return v<0&&/[1-9]/.test(s)?MINUS+s:s;}
/* always signed (−/+), zero unsigned */
export function signed(v,dp=0){const s=NF[dp].format(Math.abs(v));return /[1-9]/.test(s)?(v<0?MINUS:'+')+s:s;}
export const pct=(v,dp=1)=>`${num(v,dp)}%`;   // v already in percent
const floor1=x=>Math.floor(x*10+1e-9)/10;

/* ---------- location ---------- */
export const SIDE_LABEL={S:'우현',P:'좌현',PS:'좌우현'};
export const side=s=>SIDE_LABEL[s]||s;
export const span=(a,b)=>a===b?String(a):`${a}–${b}`;
export const loc=(fr,strake,sd)=>`FR ${fr} · ${strake} · ${side(sd)}`;
export const recLoc=r=>loc(r.fr,r.strake,r.side);
export const recLocZone=r=>`${recLoc(r)} · ${r.zone}`;
/* repair zone: FR 120–126 · B–C · 좌현 */
export const zoneLoc=z=>loc(span(z.frMin,z.frMax),span(z.strakeMin,z.strakeMax),z.side);
export const zoneLocZone=z=>`${zoneLoc(z)} · ${z.zone}`;
export const coords=(X,Y,Z)=>`X ${num(X,2)} · Y ${num(Y,2)} · Z ${num(Z,2)} m`;
export const metres=(v,dp=2)=>`${num(v,dp)} m`;

/* ---------- thickness, reduction, ratio ---------- */
export const THICK={dft:{unit:'µm',dp:0,ref:'설계'},plate:{unit:'mm',dp:1,ref:'원두께'}};
export const thickNum=(v,layer)=>num(v,THICK[layer].dp);
export const thick=(v,layer)=>`${thickNum(v,layer)} ${THICK[layer].unit}`;
export const dropNum=(prev,cur,layer)=>signed(+(cur-prev).toFixed(THICK[layer].dp),THICK[layer].dp);
export const drop=(prev,cur,layer)=>`${dropNum(prev,cur,layer)} ${THICK[layer].unit}`;
/* ratios compared with the criteria are rounded down, so 79.96% never shows as "80.0%" next to a "below 80%" judgement */
export const designRatio=r=>pct(floor1(dftRatio(r)*100));   // current / design
export const lossRatio=r=>pct(floor1(plateLoss(r)*100));    // loss / original
export const ratio=x=>pct(floor1(x*100));                    // any 0–1 ratio judged the same way

/* ---------- area ---------- */
export const areaNum=a=>num(a,a>0&&a<1?1:0);
export const area=a=>`≈ ${areaNum(a)} m²`;

/* ---------- measurement value / reference, per layer ---------- */
export function value(r,layer){
  if(layer==='dft')return `${thickNum(r.dft,'dft')} / ${thick(r.dftDesign,'dft')} (${designRatio(r)})`;
  if(layer==='plate')return `${thickNum(r.plate,'plate')} / ${thick(r.plateOrig,'plate')} (감소 ${lossRatio(r)})`;
  return r.defect?`${DEFECT_LABEL[r.defect]} ${area(r.defectArea)}`:'손상 없음';
}

/* ---------- progress, date, time ---------- */
export const progress=p=>`${Math.floor(p*100)}%`;
const p2=n=>String(n).padStart(2,'0');
export const date=d=>{d=new Date(d);return `${d.getFullYear()}.${p2(d.getMonth()+1)}.${p2(d.getDate())}`;};
export const time=d=>{d=new Date(d);return `${p2(d.getHours())}:${p2(d.getMinutes())}`;};
export const dateTime=d=>`${date(d)} ${time(d)}`;

/* Korean subject particle after a word: 대상 → 대상이, 정보 → 정보가 */
export function subj(w){const c=w.charCodeAt(w.length-1)-0xAC00;return w+(c>=0&&c<11172&&c%28?'이':'가');}
