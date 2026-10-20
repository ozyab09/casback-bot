// lib/importExport.js — экспорт/импорт данных (формат spec 3 из ТЗ).
import { db } from 'sdk';
import { eq } from 'sdk/db';
import { banks, cards, categories, places } from '../schema.js';
import {
  getSummary, wipeUser, saveBank, saveCard, saveCategory, savePlace,
} from './repository.js';
import { ValidationError } from './validation.js';

export const SPEC_VERSION = 3;

export async function exportData(userId) {
  const summary = await getSummary(userId);
  const out = { spec: SPEC_VERSION, user: String(userId), banks: [], places: summary.places };
  for (const bank of summary.banks) {
    out.banks.push({
      name: bank.name,
      cards: bank.cards.map((c) => ({
        name: c.name, last4: c.last4 ?? undefined, holder: c.holder ?? undefined,
        monthlyLimit: c.monthlyLimit ?? undefined, limitLeft: c.limitLeft ?? undefined,
        note: c.note ?? undefined,
      })),
      categories: bank.categories.map((k) => ({
        name: k.name, percent: k.percent, mcc: k.mcc, excluded: k.excludedMcc,
        isAll: k.isAll, note: k.note ?? undefined,
      })),
    });
  }
  return out;
}

/** Валидация загружаемого документа, возврат нормализованного объекта. */
function parseSpec(data) {
  if (!data || typeof data !== 'object') throw new ValidationErrorX('Ожидается JSON-объект');
  if (data.spec !== SPEC_VERSION) throw new ValidationErrorX(`Неподдерживаемая версия формата: ${JSON.stringify(data.spec)} (ждём ${SPEC_VERSION})`);
  if (!Array.isArray(data.banks)) throw new ValidationErrorX('banks: ожидается массив');
  if (data.places != null && !Array.isArray(data.places)) throw new ValidationErrorX('places: ожидается массив');
  return data;
}

const ValidationErrorX = ValidationError;

/**
 * mode 'replace' — стираем всё своё и заливаем документ как есть.
 * mode 'merge'   — импортируем поверх: банки/карты/категории/точки с теми же
 *                  именами не дублируем, а обновляем.
 */
export async function importData(userId, { mode, data }) {
  if (mode !== 'replace' && mode !== 'merge') throw new ValidationErrorX(`mode: «replace» или «merge», получено «${mode}»`);
  const spec = parseSpec(data);

  if (mode === 'replace') await wipeUser(userId);

  const bankByName = new Map();
  await loadExisting(userId, bankByName);

  for (const bankSpec of spec.banks) {
    if (!bankSpec || typeof bankSpec !== 'object' || !bankSpec.name) throw new ValidationErrorX('Банк без имени в документе');
    let bankId = bankByName.get(String(bankSpec.name).trim());
    if (!bankId) {
      bankId = await saveBank(userId, { name: bankSpec.name });
      bankByName.set(String(bankSpec.name).trim(), bankId);
    }

    for (const cardSpec of bankSpec.cards ?? []) {
      if (cardSpec.monthlyLimit != null && (typeof cardSpec.monthlyLimit !== 'number' || cardSpec.monthlyLimit < 0))
        throw new ValidationErrorX(`Карта «${cardSpec.name}»: monthlyLimit должен быть неотрицательным числом`);
      if (cardSpec.last4 != null && (!/^\d{4}$/.test(String(cardSpec.last4))))
        throw new ValidationErrorX(`Карта «${cardSpec.name}»: last4 — ровно 4 цифры`);
      await saveCard(userId, { bankId, ...(cardSpec) });
    }
    for (const catSpec of bankSpec.categories ?? []) {
      if (typeof catSpec?.percent !== 'number') throw new ValidationErrorX(`Категория «${catSpec?.name}»: percent обязателен`);
      if (!Array.isArray(catSpec.mcc) || catSpec.mcc.some((m) => !Number.isInteger(m)))
        throw new ValidationErrorX(`Категория «${catSpec?.name}»: mcc — массив целых чисел`);
      await saveCategory(userId, {
        bankId, name: catSpec.name, percent: catSpec.percent,
        mcc: catSpec.mcc, excludedMcc: catSpec.excluded ?? [],
        isAll: Boolean(catSpec.isAll), note: catSpec.note ?? null,
      });
    }
  }
  for (const placeSpec of spec.places ?? []) {
    if (!placeSpec?.name || !Number.isInteger(placeSpec.mcc)) throw new ValidationErrorX('Точки: name и integer mcc обязательны');
    await savePlace(userId, { name: placeSpec.name, mcc: placeSpec.mcc, note: placeSpec.note ?? null });
  }
  return getSummary(userId);
}

/** Карта существующих (merge-режим): имя банка → id. */
async function loadExisting(userId, bankByName) {
  const rows = await db.select().from(banks).where(eq(banks.userId, userId)).all();
  for (const b of rows) bankByName.set(String(b.name).trim(), b.id);
}
