import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(path.join(root,'.qa-tools','package.json'));
const {chromium}=require('playwright');
const base=process.env.FSB_QA_URL||'https://fifoweb.github.io/fsb-russia-online/';
const out=path.join(root,'docs','qa');fs.mkdirSync(out,{recursive:true});
const report={started:new Date().toISOString(),base,widths:[],checks:[],errors:[],screenshots:[]};
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,permissions:['clipboard-read','clipboard-write'],acceptDownloads:true});
const page=await context.newPage();
page.on('pageerror',e=>report.errors.push(e.message));
page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
page.on('response',r=>{if(r.status()>=400&&r.url().startsWith(base.split('#')[0]))report.errors.push(`${r.status()} ${r.url()}`);});
async function go(route){await page.goto(base.split('#')[0]+'#'+route,{waitUntil:'networkidle'});await page.waitForFunction(name=>document.body.dataset.page===name,route.split('/')[0]);await page.evaluate(()=>document.fonts.ready);}
async function shot(name,fullPage=true){await page.locator('#toast').waitFor({state:'hidden',timeout:6000});const file=path.join(out,name+'.jpg');await page.screenshot({path:file,fullPage,type:'jpeg',quality:82,animations:'disabled'});report.screenshots.push(path.basename(file));}
async function qty(id,value){const input=page.locator(`[data-quantity="${id}"][data-context="catalog"]`);await input.fill(value);await input.press('Tab');return Number(await input.inputValue());}
async function loadVisibleImages(){await page.evaluate(async()=>{for(const image of document.images){if(image.getBoundingClientRect().height>0)image.loading='eager';}await Promise.all([...document.images].filter(i=>i.getBoundingClientRect().height>0).map(i=>i.complete?Promise.resolve():new Promise(resolve=>{i.addEventListener('load',resolve,{once:true});i.addEventListener('error',resolve,{once:true});})));for(let y=0;y<document.documentElement.scrollHeight;y+=innerHeight/2){scrollTo({top:y,behavior:'instant'});await new Promise(requestAnimationFrame);}scrollTo({top:0,behavior:'instant'});await new Promise(requestAnimationFrame);});}
try{
  await go('crafts');await page.evaluate(()=>localStorage.clear());await page.reload({waitUntil:'networkidle'});
  for(const id of ['5005','347','124'])await page.locator(`[data-add="${id}"]`).click();
  assert.equal(await qty('5005','2'),2);
  assert.equal((await page.locator('#total-weight').textContent()).replace(/\s/g,''),'10,004кг');
  const totals=await page.locator('.cart-material-line strong').allTextContents();assert.deepEqual(totals,['360','30','1']);
  report.checks.push('Mixed materials, three positions and exact 10.004 kg');
  for(const [raw,expected] of [['',1],['-3',1],['12.8',12],['abc',12],['0',1],['999999',99999],['99 999',99999]])assert.equal(await qty('5005',raw),expected,raw);
  assert.ok(await page.locator('[data-card="5005"] [data-adjust="1"]').isDisabled());
  await qty('5005','1');assert.ok(await page.locator('[data-card="5005"] [data-adjust="-1"]').isDisabled());await qty('5005','2');
  report.checks.push('Input: blank, negative, fractional, pasted text, zero and maximum');
  await page.locator('[data-favorite="5005"]').click();await page.locator('#favorites-only').check();assert.equal(await page.locator('.craft-card').count(),1);
  await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('[data-favorite="5005"]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('[data-quantity="5005"][data-context="catalog"]').inputValue(),'2');
  report.checks.push('Favorites and calculation survive reload');
  await page.locator('#craft-search').fill('НетТакогоПредмета');assert.ok(await page.locator('#empty-results').isVisible());await page.locator('#reset-filters').click();
  await page.locator('[data-category="technical"]').click();assert.ok(await page.locator('.craft-card').count()>0);assert.ok((await page.locator('.category-mark').allTextContents()).every(x=>x==='Технические'));
  await page.locator('[data-category="all"]').click();await page.locator('#craft-sort').selectOption('name');
  const names=await page.locator('.craft-card h2').allTextContents();assert.deepEqual(names,[...names].sort((a,b)=>a.localeCompare(b,'ru')));
  await page.locator('#confirmed-only').check();assert.equal(await page.locator('.craft-card').count(),0);assert.match(await page.locator('#empty-catalog-message').textContent(),/пока нет/);await page.locator('#reset-filters').click();
  report.checks.push('Search, categories, sorting and honest confirmed-only empty state');
  const second=await context.newPage();await second.goto(base.split('#')[0]+'#crafts',{waitUntil:'networkidle'});
  await second.locator('[data-quantity="5005"][data-context="catalog"]').fill('3');await second.locator('[data-quantity="5005"][data-context="catalog"]').press('Tab');
  await page.waitForFunction(()=>document.querySelector('[data-quantity="5005"][data-context="catalog"]').value==='3');await second.close();await qty('5005','2');
  report.checks.push('Calculation synchronizes between tabs');
  await page.locator('#copy-list').click();
  if(await page.locator('#copy-dialog').isVisible()){assert.match(await page.locator('#copy-text').inputValue(),/АК-12/);await page.locator('#copy-dialog button').click();}
  else assert.match(await page.evaluate(()=>navigator.clipboard.readText()),/АК-12/);
  const pngPromise=page.waitForEvent('download');await page.locator('#export-png').click();const png=await pngPromise;await png.saveAs(path.join(out,'calculation.png'));
  assert.deepEqual([...fs.readFileSync(path.join(out,'calculation.png')).subarray(0,8)],[137,80,78,71,13,10,26,10]);
  const txtPromise=page.waitForEvent('download');await page.locator('#export-txt').click();const txt=await txtPromise;await txt.saveAs(path.join(out,'calculation.txt'));assert.match(fs.readFileSync(path.join(out,'calculation.txt'),'utf8'),/Технические: 30/);
  report.checks.push('Real clipboard, PNG and TXT downloads');
  await page.evaluate(async()=>{const {CATALOG}=await import('./catalog-data.js');const item=CATALOG.find(x=>x.id==='5005');window.__qaWeight=item.weightGrams;item.weightGrams=null;});
  await qty('5005','3');assert.ok(await page.locator('#weight-warning').isVisible());assert.equal(await page.locator('#weight-label').textContent(),'Известный вес');
  await page.evaluate(async()=>{const {CATALOG}=await import('./catalog-data.js');CATALOG.find(x=>x.id==='5005').weightGrams=window.__qaWeight;});await qty('5005','2');
  report.checks.push('Unknown weight is explicitly incomplete');
  await go('gallery');await loadVisibleImages();await page.locator('[data-gallery="0"]').focus();await page.keyboard.press('Enter');assert.ok(await page.locator('#lightbox').isVisible());
  await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#lightbox-counter').textContent(),'2 / 5');await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('#lightbox-counter').textContent(),'1 / 5');await page.keyboard.press('Escape');assert.ok(!(await page.locator('#lightbox').isVisible()));
  await go('ranks');await page.locator('[data-rank="0"]').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('[data-rank="1"]').getAttribute('aria-selected'),'true');
  await go('faq');await page.locator('.faq-list summary').first().click();assert.equal(await page.locator('.faq-list details').first().getAttribute('open'),'');
  await go('materials');await page.locator('#material-search').fill('количество');assert.ok(await page.locator('.material-card').count()>0);await page.locator('#material-search').fill('НичегоПодобного');assert.ok(await page.locator('#material-empty').isVisible());await page.locator('#reset-material-search').click();
  await page.locator('#material-grid a[href="#materials/calculator"]').click();assert.ok(await page.locator('#material-detail').isVisible());
  report.checks.push('Keyboard lightbox, arrows, Escape, rank tabs, FAQ, materials and deep links');
  for(const width of [360,390,768,1440]){
    await page.setViewportSize({width,height:width<700?844:1000});
    for(const route of ['home','about','divisions','ranks','crafts','materials','gallery','join','faq','review']){
      await go(route);await loadVisibleImages();
      const layout=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,broken:[...document.images].filter(i=>i.getBoundingClientRect().height>0&&(!i.complete||i.naturalWidth===0)).map(i=>i.src)}));
      assert.ok(layout.width<=layout.viewport,`${route} ${width}: horizontal overflow ${layout.width}`);assert.deepEqual(layout.broken,[],`${route} ${width}: broken images`);
      if([390,1440].includes(width)&&['home','crafts','gallery'].includes(route))await shot(`${route}-${width}`);
    }
    report.widths.push(width);
  }
  await page.setViewportSize({width:390,height:844});await go('home');await page.locator('#menu-toggle').click();assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'),'true');await page.keyboard.press('Escape');assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'),'false');
  await page.locator('#menu-toggle').click();await page.locator('#navigation a[href="#crafts"]').click();assert.equal(await page.locator('#navigation a[href="#crafts"]').getAttribute('aria-current'),'page');
  await page.locator('#mobile-cart-link').click();assert.equal(await page.locator('#cart').getAttribute('aria-modal'),'true');await shot('crafts-mobile-summary',false);await page.keyboard.press('Escape');assert.ok(!(await page.locator('#cart').isVisible()));
  report.checks.push('Mobile menu, active section and keyboard-accessible calculation drawer');
  await page.emulateMedia({reducedMotion:'reduce'});await go('home');assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior),'auto');
  assert.deepEqual(report.errors,[]);report.checks.push('Reduced motion; no JavaScript errors or missing network resources');
  report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;await shot('failure',false).catch(()=>{});process.exitCode=1;}
finally{report.finished=new Date().toISOString();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();}
