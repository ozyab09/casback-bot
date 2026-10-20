// lib/repository.js — основной слой работы с БД «Мой Кэшбэк».
// FK на платформе запрещены: каскадные удаления здесь, в коде.
import { db } from 'sdk';
import { eq, and, asc } from 'sdk/db';
import { banks, cards, categories, places, mccRef, users } from '../schema.js';
import { MCC_REF } from './mccRefData.js';
import { ValidationError } from './validation.js';

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

/** Заливает справочник MCC, если в таблице меньше записей, чем в сиде. */
export async function ensureMccRef() {
  const rows = await db.select({ mcc: mccRef.mcc }).from(mccRef).all();
  if (rows.length >= MCC_REF.length) return;
  for (const [mcc, title] of MCC_REF) {
    await db
      .insert(mccRef)
      .values({ mcc, title })
      .onConflictDoUpdate({ target: mccRef.mcc, set: { title } })
      .run();
  }
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
  if (!bank) throw new ValidationErrorX(`Банк #${bankId} не найден`);
  return bank;
}
// Ошибки узкого домена кидаются общим ValidationError — эндпоинт мапит в 400.
const ValidationErrorX = ValidationError;

export async function saveBank(userId, { id, name }) {
  const trimmed = String(name).trim();
  if (!trimmed) throw new ValidationErrorX('Название банка обязательно');
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
  const name = String(input.name ?? '').trim();
  if (!name) throw new ValidationErrorX('Название карты обязательно');
  if (input.last4 != null && !/^\d{4}$/.test(String(input.last4))) throw new ValidationErrorX('last4: ровно 4 цифры');
  if (input.limitLeft != null && input.monthlyLimit != null && input.limitLeft > input.monthlyLimit)
    throw new ValidationErrorX('Остаток лимита больше месячного лимита');
  return {
    name,
    last4: input.last4 ?? null,
    holder: input.holder ?? null,
    monthlyLimit: input.monthlyLimit ?? null,
    limitLeft: input.limitLeft ?? null,
    note: input.note ?? null,
  };
}

export async function saveCard(userId, { id, bankId, ...fields }) {
  await ownBank(userId, bankId);
  const values = assertCardFields(fields);
  if (id != null) {
    const card = await db.select().from(cards).where(and(eq(cards.id, id), eq(cards.userId, userId))).get();
    if (!card) throw new ValidationErrorX(`Карта #${id} не найдена`);
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
  if (!card) throw new ValidationErrorX(`Карта #${id} не найдена`);
  await db.delete(cards).where(eq(cards.id, id)).run();
}

export async function saveCategory(userId, { id, bankId, ...raw }) {
  await ownBank(userId, bankId);
  const name = String(raw.name ?? '').trim();
  if (!name) throw new ValidationErrorX('Название категории обязательно');
  const percent = Math.max(0, Math.min(100, Math.round(Number(raw.percent) || 0)));
  const mcc = (raw.mcc ?? []).map((n) => Number(n));
  const excludedMcc = (raw.excludedMcc ?? []).map((n) => Number(n));
  if (mcc.some((m) => !Number.isInteger(m) || m < 0) || excludedMcc.some((m) => !Number.isInteger(m) || m < 0))
    throw new ValidationErrorX('MCC-коды должны быть целыми числами');
  let isAll = Boolean(raw.isAll);
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
  const values = { name, percent, mcc, excludedMcc, isAll, note: raw.note ?? null };
  if (id != null) {
    const cat = await db.select().from(categories).where(and(eq(categories.id, id), eq(categories.userId, userId))).get();
    if (!cat) throw new ValidationErrorX(`Категория #${id} не найдена`);
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
  if (!cat) throw new ValidationErrorX(`Категория #${id} не найдена`);
  await db.delete(categories).where(eq(categories.id, id)).run();
}

export async function savePlace(userId, { id, ...raw }) {
  const name = String(raw.name ?? '').trim();
  if (!name) throw new ValidationErrorX('Название точки обязательно');
  const mcc = Number(raw.mcc);
  if (!Number.isInteger(mcc) || mcc < 0) throw new ValidationErrorX('MCC-код точки обязателен (целое число)');
  if (mcc > 99999) throw new ValidationErrorX('MCC-код: до 99999');
  const values = { name, mcc, note: raw.note ?? null };
  if (id != null) {
    const place = await db.select().from(places).where(and(eq(places.id, id), eq(places.userId, userId))).get();
    if (!place) throw new ValidationErrorX(`Точка #${id} не найдена`);
    await db.update(places).set(values).where(eq(places.id, id)).run();
    return id;
  }
  const [row] = await db.insert(places).values({ userId, ...values }).returning({ id: places.id }).run();
  return row.id;
}

export async function deletePlace(userId, id) {
  const place = await db.select().from(places).where(and(eq(places.id, id), eq(places.userId, userId))).get();
  if (!place) throw new ValidationErrorX(`Точка #${id} не найдена`);
  await db.delete(places).where(eq(places.id, id)).run();
}

/** Стирает все данные пользователя (используется импортом в режиме replace). */
export async function wipeUser(userId) {
  await db.delete(categories).where(eq(categories.userId, userId)).run();
  await db.delete(cards).where(eq(cards.userId, userId)).run();
  await db.delete(banks).where(eq(banks.userId, userId)).run();
  await db.delete(places).where(eq(places.userId, userId)).run();
}
