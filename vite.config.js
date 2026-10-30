import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

/* `import icon from './a.png?datauri'` → the file as a data: URI string, in dev and in the build alike
   (the report embeds its judgement icons so the PDF capture never waits on a separate file) */
const MIME={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp'};
const Q='?datauri';
const dataUri={name:'datauri',enforce:'pre',
  async resolveId(id,importer){
    if(!id.endsWith(Q))return null;
    const r=await this.resolve(id.slice(0,-Q.length),importer,{skipSelf:true});
    return r&&r.id+Q;
  },
  load(id){
    if(!id.endsWith(Q))return null;
    const file=id.slice(0,-Q.length);this.addWatchFile(file);
    return `export default ${JSON.stringify(`data:${MIME[extname(file).toLowerCase()]};base64,${readFileSync(file).toString('base64')}`)};`;
  }};

/* chunkSizeWarningLimit (kB): the app bundle (~630 kB) and ExcelJS (~940 kB, loaded only on the Excel button) are expected sizes */
export default defineConfig({plugins:[dataUri],build:{chunkSizeWarningLimit:1000}});
