export const MAX_QUANTITY = 99999;
export const CATEGORIES = { weapon: 'Оружейные', technical: 'Технические', medical: 'Медицинские' };
export const STORAGE_KEY = 'fsb-ro-loadout-v1';
export const FAVORITES_KEY = 'fsb-ro-favorites-v1';
export const number = new Intl.NumberFormat('ru-RU');
export function clampQuantity(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return 0;
  const text = String(value).replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(text)) return 0;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(MAX_QUANTITY, Math.floor(parsed))) : 0;
}
export function normalizeQuantity(value, fallback = 1) {
  const text = String(value).trim().replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
  if (text === '' || /^-\d+(?:\.\d+)?$/.test(text)) return 1;
  if (!/^\d+(?:\.\d+)?$/.test(text)) return Math.max(1, clampQuantity(fallback));
  return Math.max(1, clampQuantity(value));
}
export function sanitizeSelection(raw, catalog) {
  const result = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return result;
  for (const item of catalog) {
    if (!Object.hasOwn(raw, item.id)) continue;
    const quantity = clampQuantity(raw[item.id]);
    if (quantity) result[item.id] = quantity;
  }
  return result;
}
export function sanitizeFavorites(raw, catalog) {
  if (!Array.isArray(raw)) return [];
  const ids = new Set(catalog.map(i => i.id));
  return [...new Set(raw.filter(id => typeof id === 'string' && ids.has(id)))];
}
export function recipeOf(item) { return item.recipe || { [item.category]: item.materials }; }
export function calculate(catalog, selection) {
  const materials = Object.fromEntries(Object.keys(CATEGORIES).map(key => [key, 0]));
  const rows = [];
  let weightGrams = 0, count = 0, unknownWeightCount = 0;
  for (const item of catalog) {
    const quantity = clampQuantity(selection[item.id]);
    if (!quantity) continue;
    rows.push({ ...item, quantity }); count += quantity;
    if (Number.isSafeInteger(item.weightGrams) && item.weightGrams >= 0) weightGrams += item.weightGrams * quantity;
    else unknownWeightCount += quantity;
    for (const [type, cost] of Object.entries(recipeOf(item))) {
      if (Object.hasOwn(materials, type) && Number.isFinite(cost) && cost >= 0) materials[type] += cost * quantity;
    }
  }
  return { materials, weightGrams, count, rows, unknownWeightCount, completeWeight: unknownWeightCount === 0 };
}
export function formatWeight(grams) {
  if (grams === null || grams === undefined || !Number.isFinite(grams)) return 'Вес не указан';
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 }).format(grams / 1000) + ' кг';
}
export function normalizeSearch(value) { return String(value).toLocaleLowerCase('ru').replaceAll('ё', 'е').replace(/[«»„“”]/g, '').replace(/[‐‑–—]/g, '-').trim(); }
export function filterCatalog(catalog, selection, options = {}) {
  const terms = normalizeSearch(options.query || '').split(/\s+/).filter(Boolean);
  const favorites = new Set(options.favorites || []);
  const rows = catalog.filter(item =>
    (!options.category || options.category === 'all' || item.category === options.category) &&
    (!options.selectedOnly || clampQuantity(selection[item.id]) > 0) &&
    (!options.favoritesOnly || favorites.has(item.id)) &&
    (!options.confirmedOnly || item.fsbVerified === true) &&
    terms.every(term => normalizeSearch(item.name).includes(term))
  );
  if (options.sort === 'name') rows.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  if (options.sort === 'cost') rows.sort((a, b) => Object.values(recipeOf(a)).reduce((s,x)=>s+x,0) - Object.values(recipeOf(b)).reduce((s,x)=>s+x,0));
  if (options.sort === 'weight') rows.sort((a, b) => (a.weightGrams ?? Infinity) - (b.weightGrams ?? Infinity));
  return rows;
}
export function makeText(summary) {
  return ['ФСБ | Россия Онлайн — расчёт', 'Справочные рецепты ГИБДД. Доступность и рецепты ФСБ требуют подтверждения.', '',
    ...summary.rows.map(item => `${item.name} × ${number.format(item.quantity)}\n  ${Object.entries(recipeOf(item)).map(([type, cost]) => `${CATEGORIES[type]}: ${number.format(cost * item.quantity)}`).join('; ')} · ${item.weightGrams == null ? 'Вес не указан' : formatWeight(item.weightGrams * item.quantity)}`),
    '', 'МАТЕРИАЛЫ:', ...Object.entries(summary.materials).map(([type, total]) => `${CATEGORIES[type]}: ${number.format(total)}`),
    `${summary.completeWeight ? 'Общий вес' : 'Известный вес'}: ${formatWeight(summary.weightGrams)}`,
    ...(summary.completeWeight ? [] : [`Расчёт веса неполный: вес ${number.format(summary.unknownWeightCount)} предметов не указан.`]),
    `Предметов: ${number.format(summary.count)} · Позиций: ${summary.rows.length}`].join('\n');
}
