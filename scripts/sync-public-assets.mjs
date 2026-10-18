import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','dist');
// Keep index.html from the source copy: the hosting layer can inject its own challenge script.
const manifest=JSON.parse(await fs.readFile(new URL('./assets-manifest.json',import.meta.url),'utf8')).filter(item=>item.path!=='index.html');
const base=process.env.FSB_ASSET_URL||'https://fifoweb.github.io/fsb-russia-online/';
for(let i=0;i<manifest.length;i+=4)await Promise.all(manifest.slice(i,i+4).map(async item=>{
  const target=path.resolve(root,item.path);if(!target.startsWith(root+path.sep))throw new Error('Invalid path');
  const response=await fetch(new URL(item.path,base));if(!response.ok)throw new Error(`${response.status} ${item.path}`);
  const bytes=Buffer.from(await response.arrayBuffer());if(createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw new Error('Checksum mismatch: '+item.path);
  await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,bytes);
}));
console.log(`Saved and verified ${manifest.length} project assets.`);
