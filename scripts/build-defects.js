/* =========================================================
   손상 사진 정리: private/외판 도막 손상/ (원본, 그대로 둔다) → public/images/defects/ (화면용) + manifest.json
     빨강 외판 = 흘수선 아래 → below/ · 회색 외판 = 흘수선 위 → above/
     도막 떨어짐 → flaking/ · 스크래치 → scratch/
   사진은 원본 파일명 순서대로 001.jpg, 002.jpg … 로 저장한다 (긴 변 1280px, JPG 품질 80, 사진 방향(EXIF) 반영).
   사진을 추가·삭제하면 이 스크립트만 다시 실행한다:  npm run defects
   원본 폴더가 없는 환경(저장소를 새로 받은 경우)에서는 public 쪽에 있는 사진으로 manifest만 다시 만든다.
   ========================================================= */
import { readdir, mkdir, rm, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT=join(dirname(fileURLToPath(import.meta.url)),'..');
const SRC=join(ROOT,'private','외판 도막 손상');
const OUT=join(ROOT,'public','images','defects');
const SETS=[
  {src:'빨강 외판 도막 떨어짐',zone:'below',kind:'flaking'},
  {src:'빨강 외판 스크래치',zone:'below',kind:'scratch'},
  {src:'회색 외판 도막 떨어짐',zone:'above',kind:'flaking'},
  {src:'회색 외판 스크래치',zone:'above',kind:'scratch'}
];
const LONG_SIDE=1280,QUALITY=80;
const IMAGE=/\.(jpe?g|png|webp|heic|tiff?)$/i;
const byName=(a,b)=>a.localeCompare(b,'ko',{numeric:true,sensitivity:'base'});
const num=n=>String(n).padStart(3,'0');

async function convert(set){
  const from=join(SRC,set.src),to=join(OUT,set.zone,set.kind);
  const files=(await readdir(from)).filter(f=>IMAGE.test(f)).sort(byName);
  await rm(to,{recursive:true,force:true});await mkdir(to,{recursive:true});
  for(let i=0;i<files.length;i++){
    await sharp(join(from,files[i])).rotate().resize({width:LONG_SIDE,height:LONG_SIDE,fit:'inside',withoutEnlargement:true})
      .jpeg({quality:QUALITY,mozjpeg:true}).toFile(join(to,`${num(i+1)}.jpg`));
  }
  return files.length;
}

async function main(){
  const fromSource=existsSync(SRC);
  const manifest={note:'build-defects.js가 만든 목록 — 손으로 고치지 말고 스크립트를 다시 실행한다',below:{flaking:[],scratch:[]},above:{flaking:[],scratch:[]}};
  let bytes=0;
  for(const set of SETS){
    if(fromSource)await convert(set);
    const dir=join(OUT,set.zone,set.kind);
    const files=existsSync(dir)?(await readdir(dir)).filter(f=>extname(f).toLowerCase()==='.jpg').sort(byName):[];
    for(const f of files)bytes+=(await stat(join(dir,f))).size;
    manifest[set.zone][set.kind]=files.map(f=>`${set.zone}/${set.kind}/${f}`);
    console.log(`${set.zone}/${set.kind}: ${files.length}장${fromSource?` (원본 ${set.src})`:''}`);
  }
  await mkdir(OUT,{recursive:true});
  await writeFile(join(OUT,'manifest.json'),JSON.stringify(manifest,null,1)+'\n');
  console.log(`합계 ${Object.values(manifest).filter(v=>typeof v==='object').flatMap(z=>Object.values(z)).flat().length}장 · ${(bytes/1048576).toFixed(1)} MB → ${OUT}`);
}
main().catch(e=>{console.error(e);process.exit(1);});
