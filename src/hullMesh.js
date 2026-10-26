/* =========================================================
   선체 외판 메시 데이터 (대시보드 3D 뷰와 보고서 3D 렌더가 함께 쓴다)
   three.js 좌표: x = X − XC (선수 +), y = Z (위 +), z = 우현 반폭 (좌현 메시는 z를 뒤집어 쓴다)
   ========================================================= */
import { D, XC, NX, G, stX, stSec, deckZ } from './hull.js';

export const nV=(NX+1)*G;
export const pos=new Float32Array(nV*3),girth=new Float32Array(nV);
for(let i=0;i<=NX;i++){const s=stSec[i],X=stX[i];for(let j=0;j<G;j++){const k=i*G+j;
  pos[k*3]=X-XC;pos[k*3+1]=s.Zs[j];pos[k*3+2]=s.Ys[j];girth[k]=s.gs[j];}}
export const index=[];for(let i=0;i<NX;i++)for(let j=0;j<G-1;j++){const a=i*G+j,b=(i+1)*G+j,c=a+1,d=b+1;index.push(a,b,c,b,d,c);}

/* superstructure boxes [x0, x1, z0, z1, width, funnelBand?] (ship X, Z in m) */
export const SUPER_BOXES=[[40,245,D,D+2.4,34],[6,24,D,D+20,36],[18,24,D+17.8,D+20,46],[2,9,D+20,D+30,9],[2,9,D+27.4,D+29,9.2,true],
  [120,135,D+2.4,D+6.4,14],[278,279.4,deckZ(279),deckZ(279)+11,1.4],...[60,100,150,200].map(x=>[x,x+9,D+2.4,D+4.4,6])];
