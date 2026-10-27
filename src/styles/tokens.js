/* =========================================================
   디자인 토큰 — 색·글꼴 값은 이 파일 한 곳에만 둔다.
   - 화면 CSS·보고서 CSS: 앱이 시작할 때 applyTokens()가 아래 CSS_VARS를 :root의 CSS 변수로 설정한다 (styles/applyTokens.js).
     styles/tokens.css에는 변수 이름 목록만 있다.
   - 캔버스(S.SHELL, 좌표축)·SVG(단면 그림, 보고서 차트)·three.js(실제 보기 외곽선): 이 객체들을 직접 읽는다.
   글자색 3단계: text (제목·숫자·FR) · text2 (판정 이름·항목 제목·위치·설명·버튼) · muted (건수·순위·축 라벨·태그)
   글꼴 2개: 한글·영문 = IBM Plex Sans KR, 숫자·FR·좌표·단위 = IBM Plex Mono (한글이 섞이면 Sans KR로 대체)
   ========================================================= */
export const COLOR={
  /* brand (Hanwha): orange only for buttons, selection border, progress bar */
  orange:'#F37321',coral:'#F89B6C',peach:'#FBB584',k100:'#000000',
  /* surfaces and lines */
  bg:'#04070D',surface:'#0A1120',surface2:'#0F182B',surface3:'#15213A',glass:'rgba(7,12,23,.82)',popBg:'#070C17',tipBg:'rgba(3,6,12,.93)',
  line:'#1A263D',lineStrong:'#2A3A58',
  hatchBg:'#3A4558',hatchLine:'#8A96AA',   // 측정 불가 / 수동 측정 hatch
  /* text: three steps */
  text:'#E8EDF6',text2:'#A7B3C7',muted:'#6F7C93',
  /* judgement: 정상 · 주의 · 경고 · 최우선 보수 */
  lv:['#8FA3BF','#F2B53A','#FF5A5F','#E23D4B'],
  /* 3D hull */
  zoneLabel:'#1F2D4A',zoneLabelBg:'rgba(255,255,255,.72)',   // 구역 이름 on the light hull
  hull:'#D3D8DF',hullBelow:'#8E3B33',hullAbove:'#9AA3AE',     // 실선 / 실제 (below · above the design waterline)
  /* translucent variants (CSS) */
  orangeA:{10:'rgba(243,115,33,.10)',18:'rgba(243,115,33,.18)',35:'rgba(243,115,33,.35)',60:'rgba(243,115,33,.6)',0:'rgba(243,115,33,0)'},
  peachA35:'rgba(251,181,132,.35)',
  warnBg:'rgba(242,181,58,.12)',warnLine:'rgba(242,181,58,.6)',critBg:'rgba(255,90,95,.12)',critLine:'rgba(255,90,95,.6)',
  shadow:'rgba(0,0,0,.5)',backdrop:'rgba(0,0,0,.86)',
  /* drawing only: S.SHELL canvas, section figure, 3D */
  draw:{shell:'#0E1628',outline:'#C9D3E3',dwl:'rgba(122,150,200,.5)',marker:'#FFFFFF',crosshair:'rgba(255,255,255,.35)',
    hatch:'rgba(255,255,255,.12)',heatEdge:'#FFFFFF',   // heatEdge: the 실제 look's contour around the heatmap
    material:{plate:'#3A4558',dft:'#4A3A1E'}},
  /* report (white page) */
  rp:{bg:'#FFFFFF',text:'#14181F',text2:'#3A4252',muted:'#6B7385',line:'#E1E5EB',line2:'#EBEEF2',line3:'#D5D9E0',lineStrong:'#C4CAD4',
    fill:'#F1F3F6',fill2:'#F7F8FA',fill3:'#E3E6EB',photo:'#D9DDE3',photoText:'#4A5262',tagLine:'#9AA2B1',
    warnLine:'#E0A637',warnText:'#8A5C00',warnBg:'rgba(242,181,58,.16)',critText:'#C42A36',critBg:'rgba(255,90,95,.10)',
    previewBg:'#5B6474',pageShadow:'rgba(0,0,0,.35)',hatch:'rgba(0,0,0,.14)',
    lv:['#8A93A3','#C98A12','#E23D4B'],            // 정상 · 주의 (amber darkened to read on white) · 경고
    lvFill:['#8A93A3','#F2B53A','#E23D4B'],        // map / bar fills
    normalFill:'#DCE1E8',shellFill:'#F4F6F9',shellLine:'#5B6474',dwl:'#2F5597',warnLabel:'#B87400',
    material:{plate:'#C3C9D2',dft:'#EAD3A2'}}      // section figure (report)
};
/* font stacks (single quotes, so they also fit SVG attributes) */
export const FONT={
  ui:"'IBM Plex Sans KR','Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif",
  mono:"'IBM Plex Mono','IBM Plex Sans KR',ui-monospace,'SFMono-Regular',Menlo,Consolas,monospace"
};
/* type scale (px) */
export const FS={title:14,sub:13,body:12,meta:11,numS:15,numL:22,numXL:28,tick:10};
export const UNIT=0.55,UNIT_MIN=10;   // unit (µm, mm, %, 건) = max(UNIT × the number's size, UNIT_MIN px)
export const LS_LABEL='.08em';         // English labels (VIEW, LAYERS …): Sans 11px 600
/* canvas font shorthand: font(600, FS.meta, 'ui') → "600 11px 'IBM Plex Sans KR',…" */
export const font=(weight,size,family='ui')=>`${weight} ${size}px ${FONT[family]}`;

