import { CATALOG } from './catalog-data.js';
import { tasks, divisions, ranks } from './content-data.js';
import { GALLERY, MATERIALS, FAQ, REVIEW } from './resources-data.js';
import { MAX_QUANTITY, CATEGORIES, STORAGE_KEY, FAVORITES_KEY, number, clampQuantity, normalizeQuantity, sanitizeSelection, sanitizeFavorites, calculate, formatWeight, normalizeSearch, filterCatalog, makeText, recipeOf } from './core.js';
import { drawExport } from './export-image.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const byId = new Map(CATALOG.map(item => [item.id, item]));
const filters = { category: 'all', query: '', sort: 'default', selectedOnly: false, favoritesOnly: false, confirmedOnly: false };
const mobile = () => matchMedia('(max-width: 900px)').matches;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let selection = {}, favorites = [], toastTimer, storageWarned = false, activePage = 'home', galleryIndex = 0;
let storageMessage = '';
try {
  selection = sanitizeSelection(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'), CATALOG);
  favorites = sanitizeFavorites(JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'), CATALOG);
} catch { storageMessage = 'Не удалось прочитать сохранённые данные. Калькулятор доступен; сохраните результат перед закрытием.'; }
function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false; toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 5000); }
function persist(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { if (!storageWarned) { toast('Браузер не разрешает сохранение. Скачайте расчёт перед закрытием.'); storageWarned = true; } }
}

$('#task-grid').innerHTML = tasks.slice(0, 4).map(([title, description], i) => `<article class="task-card"><span class="index">0${i + 1} /</span><h3>${esc(title)}</h3><p>${esc(description)}</p></article>`).join('');
$('#division-groups').innerHTML = divisions.flatMap((group, groupIndex) => group.items.map(([code, title, description]) => `<details class="division-card"><summary><span class="division-code">${esc(code)}</span><span><small>${esc(group.name)}</small><strong>${esc(title)}</strong></span><span class="plus" aria-hidden="true">+</span></summary><div><p>${esc(description)}</p><small>Справочное описание · состав ФСБ «Россия Онлайн» уточняется</small></div></details>`)).join('');
$('#rank-tabs').innerHTML = ranks.map((group, i) => `<button role="tab" id="rank-tab-${i}" aria-controls="rank-list" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-rank="${i}" class="${i === 0 ? 'active' : ''}">${esc(group.title)}</button>`).join('');
function renderRanks(index, focus = false) {
  $$('[data-rank]').forEach((button, i) => { button.classList.toggle('active', i === index); button.setAttribute('aria-selected', String(i === index)); button.tabIndex = i === index ? 0 : -1; });
  $('#rank-list').setAttribute('aria-labelledby', `rank-tab-${index}`);
  const offset = ranks.slice(0, index).reduce((sum, group) => sum + group.items.length, 0);
  $('#rank-list').innerHTML = ranks[index].items.map(([name, description], i) => `<article class="rank-card"><img class="rank-art" src="assets/ranks/rank-${String(offset + i + 1).padStart(2, '0')}.svg" width="300" height="104" alt="Справочный знак различия: ${esc(name)} — из fsbmaj.ru" loading="lazy"><span class="rank-number">${String(offset + i + 1).padStart(2, '0')}</span><div><h2>${esc(name)}</h2><p>${esc(description)}</p><small>Справочный порядок</small></div></article>`).join('');
  if (focus) $(`#rank-tab-${index}`).focus();
}
$('#rank-tabs').addEventListener('click', e => { const b = e.target.closest('[data-rank]'); if (b) renderRanks(Number(b.dataset.rank)); });
$('#rank-tabs').addEventListener('keydown', e => {
  if (!e.target.matches('[data-rank]')) return;
  const index = Number(e.target.dataset.rank);
  const next = { ArrowRight: (index + 1) % ranks.length, ArrowLeft: (index + ranks.length - 1) % ranks.length, Home: 0, End: ranks.length - 1 }[e.key];
  if (next !== undefined) { e.preventDefault(); renderRanks(next, true); }
});
renderRanks(0);
$('#faq-list').innerHTML = FAQ.map(([q, a]) => `<details><summary>${esc(q)}<span aria-hidden="true">+</span></summary><p>${esc(a)}</p></details>`).join('');
$('#review-content').innerHTML = REVIEW;

