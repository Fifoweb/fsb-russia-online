import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {chromium}=createRequire(path.join(root,'.qa-tools','package.json'))('playwright');
const base=process.env.FSB_QA_URL||'https://fifoweb.github.io/fsb-russia-online/';
const order=['home','about','divisions','ranks','equipment','materials','gallery','faq','join'];
const report={base,started:new Date().toISOString(),checks:[],errors:[],sequences:[]};
const out=path.join(root,'docs','qa');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage();
page.on('pageerror',e=>report.errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
async function go(route){await page.goto(base+'#'+route,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(name=>document.body.dataset.page===name,route.split('/')[0]);}
async function aligned(name){await page.waitForFunction(name=>{const top=document.querySelector(`#content > [data-page="${name}"]`).getBoundingClientRect().top;const header=document.querySelector('.header').getBoundingClientRect().bottom;return document.body.dataset.page===name&&Math.abs(top-header-24)<4;},name);}
async function wheelThrough(direction){
  const visited=[await page.evaluate(()=>document.body.dataset.page)];
  for(let step=0;step<150;step++){
    await page.mouse.wheel(0,direction*300);await page.waitForTimeout(65);
    const state=await page.evaluate(()=>({section:document.body.dataset.page,hash:location.hash,top:scrollY,end:scrollY+innerHeight>=document.documentElement.scrollHeight-2,width:document.documentElement.scrollWidth,viewport:innerWidth}));
    assert.ok(state.width<=state.viewport,'Horizontal overflow');
    if(state.section!==visited.at(-1)){visited.push(state.section);assert.equal(state.hash,'#'+state.section);}
    if(direction>0?state.end:state.top===0)break;
  }
  return visited;
}
try{
  for(const width of [390,1440]){
    await page.setViewportSize({width,height:900});await go('home');
    assert.deepEqual(await page.locator('#content > [data-page]:visible').evaluateAll(nodes=>nodes.map(n=>n.dataset.page)),order);
    await page.locator('.header .brand').focus();
    const down=await wheelThrough(1);assert.deepEqual(down,order);
    assert.equal(await page.evaluate(()=>document.activeElement.className),'brand');
    const up=await wheelThrough(-1);assert.deepEqual(up,[...order].reverse());
    report.sequences.push({width,down,up});
  }
  report.checks.push('Real wheel scrolling visits every section in menu order in both directions; focus is preserved');
  await page.locator('#navigation a[href="#ranks"]').click();await aligned('ranks');
  await page.locator('#navigation a[href="#gallery"]').click();await aligned('gallery');
  await page.goBack();await aligned('ranks');
  await page.evaluate(()=>scrollBy({top:180,behavior:'instant'}));
  await page.locator('#navigation a[href="#ranks"]').click();await aligned('ranks');
  await page.screenshot({path:path.join(out,'scroll-ranks-1440.jpg'),type:'jpeg',quality:85});
  report.checks.push('Smooth menu navigation, same-link navigation and browser Back');
  // A fresh load tests a direct link even if resize already updated the hash to this section.
  await page.setViewportSize({width:390,height:844});await go('divisions');
  await page.reload({waitUntil:'networkidle'});await aligned('divisions');
  await page.locator('#menu-toggle').click();await page.locator('#navigation a[href="#equipment"]').click();await aligned('equipment');
  assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'),'false');
  assert.equal(await page.locator('#navigation a[href="#equipment"]').getAttribute('aria-current'),'location');
  await page.screenshot({path:path.join(out,'scroll-equipment-390.jpg'),type:'jpeg',quality:85});
  await page.locator('#content > [data-page="equipment"] .button[href="#crafts"]').click();
  assert.equal(await page.evaluate(()=>document.body.dataset.view),'standalone');
  assert.deepEqual(await page.locator('#content > [data-page]:visible').evaluateAll(nodes=>nodes.map(n=>n.dataset.page)),['crafts']);
  await page.locator('[data-add="5005"]').click();await page.locator('#mobile-cart-link').click();
  await page.keyboard.press('Escape');await page.keyboard.press('End');
  assert.equal(await page.evaluate(()=>document.body.dataset.page),'crafts');
  await page.locator('#menu-toggle').click();await page.locator('#navigation a[href="#equipment"]').click();await aligned('equipment');
  assert.ok(!(await page.locator('#mobile-cart-link').isVisible()));
  await go('materials/calculator');
  assert.equal(await page.evaluate(()=>document.body.dataset.view),'standalone');
  await page.locator('#material-detail a[href="#materials"]').click();await aligned('materials');
  assert.deepEqual(await page.locator('#content > [data-page]:visible').evaluateAll(nodes=>nodes.map(n=>n.dataset.page)),order);
  report.checks.push('Direct links and reload, mobile menu, separate full calculator and return from documents');
  await page.emulateMedia({reducedMotion:'reduce'});await go('home');
  await page.keyboard.press('PageDown');await page.waitForTimeout(100);
  assert.ok(await page.evaluate(()=>scrollY>0));
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior),'auto');
  assert.deepEqual(report.errors,[]);report.checks.push('Native keyboard scrolling, reduced motion and no JavaScript errors');
  report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;report.state=await page.evaluate(()=>({hash:location.hash,active:document.body.dataset.page,scroll:scrollY,header:document.querySelector('.header').getBoundingClientRect().bottom,sections:[...document.querySelectorAll('#content > [data-page]:not([hidden])')].map(n=>({name:n.dataset.page,top:n.getBoundingClientRect().top}))})).catch(()=>null);await page.screenshot({path:path.join(out,'scroll-failure.jpg'),type:'jpeg'}).catch(()=>{});process.exitCode=1;}
finally{report.finished=new Date().toISOString();fs.writeFileSync(path.join(out,'scroll-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();}
