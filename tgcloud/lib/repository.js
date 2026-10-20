// lib/repository.js — основной слой работы с БД «Мой Кэшбэк».
// FK на платформе запрещены: каскадные удаления здесь, в коде.
import { db } from 'sdk';
import { eq, and, asc } from 'sdk/db';
import { banks, cards, categories, places, mccRef, users } from '../schema.js';
import { MCC_REF } from './mccRefData.js';
import { ValidationError, reqText, optText, optInt, mccList, mccCode } from './validation.js';

/** Гарантирует строку в users по Telegram id. */
export async function ensureUser(user) {
  if (!user || typeof user.id !== 'number') throw new Error('no initData user');
  await db
    .insert(users)
    .values({ id: user.id, username: user.username ?? null })
    .onConflictDoUpdate({ target: users.id, set: { username: user.username ?? null } })
    .run();
  return user.id;
}

/**
 * Заливает справочник MCC. Один запрос с upsert вместо 88 последовательных
 * INSERT (#3). Сверяем не количество строк, а содержимое: раньше таблица с
 * тем же числом строк, но с другим составом, считалась актуальной и не
 * чинилась.
 */
export async function ensureMccRef() {
  const rows = await db.select({ mcc: mccRef.mcc, title: mccRef.title }).from(mccRef).all();
  const current = new Map(rows.map((r) => [r.mcc, r.title]));
  const upToDate = MCC_REF.length === current.size
    && MCC_REF.every(([mcc, title]) => current.get(mcc) === title);
  if (upToDate) return;

  // Батч-upsert: именованные параметры :m0/:t0 … — по одному на пару (mcc, title).
  const params = {};
  const tuples = MCC_REF.map(([mcc, title], i) => {
    params[`:m${i}`] = mcc;
    params[`:t${i}`] = title;
    return `(:m${i}, :t${i})`;
  });
  await db.run(
    `INSERT INTO mcc_ref (mcc, title) VALUES ${tuples.join(', ')} `
    + 'ON CONFLICT(mcc) DO UPDATE SET title = excluded.title',
    params,
  );
}

/** Полная сводка пользователя одним пакетом (для SPA). */
export async function getSummary(userId) {
  const [bankRows, cardRows, catRows, placeRows] = await Promise.all([
    db.select().from(banks).where(eq(banks.userId, userId)).orderBy(asc(banks.name)).all(),
    db.select().from(cards).where(eq(cards.userId, userId)).orderBy(asc(cards.createdAt)).all(),
    db.select().from(categories).where(eq(categories.userId, userId)).orderBy(asc(categories.id)).all(),
    db.select().from(places).where(eq(places.userId, userId)).orderBy(asc(places.name)).all(),
  ]);
  return {
    banks: bankRows.map((b) => ({
      id: b.id,
      name: b.name,
      cards: cardRows.filter((c) => c.bankId === b.id).map(cardOut),
      categories: catRows.filter((c) => c.bankId === b.id).map(catOut),
    })),
    places: placeRows.map((p) => ({ id: p.id, name: p.name, mcc: p.mcc, note: p.note })),
  };
}

const cardOut = (c) => ({
  id: c.id, bankId: c.bankId, name: c.name,
  last4: c.last4, holder: c.holder,
  monthlyLimit: c.monthlyLimit, limitLeft: c.limitLeft, note: c.note,
});
const catOut = (c) => ({
  id: c.id, bankId: c.bankId, name: c.name,
  percent: c.percent, mcc: c.mcc ?? [], excludedMcc: c.excludedMcc ?? [],
  isAll: c.isAll, note: c.note,
});

async function ownBank(userId, bankId) {
  const bank = await db.select().from(banks).where(and(eq(banks.id, bankId), eq(banks.userId, userId))).get();
  if (!bank) throw new ValidationError(`Банк #${bankId} не найден`);
  return bank;
}

/** Процент: целое 0..100 (флоат округляем), мусор — 400. */
function normPercent(v) {
  if (v == null || v === '') return 0;
  const n = typeof v === 'string' && /^\s*-?\d+(\.\d+)?\s*$/.test(v) ? Number(v.trim()) : v;
  if (typeof n !== 'number' || !Number.isFinite(n))
    throw new ValidationError(`Процент: «${v}» не число`);
  return Math.max(0, Math.min(100, Math.round(n)));
}

export async function saveBank(userId, { id, name }) {
  // reqText: имя обязательно и должно быть строкой (undefined → 400, а не «undefined»).
  const trimmed = reqText(name, 'Название банка', 100);
  if (id != null) {
    await ownBank(userId, id);
    await db.update(banks).set({ name: trimmed }).where(eq(banks.id, id)).run();
    return id;
  }
  const [row] = await db.insert(banks).values({ userId, name: trimmed }).returning({ id: banks.id }).run();
  return row.id;
}

export async function deleteBank(userId, bankId) {
  await ownBank(userId, bankId);
  // каскад в коде: сначала потомки
  await db.delete(categories).where(and(eq(categories.bankId, bankId), eq(categories.userId, userId))).run();
  await db.delete(cards).where(and(eq(cards.bankId, bankId), eq(cards.userId, userId))).run();
  await db.delete(banks).where(eq(banks.id, bankId)).run();
}