function renderMaterials() {
  const terms = normalizeSearch($('#material-search').value).split(/\s+/).filter(Boolean);
  const items = MATERIALS.filter(item => terms.every(term => normalizeSearch([item.title, item.description, ...item.paragraphs].join(' ')).includes(term)));
  $('#material-grid').innerHTML = items.map((item, i) => `<a class="material-card" href="#materials/${item.id}"><span class="eyebrow">${esc(item.category)}</span><h2>${esc(item.title)}</h2><p>${esc(item.description)}</p><span class="text-link">Читать материал <span>↗</span></span></a>`).join('');
  $('#material-empty').hidden = items.length > 0;
}
$('#material-search').addEventListener('input', renderMaterials);
$('#reset-material-search').addEventListener('click', () => { $('#material-search').value = ''; renderMaterials(); $('#material-search').focus(); });
renderMaterials();

$('#gallery-grid').innerHTML = GALLERY.map((item, i) => `<button class="gallery-card" data-gallery="${i}" aria-label="Открыть: ${esc(item.title)}"><img src="${item.src}" width="${item.width}" height="${item.height}" alt="${esc(item.alt)} — игровая иллюстрация" loading="lazy" decoding="async"><span><strong>${esc(item.title)}</strong><small>Игровая иллюстрация</small></span><b aria-hidden="true">↗</b></button>`).join('');
function showGallery(index, open = false) {
  galleryIndex = (index + GALLERY.length) % GALLERY.length;
  const item = GALLERY[galleryIndex];
  $('#lightbox-image').src = item.src; $('#lightbox-image').alt = item.alt + ' — игровая иллюстрация';
  $('#lightbox-image').width = item.width; $('#lightbox-image').height = item.height;
  $('#lightbox-image').hidden = false;
  $('#lightbox-title').textContent = item.title; $('#lightbox-counter').textContent = `${galleryIndex + 1} / ${GALLERY.length}`;
  if (open && !$('#lightbox').open) $('#lightbox').showModal();
}
$('#gallery-grid').addEventListener('click', e => { const b = e.target.closest('[data-gallery]'); if (b) showGallery(Number(b.dataset.gallery), true); });
$('#lightbox-close').addEventListener('click', () => $('#lightbox').close());
$('#lightbox-prev').addEventListener('click', () => showGallery(galleryIndex - 1));
$('#lightbox-next').addEventListener('click', () => showGallery(galleryIndex + 1));
$('#lightbox').addEventListener('click', e => { if (e.target === $('#lightbox')) $('#lightbox').close(); });
$('#lightbox').addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); showGallery(galleryIndex + (e.key === 'ArrowLeft' ? -1 : 1)); } });

