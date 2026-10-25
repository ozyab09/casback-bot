// lib/validation.js — проверка входных данных эндпоинтов.
// Кидаются ValidationError; эндпоинты переводят их в EndpointError (400).
export class ValidationError extends Error {}

const ind = (v) => typeof v === 'number' && Number.isInteger(v);

export function reqText(v, field, max = 100) {
  if (typeof v !== 'string' || !v.trim()) throw new ValidationError(`${field}: требуется непустая строка`);
  if (v.length > max) throw new ValidationError(`${field}: дольше ${max} символов`);
  return v.trim();
}

export function optText(v, field, max = 500) {
  if (v == null) return null;
  if (typeof v !== 'string') throw new ValidationError(`${field}: должна быть строка`);
  if (v.length > max) throw new ValidationError(`${field}: дольше ${max} символов`);
  return v.trim() || null;
}

export function reqInt(v, field, min = -Infinity, max = Infinity) {
  if (!ind(v)) throw new ValidationError(`${field}: требуется целое число`);
  if (v < min || v > max) throw new ValidationError(`${field}: допустимо от ${min} до ${max}`);
  return v;
}

export function optInt(v, field, min = -Infinity, max = Infinity) {
  if (v == null || v === '') return null;
  return reqInt(v, field, min, max);
}

/** Список MCC-кодов: массив целых 1..99999; нормализуем строки к числам и дедупим. */
export function mccList(v, field) {
  if (v == null) return [];
  if (!Array.isArray(v)) throw new ValidationError(`${field}: ожидается массив MCC-кодов`);
  const out = [];
  for (const item of v) {
    let n = item;
    if (typeof n === 'string' && /^\s*\d+\s*$/.test(n)) n = Number(n.trim());
    if (!ind(n) || n < 1 || n > 99999) throw new ValidationError(`${field}: MCC-код «${item}» не число 1..99999`);
    if (!out.includes(n)) out.push(n);
  }
  return out;
}

/** Один MCC-код: число или числовая строка, целое 1..99999.
 *  Отвергает строки с leading/trailing whitespace.
 */
export function mccCode(v, field) {
  if (typeof v === 'string') {
    if (!/^\d+$/.test(v)) {
      // Check if it's just whitespace
      if (/^\s*$/.test(v)) throw new ValidationError(`${field}: MCC-код не может быть пустой строкой`);
      throw new ValidationError(`${field}: «${v}» не MCC-код (целое число 1..99999 без пробелов)`);
    }
    const n = Number(v);
    if (!ind(n) || n < 1 || n > 99999) throw new ValidationError(`${field}: «${v}» не MCC-код (целое 1..99999)`);
    return n;
  }
  if (!ind(v) || v < 1 || v > 99999) throw new ValidationError(`${field}: «${v}» не MCC-код (целое 1..99999)`);
  return v;
}

export function bool(v, field) {
  if (typeof v !== 'boolean') throw new ValidationError(`${field}: ожидается boolean`);
  return v;
}