/* the CSS variables (names listed in styles/tokens.css) */
const px=n=>`${n}px`;
export const CSS_VARS={
  '--ho-orange':COLOR.orange,'--ho-coral':COLOR.coral,'--ho-peach':COLOR.peach,'--k100':COLOR.k100,
  '--bg':COLOR.bg,'--surface':COLOR.surface,'--surface-2':COLOR.surface2,'--surface-3':COLOR.surface3,'--glass':COLOR.glass,
  '--pop-bg':COLOR.popBg,'--tip-bg':COLOR.tipBg,'--line':COLOR.line,'--line-strong':COLOR.lineStrong,
  '--hatch-bg':COLOR.hatchBg,'--hatch-line':COLOR.hatchLine,
  '--text':COLOR.text,'--text-2':COLOR.text2,'--muted':COLOR.muted,
  '--lv-ok':COLOR.lv[0],'--lv-warn':COLOR.lv[1],'--lv-crit':COLOR.lv[2],'--lv-top':COLOR.lv[3],
  '--zone-label':COLOR.zoneLabel,'--zone-label-bg':COLOR.zoneLabelBg,
  '--hull':COLOR.hull,'--hull-below':COLOR.hullBelow,'--hull-above':COLOR.hullAbove,
  '--orange-a10':COLOR.orangeA[10],'--orange-a18':COLOR.orangeA[18],'--orange-a35':COLOR.orangeA[35],'--orange-a60':COLOR.orangeA[60],'--orange-a0':COLOR.orangeA[0],
  '--peach-a35':COLOR.peachA35,'--warn-bg':COLOR.warnBg,'--warn-line':COLOR.warnLine,'--crit-bg':COLOR.critBg,'--crit-line':COLOR.critLine,
  '--shadow':COLOR.shadow,'--backdrop':COLOR.backdrop,
  '--font-ui':FONT.ui,'--font-mono':FONT.mono,
  '--fs-title':px(FS.title),'--fs-sub':px(FS.sub),'--fs-body':px(FS.body),'--fs-meta':px(FS.meta),
  '--fs-num-s':px(FS.numS),'--fs-num-l':px(FS.numL),'--fs-num-xl':px(FS.numXL),'--fs-tick':px(FS.tick),
  '--unit':String(UNIT),'--unit-min':px(UNIT_MIN),'--ls-label':LS_LABEL,
  '--rp-bg':COLOR.rp.bg,'--rp-text':COLOR.rp.text,'--rp-text-2':COLOR.rp.text2,'--rp-muted':COLOR.rp.muted,
  '--rp-line':COLOR.rp.line,'--rp-line-2':COLOR.rp.line2,'--rp-line-3':COLOR.rp.line3,'--rp-line-strong':COLOR.rp.lineStrong,
  '--rp-fill':COLOR.rp.fill,'--rp-fill-2':COLOR.rp.fill2,'--rp-fill-3':COLOR.rp.fill3,'--rp-photo':COLOR.rp.photo,'--rp-photo-text':COLOR.rp.photoText,
  '--rp-tag-line':COLOR.rp.tagLine,'--rp-warn-line':COLOR.rp.warnLine,'--rp-warn-text':COLOR.rp.warnText,'--rp-warn-bg':COLOR.rp.warnBg,
  '--rp-crit-text':COLOR.rp.critText,'--rp-crit-bg':COLOR.rp.critBg,'--rp-preview-bg':COLOR.rp.previewBg,'--rp-page-shadow':COLOR.rp.pageShadow
};
/* set every CSS variable on :root (called once, before the first paint — styles/applyTokens.js) */
export function applyTokens(root=document.documentElement){
  for(const [k,v] of Object.entries(CSS_VARS))root.style.setProperty(k,v);
}
