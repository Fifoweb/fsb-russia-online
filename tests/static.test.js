import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CATALOG } from '../dist/catalog-data.js';
import { GALLERY, MATERIALS } from '../dist/resources-data.js';
import { ranks } from '../dist/content-data.js';
const root=new URL('../dist/',import.meta.url);
const html=fs.readFileSync(new URL('index.html',root),'utf8');
test('all locally referenced assets exist and are nonempty',()=>{
  const css=fs.readFileSync(new URL('styles.css',root),'utf8');
  const refs=[...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(m=>m[1]).filter(s=>!s.startsWith('http'));
  refs.push(...[...css.matchAll(/url\(['"]?([^'"\)]+)['"]?\)/g)].map(m=>m[1]),...CATALOG.map(i=>i.image),...GALLERY.map(i=>i.src));
  for(const file of refs)assert.ok(fs.statSync(new URL(file,root)).size>0,file);
});
test('page routes, material links and IDs resolve without duplicate IDs',()=>{
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
  const routes=new Set([...html.matchAll(/data-page="([^"]+)"/g)].map(m=>m[1]));
  for(const match of html.matchAll(/href="#([^"]+)"/g)){
    const [route,id]=match[1].split('/');assert.ok(routes.has(route)||ids.includes(route),match[1]);
    if(id)assert.ok(MATERIALS.some(m=>m.id===id));
  }
  for(const file of ['app.js','core.js','catalog-data.js','content-data.js','resources-data.js','export-image.js']){
    const js=fs.readFileSync(new URL(file,root),'utf8');
    for(const imp of js.matchAll(/from '(\.\/[^']+)'/g))assert.ok(fs.existsSync(new URL(imp[1],new URL(file,root))),imp[1]);
  }
});
test('all literal application ID selectors have corresponding HTML elements',()=>{
  const js=fs.readFileSync(new URL('app.js',root),'utf8');
  for(const match of js.matchAll(/\$\('#([a-z-]+)'\)/g))assert.ok(html.includes(`id="${match[1]}"`),match[1]);
});
test('unverified recipes are explicit and no foreign sign-in endpoints are linked',()=>{
  assert.ok(CATALOG.every(item=>item.fsbVerified===false));
  for(const match of html.matchAll(/href="(https?:[^\"]+)"/g))assert.ok(!/eis\.|oauth|supabase|discord/i.test(match[1]),match[1]);
  assert.match(html,/Сайт игровой фракции проекта/);
});
test('all 15 rank illustrations match source names and exist',()=>{
  const manifest=JSON.parse(fs.readFileSync(new URL('../docs/rank-manifest.json',import.meta.url),'utf8'));
  assert.deepEqual(manifest.map(row=>row.label),ranks.flatMap(group=>group.items.map(item=>item[0])));
  for(const item of manifest){const svg=fs.readFileSync(new URL(item.path,root),'utf8');assert.match(svg,/<svg /);assert.ok(svg.includes(item.label));}
});
