/** Разбор списка MCC: только целые 1…99999, мусор — понятная ошибка. */
export function parseMccList(text, field) {
  const out = [];
  for (const raw of String(text ?? '').split(',')) {
    const s = raw.trim();
    if (!s) continue;
    const n = Number(s);
    if (!Number.isInteger(n) || n < 1 || n > 99999)
      throw new Error(`${field}: «${s}» — не MCC-код (целое число 1…99999)`);
    if (!out.includes(n)) out.push(n);
  }
  return out;
}
