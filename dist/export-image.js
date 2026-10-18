import { CATEGORIES, number, formatWeight, recipeOf } from './core.js';
function wrap(ctx, text, maxWidth) {
  const lines = []; let current = '';
  for (const word of text.split(/\s+/)) {
    const candidate = current ? current + ' ' + word : word;
    if (ctx.measureText(candidate).width <= maxWidth) { current = candidate; continue; }
    if (current) lines.push(current); current = '';
    for (const character of word) {
      if (ctx.measureText(current + character).width > maxWidth && current) { lines.push(current); current = ''; }
      current += character;
    }
  }
  if (current) lines.push(current);
  return lines;
}
export function drawExport(canvas, summary) {
  let ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas unavailable');
  ctx.font = '18px Arial, sans-serif';
  const rows = summary.rows.map(item => ({ item, lines: wrap(ctx, item.name, 490) }));
  const rowHeights = rows.map(r => Math.max(74, r.lines.length * 26 + 35));
  canvas.width = 1200; canvas.height = 280 + rowHeights.reduce((sum, h) => sum + h, 0) + 260;
  ctx = canvas.getContext('2d'); const w = canvas.width, h = canvas.height;
  ctx.fillStyle = '#111315'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#c54349'; ctx.fillRect(0, 0, w, 8);
  ctx.fillStyle = '#bbaa91'; ctx.font = '16px Arial, sans-serif'; ctx.fillText('ФСБ / РОССИЯ ОНЛАЙН', 48, 56);
  ctx.fillStyle = '#f2efea'; ctx.font = 'bold 40px Arial, sans-serif'; ctx.fillText('Расчёт снаряжения', 48, 115);
  ctx.fillStyle = '#aaa9ac'; ctx.font = '16px Arial, sans-serif';
  ctx.fillText('Справочные рецепты ГИБДД. Доступность и рецепты ФСБ требуют подтверждения.', 48, 157);
  ctx.font = '13px Arial, sans-serif'; ctx.fillText('ПРЕДМЕТ', 48, 218); ctx.fillText('КОЛИЧЕСТВО', 565, 218); ctx.fillText('МАТЕРИАЛЫ', 728, 218); ctx.fillText('ВЕС', 1020, 218);
  let y = 244;
  rows.forEach(({item, lines}, index) => {
    ctx.fillStyle = '#333237'; ctx.fillRect(48, y, 1104, 1);
    ctx.fillStyle = '#f2efea'; ctx.font = '18px Arial, sans-serif'; lines.forEach((line, i) => ctx.fillText(line, 48, y + 31 + 26 * i));
    ctx.fillStyle = '#c7bba9'; ctx.fillText(number.format(item.quantity), 565, y + 31);
    Object.entries(recipeOf(item)).forEach(([type, cost], i) => { ctx.font = '14px Arial, sans-serif'; ctx.fillText(`${CATEGORIES[type]}: ${number.format(cost * item.quantity)}`, 728, y + 26 + 19 * i); });
    ctx.font = '14px Arial, sans-serif'; ctx.fillStyle = '#b6b4b7';
    ctx.fillText(item.weightGrams == null ? 'Не указан' : formatWeight(item.weightGrams * item.quantity), 1010, y + 31);
    y += rowHeights[index];
  });
  y += 28; ctx.fillStyle = '#333237'; ctx.fillRect(48, y, 1104, 1);
  Object.entries(summary.materials).forEach(([type, value], i) => {
    ctx.fillStyle = '#aaa9ac'; ctx.font = '17px Arial, sans-serif'; ctx.fillText(`${CATEGORIES[type]} материалы`, 48, y + 38 + 34 * i);
    ctx.fillStyle = '#f2efea'; ctx.fillText(number.format(value), 400, y + 38 + 34 * i);
  });
  ctx.fillStyle = '#bbaa91'; ctx.font = '14px Arial, sans-serif'; ctx.fillText(summary.completeWeight ? 'ОБЩИЙ ВЕС' : 'ИЗВЕСТНЫЙ ВЕС', 760, y + 36);
  ctx.fillStyle = '#f2efea'; ctx.font = 'bold 29px Arial, sans-serif'; ctx.fillText(formatWeight(summary.weightGrams), 760, y + 78);
  ctx.font = '15px Arial, sans-serif'; ctx.fillText(`Предметов: ${number.format(summary.count)} · Позиций: ${summary.rows.length}`, 48, y + 151);
  if (!summary.completeWeight) { ctx.fillStyle = '#eea288'; ctx.font = '14px Arial, sans-serif'; ctx.fillText(`Вес неполный: не указан для ${number.format(summary.unknownWeightCount)} предметов.`, 48, y + 181); }
  ctx.fillStyle = '#99959a'; ctx.font = '12px Arial, sans-serif'; ctx.fillText('Портал игровой фракции · ФСБ | Россия Онлайн', 48, h - 27);
  return canvas;
}
