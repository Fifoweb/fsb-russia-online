import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '../dist/catalog-data.js';
import { clampQuantity, normalizeQuantity, sanitizeSelection, sanitizeFavorites, calculate, filterCatalog, makeText, formatWeight } from '../dist/core.js';

test('quantities reject invalid values and honor 99,999 per item', () => {
  assert.equal(clampQuantity(100000), 99999);
  assert.equal(clampQuantity('12.9'), 12);
  for (const value of ['', -1, NaN, Infinity, 'bad', null, {}, []]) assert.equal(clampQuantity(value), 0);
});
test('stored selections only accept known catalog IDs and valid bounded quantities', () => {
  const selection = sanitizeSelection(JSON.parse('{"5005":100000,"124":4,"foreign":99,"347":-3,"__proto__":{"polluted":true}}'), CATALOG);
  assert.deepEqual(selection, { 124: 4, 5005: 99999 });
  assert.deepEqual(sanitizeSelection([1, 2, 3], CATALOG), {});
  assert.equal({}.polluted, undefined);
});
test('mixed categories and sub-gram precision stay exact over a large loadout', () => {
  const summary = calculate(CATALOG, { 5005: 2, 347: 1, 124: 99999, 5500: 3 });
  assert.equal(summary.materials.weapon, 363);
  assert.equal(summary.materials.technical, 30);
  assert.equal(summary.materials.medical, 99999);
  assert.equal(summary.weightGrams, 410014);
  assert.equal(summary.count, 100005);
  assert.equal(summary.rows.length, 4);
});
test('search ignores ё and typographic quotes while respecting category and selection', () => {
  const light = filterCatalog(CATALOG, {}, { query: 'легкий бронежилет' });
  assert.deepEqual(light.map(item => item.id), ['456']);
  assert.equal(filterCatalog(CATALOG, {}, { query: 'Стечкин' })[0].id, '5002');
  assert.equal(filterCatalog(CATALOG, { 347: 2, 5005: 1 }, { category: 'technical', selectedOnly: true }).length, 1);
  assert.equal(filterCatalog(CATALOG, {}, { query: '<script>' }).length, 0);
});
test('exports include all selected items, separate materials and source qualification', () => {
  const text = makeText(calculate(CATALOG, { 5005: 2, 347: 1 }));
  assert.match(text, /АК-12 × 2/); assert.match(text, /бронежилет/); assert.match(text, /Оружейные: 360/);
  assert.match(text, /Технические: 30/); assert.match(text, /Общий вес: 10 кг/); assert.match(text, /требуют подтверждения/);
});
test('manual input normalizes blanks, zero, negative and decimal values, preserves previous count for text', () => {
  assert.equal(normalizeQuantity('', 5), 1);
  assert.equal(normalizeQuantity('0', 5), 1);
  assert.equal(normalizeQuantity('-12', 5), 1);
  assert.equal(normalizeQuantity('3.9', 5), 3);
  assert.equal(normalizeQuantity('3,9', 5), 3);
  assert.equal(normalizeQuantity('0.2', 5), 1);
  assert.equal(normalizeQuantity('99 999', 5), 99999);
  assert.equal(normalizeQuantity('100000', 5), 99999);
  for (const raw of ['abc','2 шт','1e3','<script>','Infinity']) assert.equal(normalizeQuantity(raw, 5), 5);
});
test('unknown weight stays explicitly incomplete in totals and exports', () => {
  const fixture = [{id:'unknown',name:'Тестовый предмет',category:'technical',materials:4,weightGrams:null},{id:'known',name:'Известный',category:'medical',materials:2,weightGrams:5}];
  const summary=calculate(fixture,{unknown:3,known:2});
  assert.equal(summary.completeWeight,false);assert.equal(summary.unknownWeightCount,3);assert.equal(summary.weightGrams,10);
  assert.equal(summary.materials.technical,12);assert.equal(summary.materials.medical,4);
  assert.match(makeText(summary),/Известный вес: 0,01 кг/);assert.match(makeText(summary),/Расчёт веса неполный/);assert.equal(formatWeight(null),'Вес не указан');
});
test('multiple material types in a single recipe are kept separate', () => {
  const summary=calculate([{id:'multi',name:'Тестовый рецепт',category:'technical',recipe:{technical:4,weapon:3,medical:2},weightGrams:17}],{multi:99999});
  assert.deepEqual(summary.materials,{weapon:299997,technical:399996,medical:199998});assert.equal(summary.weightGrams,1699983);
});
test('favorites reject stale IDs, duplicates and malformed saved data',()=>{
  assert.deepEqual(sanitizeFavorites(['5005','347','foreign','5005',null],CATALOG),['5005','347']);
  assert.deepEqual(sanitizeFavorites({5005:true},CATALOG),[]);
  assert.equal(filterCatalog(CATALOG,{}, {favoritesOnly:true,favorites:['5005']})[0].id,'5005');
  assert.equal(filterCatalog(CATALOG,{}, {confirmedOnly:true}).length,0);
});
test('saved calculations round trip through JSON and preserve totals',()=>{
  const saved=sanitizeSelection(JSON.parse(JSON.stringify({'5005':99999,'347':3,'124':8})),CATALOG);
  const summary=calculate(CATALOG,saved);assert.equal(summary.count,100010);assert.equal(summary.materials.weapon,17999820);assert.equal(summary.materials.technical,90);assert.equal(summary.materials.medical,8);
});
test('catalog has valid unique IDs, categories, integer material costs and exact gram weights', () => {
  assert.equal(CATALOG.length, 39); assert.equal(new Set(CATALOG.map(item => item.id)).size, 39);
  for (const item of CATALOG) {
    assert.ok(['medical', 'weapon', 'technical'].includes(item.category));
    assert.ok(Number.isSafeInteger(item.materials) && item.materials > 0);
    assert.ok(Number.isSafeInteger(item.weightGrams) && item.weightGrams > 0);
  }
});