function assertCardFields(input) {
  const name = reqText(input.name, 'Название карты', 100);
  let last4 = null;
  if (input.last4 != null && input.last4 !== '') {
    if (typeof input.last4 !== 'string') throw new ValidationError('Последние 4 цифры: должна быть строка');
    last4 = input.last4.trim();
    if (!/^\d{4}$/.test(last4)) throw new ValidationError('Последние 4 цифры: ровно 4 цифры');
  }
  // Лимиты — целые неотрицательные числа или null: строки в INTEGER-колонке ломают
  // сравнение limitLeft === 0 в поиске (#19).
  const monthlyLimit = optInt(input.monthlyLimit, 'Месячный лимит', 0);
  const limitLeft = optInt(input.limitLeft, 'Остаток лимита', 0);
  if (limitLeft != null && monthlyLimit != null && limitLeft > monthlyLimit)
    throw new ValidationError('Остаток лимита больше месячного лимита');
  return {
    name,
    last4,
    holder: optText(input.holder, 'Владелец', 100),
    monthlyLimit,
    limitLeft,
    note: optText(input.note, 'Заметка', 500),
  };
}

export async function saveCard(userId, { id, bankId, ...fields }) {
  await ownBank(userId, bankId);
  const values = assertCardFields(fields);
  if (id != null) {
    const card = await db.select().from(cards).where(and(eq(cards.id, id), eq(cards.userId, userId))).get();
    if (!card) throw new ValidationError(`Карта #${id} не найдена`);
    if (card.bankId !== bankId) throw new ValidationError(`Карта #${id} принадлежит другому банку`);
    await db.update(cards).set(values).where(and(eq(cards.id, id), eq(cards.userId, userId))).run();
    return id;
  }
  const [row] = await db
    .insert(cards).values({ userId, bankId, ...values })
    .returning({ id: cards.id }).run();
  return row.id;
}

export async function deleteCard(userId, id) {
  const card = await db.select().from(cards).where(and(eq(cards.id, id), eq(cards.userId, userId))).get();
  if (!card) throw new ValidationError(`Карта #${id} не найдена`);
  await db.delete(cards).where(eq(cards.id, id)).run();
}

export async function saveCategory(userId, { id, bankId, ...raw }) {
  await ownBank(userId, bankId);
  const name = reqText(raw.name, 'Название категории', 100);
  const percent = normPercent(raw.percent);
  // mccList: ждём массив, приводим строки к числам, отсекаем мусор, дедупим (#18).
  const mcc = mccList(raw.mcc, 'mcc');
  const excludedMcc = mccList(raw.excludedMcc, 'excludedMcc');
  const isAll = Boolean(raw.isAll);
  if (isAll) {
    // «Все покупки» — одна на банк
    const existing = await db
      .select().from(categories)
      .where(and(eq(categories.bankId, bankId), eq(categories.isAll, true))).all();
    const others = existing.filter((r) => r.id !== id);
    if (others.length) {
      await db.update(categories).set({ isAll: false }).where(eq(categories.id, others[0].id)).run();
    }
  }
  const values = { name, percent, mcc, excludedMcc, isAll, note: optText(raw.note, 'Заметка', 500) };
  if (id != null) {
    const cat = await db.select().from(categories).where(and(eq(categories.id, id), eq(categories.userId, userId))).get();
    if (!cat) throw new ValidationError(`Категория #${id} не найдена`);
    if (cat.bankId !== bankId) throw new ValidationError(`Категория #${id} принадлежит другому банку`);
    await db.update(categories).set(values).where(and(eq(categories.id, id), eq(categories.userId, userId))).run();
    return id;
  }
  const [row] = await db
    .insert(categories).values({ userId, bankId, ...values })
    .returning({ id: categories.id }).run();
  return row.id;
}

export async function deleteCategory(userId, id) {
  const cat = await db.select().from(categories).where(and(eq(categories.id, id), eq(categories.userId, userId))).get();
  if (!cat) throw new ValidationError(`Категория #${id} не найдена`);
  await db.delete(categories).where(eq(categories.id, id)).run();
}

export async function savePlace(userId, { id, ...raw }) {
  const name = reqText(raw.name, 'Название точки', 100);
  // MCC 1..99999: пустая строка давала Number('') === 0 — точку с несуществующим MCC (#20).
  const mcc = mccCode(raw.mcc, 'MCC');
  const values = { name, mcc, note: optText(raw.note, 'Заметка', 500) };
  if (id != null) {
    const place = await db.select().from(places).where(and(eq(places.id, id), eq(places.userId, userId))).get();
    if (!place) throw new ValidationError(`Точка #${id} не найдена`);
    await db.update(places).set(values).where(eq(places.id, id)).run();
    return id;
  }
  const [row] = await db.insert(places).values({ userId, ...values }).returning({ id: places.id }).run();
  return row.id;
}

export async function deletePlace(userId, id) {
  const place = await db.select().from(places).where(and(eq(places.id, id), eq(places.userId, userId))).get();
  if (!place) throw new ValidationError(`Точка #${id} не найдена`);
  await db.delete(places).where(eq(places.id, id)).run();
}

/** Стирает все данные пользователя (используется импортом в режиме replace). */
export async function wipeUser(userId) {
  await db.delete(categories).where(eq(categories.userId, userId)).run();
  await db.delete(cards).where(eq(cards.userId, userId)).run();
  await db.delete(banks).where(eq(banks.userId, userId)).run();
  await db.delete(places).where(eq(places.userId, userId)).run();
}
