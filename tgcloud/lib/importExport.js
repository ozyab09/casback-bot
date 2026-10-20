// lib/importExport.js — экспорт/импорт данных (формат spec 3 из ТЗ).
import { db } from 'sdk';
import { eq } from 'sdk/db';
import { banks, cards, categories, places } from '../schema.js';
import {
  getSummary, wipeUser, saveBank, saveCard, saveCategory, savePlace,
} from './repository.js';
import { ValidationError, mccList, mccCode } from './validation.js';

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
  if (!data || typeof data !== 'object') throw new ValidationError('Ожидается JSON-объект');
  if (data.spec !== SPEC_VERSION) throw new ValidationError(`Неподдерживаемая версия формата: ${JSON.stringify(data.spec)} (ждём ${SPEC_VERSION})`);
  if (!Array.isArray(data.banks)) throw new ValidationError('banks: ожидается массив');
  if (data.places != null && !Array.isArray(data.places)) throw new ValidationError('places: ожидается массив');
  return data;
}

/**
 * mode 'replace' — стираем всё своё и заливаем документ как есть.
 * mode 'merge'   — импортируем поверх: банки/карты/категории/точки с теми же
 *                  именами не дублируем, а обновляем (#21: ключи поиска по id).
 *
 * Ключи сопоставления:
 *  - банк       — по имени;
 *  - карта      — по (банк, название, последние 4 цифры): в одном банке могут
 *                 быть одноимённые карты с разными последними цифрами;
 *  - категория  — по (банк, название);
 *  - точка      — по названию.
 */
export async function importData(userId, { mode, data }) {
  if (mode !== 'replace' && mode !== 'merge') throw new ValidationError(`mode: «replace» или «merge», получено «${mode}»`);
  const spec = parseSpec(data);

  if (mode === 'replace') await wipeUser(userId);

  const index = await loadExisting(userId);
  const merge = mode === 'merge';

  for (const bankSpec of spec.banks) {
    if (!bankSpec || typeof bankSpec !== 'object' || !bankSpec.name) throw new ValidationError('Банк без имени в документе');
    const bankName = String(bankSpec.name).trim();
    let bankId = index.bankByName.get(bankName);
    if (!bankId) {
      bankId = await saveBank(userId, { name: bankName });
      index.bankByName.set(bankName, bankId);
    }

    for (const cardSpec of bankSpec.cards ?? []) {
      if (cardSpec.monthlyLimit != null && (typeof cardSpec.monthlyLimit !== 'number' || cardSpec.monthlyLimit < 0))
        throw new ValidationError(`Карта «${cardSpec.name}»: monthlyLimit должен быть неотрицательным числом`);
      if (cardSpec.last4 != null && (!/^\d{4}$/.test(String(cardSpec.last4))))
        throw new ValidationError(`Карта «${cardSpec.name}»: last4 — ровно 4 цифры`);
      // last4 приводим к строке: в БД он текст, а в чужом документе может быть число —
      // иначе ключ сопоставления не совпадёт и карта продублируется.
      const last4 = cardSpec.last4 == null ? null : String(cardSpec.last4).trim();
      const cardName = String(cardSpec.name ?? '').trim();
      const cardKey = cardKeyOf(bankId, cardName, last4);
      const cardId = merge ? index.cardByKey.get(cardKey) : undefined;
      // Явные поля после spread: чужой документ не должен подменить id/bankId.
      const savedId = await saveCard(userId, {
        ...cardSpec, id: cardId, bankId, last4,
      });
      index.cardByKey.set(cardKey, savedId);
    }
    for (const catSpec of bankSpec.categories ?? []) {
      if (typeof catSpec?.percent !== 'number') throw new ValidationError(`Категория «${catSpec?.name}»: percent обязателен`);
      const catName = String(catSpec.name ?? '').trim();
      const catKey = catKeyOf(bankId, catName);
      const catId = merge ? index.catByKey.get(catKey) : undefined;
      const savedId = await saveCategory(userId, {
        id: catId, bankId, name: catSpec.name, percent: catSpec.percent,
        mcc: mccList(catSpec.mcc, `Категория «${catName}»: mcc`),
        excludedMcc: mccList(catSpec.excluded ?? [], `Категория «${catName}»: excluded`),
        isAll: Boolean(catSpec.isAll), note: catSpec.note ?? null,
      });
      index.catByKey.set(catKey, savedId);
    }
  }
  for (const placeSpec of spec.places ?? []) {
    if (!placeSpec?.name) throw new ValidationError('Точки: name обязательно');
    const placeName = String(placeSpec.name).trim();
    const placeId = merge ? index.placeByName.get(placeName) : undefined;
    const savedId = await savePlace(userId, {
      id: placeId, name: placeSpec.name, mcc: mccCode(placeSpec.mcc, `Точка «${placeName}»: mcc`),
      note: placeSpec.note ?? null,
    });
    index.placeByName.set(placeName, savedId);
  }
  return getSummary(userId);
}

// Составные ключи — через JSON.stringify: разделитель не может встретиться в именах.
const cardKeyOf = (bankId, name, last4) => JSON.stringify([bankId, name, last4 ?? '']);
const catKeyOf = (bankId, name) => JSON.stringify([bankId, name]);

/** Индекс существующих записей пользователя (merge-режим): ключ → id. */
async function loadExisting(userId) {
  const [bankRows, cardRows, catRows, placeRows] = await Promise.all([
    db.select().from(banks).where(eq(banks.userId, userId)).all(),
    db.select().from(cards).where(eq(cards.userId, userId)).all(),
    db.select().from(categories).where(eq(categories.userId, userId)).all(),
    db.select().from(places).where(eq(places.userId, userId)).all(),
  ]);
  const index = { bankByName: new Map(), cardByKey: new Map(), catByKey: new Map(), placeByName: new Map() };
  for (const b of bankRows) index.bankByName.set(String(b.name).trim(), b.id);
  for (const c of cardRows) index.cardByKey.set(cardKeyOf(c.bankId, String(c.name).trim(), c.last4), c.id);
  for (const c of catRows) index.catByKey.set(catKeyOf(c.bankId, String(c.name).trim()), c.id);
  for (const p of placeRows) index.placeByName.set(String(p.name).trim(), p.id);
  return index;
}
