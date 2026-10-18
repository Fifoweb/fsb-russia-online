import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { CATALOG } from '../dist/catalog-data.js';
import { calculate } from '../dist/core.js';
import { drawExport } from '../dist/export-image.js';
let createCanvas;
try { const require=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/package.json':import.meta.url);({createCanvas}=require('@napi-rs/canvas')); }catch{}
test('PNG export produces a valid canvas for all items at maximum quantities',{skip:!createCanvas},()=>{
  const summary=calculate(CATALOG,Object.fromEntries(CATALOG.map(item=>[item.id,99999])));
  const canvas=drawExport(createCanvas(1,1),summary);const png=canvas.toBuffer('image/png');
  assert.equal(canvas.width,1200);assert.ok(canvas.height>3000&&canvas.height<9000);
  assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
});
test('PNG export handles a long name, multiple material types and unknown weight',{skip:!createCanvas},()=>{
  const item={id:'fixture',name:'Тестовое очень длинное название предмета для проверки переноса строк без потери содержимого',category:'weapon',recipe:{weapon:2,technical:3,medical:4},weightGrams:null};
  const summary=calculate([item],{fixture:99999});const canvas=drawExport(createCanvas(1,1),summary);
  assert.ok(canvas.height>600);assert.ok(canvas.toBuffer('image/png').length>1000);
});