function quantityControl(item, quantity, context) {
  return `<div class="quantity" role="group" aria-label="Количество: ${esc(item.name)}"><button data-adjust="-1" data-id="${item.id}" data-context="${context}" aria-label="Уменьшить: ${esc(item.name)}" ${quantity <= 1 ? 'disabled' : ''}>−</button><input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="14" value="${quantity}" data-quantity="${item.id}" data-context="${context}" aria-label="Количество: ${esc(item.name)}" title="Целое число от 1 до 99 999"><button data-adjust="1" data-id="${item.id}" data-context="${context}" aria-label="Увеличить: ${esc(item.name)}" ${quantity >= MAX_QUANTITY ? 'disabled' : ''}>+</button></div>`;
}
function renderCatalog() {
  const items = filterCatalog(CATALOG, selection, { ...filters, favorites });
  $('#all-count').textContent = CATALOG.length;
  $('#result-count').textContent = `Найдено ${items.length} из ${CATALOG.length} предметов`;
  $('#empty-results').hidden = items.length > 0;
  $('#empty-catalog-message').textContent = filters.confirmedOnly ? 'Подтверждённых рецептов ФСБ пока нет. Снимите этот фильтр, чтобы открыть справочные рецепты ГИБДД.' : filters.favoritesOnly ? 'Добавьте предметы в избранное с помощью звезды или измените остальные фильтры.' : filters.selectedOnly ? 'Добавьте предметы в расчёт или измените остальные фильтры.' : 'Попробуйте другое название или сбросьте фильтры.';
  $('#craft-grid').innerHTML = items.map(item => {
    const quantity = selection[item.id] || 0, favorite = favorites.includes(item.id);
    return `<article class="craft-card${quantity ? ' selected' : ''}" data-card="${item.id}"><div class="craft-image"><span class="category-mark ${item.category}">${CATEGORIES[item.category]}</span><img src="${item.image}" alt="${esc(item.name)}" width="180" height="105" loading="lazy"><button class="favorite ${favorite ? 'active' : ''}" data-favorite="${item.id}" aria-pressed="${favorite}" aria-label="${favorite ? 'Убрать из избранного' : 'В избранное'}: ${esc(item.name)}">${favorite ? '★' : '☆'}</button></div><div class="craft-card-body"><h2>${esc(item.name)}</h2><div class="craft-recipe">${Object.entries(recipeOf(item)).map(([type, cost]) => `<span><b>${number.format(cost)}</b> ${CATEGORIES[type].toLowerCase()} мат.</span>`).join('')}</div><div class="craft-meta"><span>${formatWeight(item.weightGrams)}</span><span title="Доступность на складе ФСБ не подтверждена">${item.fsbVerified ? 'Подтверждено ФСБ' : 'Рецепт ГИБДД'}</span></div>${quantity ? quantityControl(item, quantity, 'catalog') : `<button class="add-item" data-add="${item.id}" aria-label="Добавить: ${esc(item.name)}">+ Добавить</button>`}</div></article>`;
  }).join('');
}
function renderCart() {
  const summary = calculate(CATALOG, selection);
  $('#cart-empty').hidden = summary.rows.length > 0; $('#cart-content').hidden = summary.rows.length === 0;
  $('#cart-count').textContent = summary.rows.length; $('#cart-count').setAttribute('aria-label', `${summary.rows.length} позиций`);
  $('#cart-items').innerHTML = summary.rows.map(item => `<div class="cart-row"><div class="cart-row-info"><h3>${esc(item.name)}</h3><span>${item.weightGrams == null ? 'Вес не указан' : formatWeight(item.weightGrams * item.quantity)}</span></div>${quantityControl(item, item.quantity, 'cart')}<button class="remove-item" data-remove="${item.id}" aria-label="Удалить: ${esc(item.name)}">×</button></div>`).join('');
  $('#cart-materials').innerHTML = Object.entries(summary.materials).map(([type, value]) => `<div class="cart-material-line ${value ? '' : 'zero'}"><span><i class="material-dot ${type}"></i>${CATEGORIES[type]}</span><strong>${number.format(value)}</strong></div>`).join('');
  $('#weight-label').textContent = summary.completeWeight ? 'Общий вес' : 'Известный вес'; $('#total-weight').textContent = formatWeight(summary.weightGrams);
  $('#weight-warning').hidden = summary.completeWeight; $('#weight-warning').textContent = `Вес неполный: не указан для ${number.format(summary.unknownWeightCount)} предметов.`;
  $('#total-items').textContent = `Предметов: ${number.format(summary.count)} · Позиций: ${summary.rows.length}`;
  $('#mobile-cart-count').textContent = number.format(summary.count); $('#mobile-cart-weight').textContent = `${summary.completeWeight ? '' : 'от '}${formatWeight(summary.weightGrams)}`;
}
function focusSnapshot() {
  const active = document.activeElement;
  if (!active?.matches('[data-quantity]')) return null;
  return { id: active.dataset.quantity, context: active.dataset.context, start: active.selectionStart, end: active.selectionEnd };
}
function setQuantity(id, value, preserve = false) {
  if (!byId.has(id)) return;
  const focus = preserve ? focusSnapshot() : null, quantity = clampQuantity(value);
  if (quantity) selection[id] = quantity; else delete selection[id];
  persist(STORAGE_KEY, selection); renderCatalog(); renderCart();
  if (focus && quantity) {
    const field = $(`[data-quantity="${focus.id}"][data-context="${focus.context}"]`);
    if (field) { field.focus({ preventScroll: true }); field.setSelectionRange(Math.min(focus.start ?? field.value.length, field.value.length), Math.min(focus.end ?? field.value.length, field.value.length)); }
  }
}
function commitInput(input) {
  const raw = input.value, old = selection[input.dataset.quantity] || 1, quantity = normalizeQuantity(raw, old);
  const cleaned = raw.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
  setQuantity(input.dataset.quantity, quantity, true);
  if (!/^\d+$/.test(cleaned) || Number(cleaned) > MAX_QUANTITY || Number(cleaned) < 1) toast(`Количество: ${number.format(quantity)}. Допустимы целые числа от 1 до 99 999.`);
}
document.addEventListener('input', e => {
  const input = e.target.closest('[data-quantity]'); if (!input) return;
  if (/^\d[\d\s\u00a0\u202f]*$/.test(input.value) && clampQuantity(input.value) > 0) {
    const raw = input.value; setQuantity(input.dataset.quantity, clampQuantity(raw), true);
    if (Number(raw.replace(/\s/g, '')) > MAX_QUANTITY) toast('Максимум — 99 999 на одну позицию.');
  }
});
document.addEventListener('change', e => { const input = e.target.closest('[data-quantity]'); if (input) commitInput(input); });
document.addEventListener('keydown', e => {
  const input = e.target.closest('[data-quantity]');
  if (input && e.key === 'Enter') { e.preventDefault(); commitInput(input); }
  if (input && ['ArrowUp', 'ArrowDown'].includes(e.key)) { e.preventDefault(); setQuantity(input.dataset.quantity, Math.max(1, Math.min(MAX_QUANTITY, (selection[input.dataset.quantity] || 1) + (e.key === 'ArrowUp' ? 1 : -1))), true); }
});
document.addEventListener('click', e => {
  const skip = e.target.closest('.skip-link'); if (skip) { e.preventDefault(); $('#content').focus(); return; }
  const add = e.target.closest('[data-add]');
  if (add) { const id = add.dataset.add; setQuantity(id, (selection[id] || 0) + 1); $(`[data-quantity="${id}"][data-context="catalog"]`)?.focus({ preventScroll: true }); return; }
  const adjust = e.target.closest('[data-adjust]');
  if (adjust) { const { id, context } = adjust.dataset; setQuantity(id, Math.max(1, Math.min(MAX_QUANTITY, (selection[id] || 1) + Number(adjust.dataset.adjust)))); $(`[data-quantity="${id}"][data-context="${context}"]`)?.focus({ preventScroll: true }); return; }
  const remove = e.target.closest('[data-remove]'); if (remove) { setQuantity(remove.dataset.remove, 0); $('#cart-title').focus({ preventScroll: true }); return; }
  const favorite = e.target.closest('[data-favorite]');
  if (favorite) { const id = favorite.dataset.favorite; favorites = favorites.includes(id) ? favorites.filter(x => x !== id) : [...favorites, id]; persist(FAVORITES_KEY, favorites); renderCatalog(); ($(`[data-favorite="${id}"]`) || $('#favorites-only')).focus({ preventScroll: true }); return; }
});
$('#craft-search').addEventListener('input', e => { filters.query = e.target.value; renderCatalog(); });
$('#craft-sort').addEventListener('change', e => { filters.sort = e.target.value; renderCatalog(); });
for (const [id, option] of [['favorites-only','favoritesOnly'],['selected-only','selectedOnly'],['confirmed-only','confirmedOnly']]) $( '#'+id).addEventListener('change', e => { filters[option] = e.target.checked; renderCatalog(); });
$$('[data-category]').forEach(button => button.addEventListener('click', () => { filters.category = button.dataset.category; $$('[data-category]').forEach(b => { const active = b === button; b.classList.toggle('active', active); b.setAttribute('aria-pressed', String(active)); }); renderCatalog(); }));
$('#reset-filters').addEventListener('click', () => { Object.assign(filters, {category:'all',query:'',sort:'default',selectedOnly:false,favoritesOnly:false,confirmedOnly:false}); $('#craft-search').value = ''; $('#craft-sort').value = 'default'; for (const id of ['selected-only','favorites-only','confirmed-only']) $('#'+id).checked = false; $$('[data-category]').forEach(b => { const active = b.dataset.category === 'all'; b.classList.toggle('active', active); b.setAttribute('aria-pressed', String(active)); }); renderCatalog(); $('#craft-search').focus(); });
$('#clear-cart').addEventListener('click', () => { selection = {}; persist(STORAGE_KEY, selection); renderCatalog(); renderCart(); $('#cart-title').focus(); toast('Расчёт очищен'); });
$('#copy-list').addEventListener('click', async () => { const text = makeText(calculate(CATALOG, selection)); try { await navigator.clipboard.writeText(text); toast('Расчёт скопирован'); } catch { $('#copy-text').value = text; $('#copy-dialog').showModal(); $('#copy-text').focus(); $('#copy-text').select(); } });
function download(blob, extension) { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `fsb-raschet-${new Date().toISOString().slice(0,10)}.${extension}`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 15000); }
$('#export-txt').addEventListener('click', () => download(new Blob(['\uFEFF'+makeText(calculate(CATALOG,selection))], {type:'text/plain;charset=utf-8'}), 'txt'));
$('#export-png').addEventListener('click', async e => {
  const button = e.currentTarget; button.disabled = true;
  try { const canvas = drawExport(document.createElement('canvas'), calculate(CATALOG,selection)); const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/png')); if (!blob) throw new Error('PNG encoding failed'); download(blob,'png'); toast('Расчёт сохранён в PNG'); }
  catch { toast('Не удалось создать изображение. Сохраните TXT или скопируйте расчёт.'); }
  finally { button.disabled = false; }
});

function setCartOpen(open, restoreFocus = true) {
  open = open && mobile() && activePage === 'crafts';
  document.body.classList.toggle('cart-open',open); $('#cart-backdrop').hidden = !open;
  if (open) { $('#cart').setAttribute('role','dialog'); $('#cart').setAttribute('aria-modal','true'); $('#cart-title').focus({preventScroll:true}); }
  else { $('#cart').removeAttribute('role'); $('#cart').removeAttribute('aria-modal'); if (restoreFocus && mobile() && activePage === 'crafts') $('#mobile-cart-link').focus({preventScroll:true}); }
}
$('#mobile-cart-link').addEventListener('click',()=>setCartOpen(true)); $('#close-cart').addEventListener('click',()=>setCartOpen(false)); $('#cart-backdrop').addEventListener('click',()=>setCartOpen(false));
window.addEventListener('resize',()=> { if(!mobile()) setCartOpen(false,false); });
function closeMenu(focus = false) { $('#navigation').classList.remove('open'); $('#menu-toggle').setAttribute('aria-expanded','false'); $('#menu-toggle').setAttribute('aria-label','Открыть меню'); if(focus) $('#menu-toggle').focus(); }
$('#menu-toggle').addEventListener('click',()=>{ const open = $('#menu-toggle').getAttribute('aria-expanded') !== 'true'; $('#navigation').classList.toggle('open',open); $('#menu-toggle').setAttribute('aria-expanded',String(open)); $('#menu-toggle').setAttribute('aria-label',open?'Закрыть меню':'Открыть меню'); if(open) $('#navigation a').focus(); });
document.addEventListener('keydown',e=>{
  if(e.key === 'Escape' && document.querySelector('dialog[open]')) return;
  if(e.key === 'Escape') { if(document.body.classList.contains('cart-open')) setCartOpen(false); else if($('#navigation').classList.contains('open')) closeMenu(true); }
  if(e.key !== 'Tab') return;
  let elements;
  if(document.body.classList.contains('cart-open') && !document.querySelector('dialog[open]')) elements=$$('#cart button:not([disabled]), #cart input');
  else if($('#navigation').classList.contains('open')) elements=[$('#menu-toggle'),...$$('#navigation a')];
  if(!elements?.length) return;
  const first=elements[0],last=elements[elements.length-1];
  if(e.shiftKey && (document.activeElement===first || document.activeElement===$('#cart-title'))) {e.preventDefault();last.focus();}
  else if(!e.shiftKey && document.activeElement===last) {e.preventDefault();first.focus();}
});
const titles={home:'Главная',about:'О службе',divisions:'Подразделения',ranks:'Звания',crafts:'Крафты',materials:'Материалы сотрудника',gallery:'Галерея',join:'Вступление',faq:'Частые вопросы',review:'Источники и уточнения',notfound:'Раздел не найден'};
function route(initial=false) {
  const hash=location.hash.slice(1)||'home', parts=hash.split('/');
  let page=parts[0]; if(page==='structure')page='divisions'; if(page==='cart')page='crafts'; if(page==='home-brief')page='home';
  if(!Object.hasOwn(titles,page))page='notfound';
  activePage=page; document.body.dataset.page=page;
  $$('[data-page]').forEach(section=>section.hidden=section.dataset.page!==page);
  document.title=page==='home'?'ФСБ | Россия Онлайн':`${titles[page]} · ФСБ | Россия Онлайн`;
  $$('a[href^="#"]').forEach(link=>{const active=link.hash==='#'+page;link.classList.toggle('active',active);if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
  closeMenu();setCartOpen(false,false);if($('#lightbox').open)$('#lightbox').close();
  if(page==='materials') {
    const id=parts[1], item=MATERIALS.find(x=>x.id===id);
    $('#material-detail').hidden=!id;$('#material-grid').hidden=!!id;$('.material-search').hidden=!!id;
    $('#material-empty').hidden=!!id;
    if(id) $('#material-detail').innerHTML=item?`<a class="text-link" href="#materials">← Все материалы</a><div class="eyebrow">${esc(item.category)}</div><h2 tabindex="-1">${esc(item.title)}</h2>${item.paragraphs.map(text=>`<p>${esc(text)}</p>`).join('')}${item.link?`<a href="${item.link[0]}" class="button primary">${esc(item.link[1])}</a>`:''}`:'<h2 tabindex="-1">Материал не найден</h2><p>Проверьте адрес или вернитесь к списку.</p><a href="#materials" class="button outline">Все материалы</a>';
    else renderMaterials();
  }
  if(hash==='home-brief') requestAnimationFrame(()=>$('#home-brief').scrollIntoView({behavior:reducedMotion()?'instant':'smooth'}));
  else { window.scrollTo({top:0,behavior:'instant'}); if(!initial) (page==='materials'&&parts[1]?$('#material-detail h2'):$(`[data-page="${page}"] h1`))?.focus({preventScroll:true}); }
  if(hash==='cart')setCartOpen(true);
}
document.addEventListener('click',e=>{ const a=e.target.closest('a[href^="#"]'); if(a && a.hash===location.hash && a.hash!=='#content') {e.preventDefault();route();} });
window.addEventListener('hashchange',()=>route());
window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY||e.key===null){try{selection=sanitizeSelection(JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}'),CATALOG);}catch{selection={};}}if(e.key===FAVORITES_KEY||e.key===null){try{favorites=sanitizeFavorites(JSON.parse(localStorage.getItem(FAVORITES_KEY)||'[]'),CATALOG);}catch{favorites=[];}}renderCatalog();renderCart();});
document.addEventListener('error',e=>{const img=e.target;if(img?.tagName!=='IMG')return;if(img.id==='lightbox-image'){$('#lightbox-title').textContent='Не удалось загрузить изображение';return;}img.hidden=true;const fallback=document.createElement('span');fallback.className='image-fallback';fallback.textContent='Изображение недоступно';img.parentElement.append(fallback);},true);
if('IntersectionObserver' in window && !reducedMotion()) {document.documentElement.classList.add('js-motion');const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target);}}),{threshold:.06});$$('.reveal').forEach(el=>observer.observe(el));}
renderCatalog();renderCart();route(true);if(storageMessage)toast(storageMessage);
