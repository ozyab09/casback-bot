// lib/match.js — «чем платить»: подбор лучшей карты под MCC.
// Семантика:
//  1) применимые категории карты: m ∈ mcc и m ∉ excludedMcc;
//  2) иначе — категория «Все покупки» (isAll), применима, если m ∉ её excludedMcc;
//  3) иначе 0%. Лимиты: если у карты задан monthlyLimit и limitLeft === 0 —
//     процент маркируется как «лимит исчерпан» (кэшбэк не считается).
import { db } from 'sdk';
import { eq } from 'sdk/db';
import { banks, cards, categories, places, mccRef } from '../schema.js';
import { ValidationError } from './validation.js';

const num = (s) => (typeof s === 'string' ? s.toUpperCase() : '');

/** Регистронезависимое сравнение в JS: SQLite-коллация не гарантирует
 *  case-insensitive для кириллицы (UPPER/LOWER работают только с ASCII). */
const hasSub = (hay, needle) => hay.toLowerCase().includes(needle.toLowerCase());

/** MCC/точка по текстовому запросу: личные точки → справочник → подсказки.
 *  Выборка — целиком по пользователю/справочнику, матч — в JS (см. hasSub). */
async function resolveMcc(userId, query) {
  const q = String(query ?? '').trim();
  if (!q) return { mcc: null };

  // личные точки — сначала точное имя, потом подстрока
  const userPlaces = await db.select().from(places).where(eq(places.userId, userId)).all();
  const exact = userPlaces.find((p) => hasSub(p.name, q) && p.name.length === q.length) ?? null;
  if (exact) return { mcc: exact.mcc, title: exact.name, source: 'place' };

  const inPlaces = userPlaces.filter((p) => hasSub(p.name, q));

  const allRef = await db.select().from(mccRef).all();
  const inRef = allRef.filter(
    (r) => String(r.mcc).startsWith(q) || hasSub(r.title, q)
  );

  if (inPlaces.length > 1 || inRef.length > 1) {
    const suggestions = [
      ...inPlaces.map((p) => ({ mcc: p.mcc, title: p.name, source: 'place' })),
      ...inRef.map((r) => ({ mcc: r.mcc, title: r.title, source: 'ref' })),
    ].slice(0, 10);
    return { mcc: null, suggestions, suggestionsTitle: `уточните: «${query}» »` };
  }
  if (inPlaces.length === 1) return { mcc: inPlaces[0].mcc, title: inPlaces[0].name, source: 'place' };
  if (inRef.length === 1) return { mcc: inRef[0].mcc, title: inRef[0].title, source: 'ref' };

  return { mcc: null };
}

export async function search(userId, { query, amount } = {}) {
  const q = String(query ?? '').trim();
  if (!q) throw new ValidationError('Укажите MCC или название точки');

  let resolved = { mcc: null };
  if (/^\d{1,5}$/.test(q)) {
    resolved = { mcc: Number(q) };
    const ref = await db.select().from(mccRef).where(eq(mccRef.mcc, resolved.mcc)).get();
    if (ref) resolved.title = ref.title;
  } else {
    resolved = await resolveMcc(userId, q);
  }
  if (resolved.mcc == null) return resolved; // { mcc: null } или подсказки

  const m = resolved.mcc;
  const [bankRows, cardRows, catRows] = await Promise.all([
    db.select().from(banks).where(eq(banks.userId, userId)).all(),
    db.select().from(cards).where(eq(cards.userId, userId)).all(),
    db.select().from(categories).where(eq(categories.userId, userId)).all(),
  ]);
  const catByBank = new Map();
  for (const c of catRows) {
    if (!catByBank.has(c.bankId)) catByBank.set(c.bankId, []);
    catByBank.get(c.bankId).push(c);
  }

  const variants = [];
  for (const card of cardRows) {
    const bank = bankRows.find((b) => b.id === card.bankId);
    if (!bank) continue;
    const cats = catByBank.get(bank.id) ?? [];
    let hit = null; let isFallback = false;
    for (const cat of cats) {
      if ((cat.mcc ?? []).includes(m) && !(cat.excludedMcc ?? []).includes(m)) {
        if (!hit || cat.percent > hit.percent) hit = cat;
      }
    }
    if (!hit) {
      const all = cats.find((c) => c.isAll && !(c.excludedMcc ?? []).includes(m));
      if (all) { hit = all; isFallback = true; }
    }
    const limitReached = card.monthlyLimit != null && card.limitLeft === 0;
    const percent = hit && !limitReached ? hit.percent : 0;
    const cashback = hit && amount != null && !limitReached
      ? Number((Number(amount) * percent / 100).toFixed(2))
      : null;
    variants.push({
      bankId: bank.id, bankName: bank.name, cardId: card.id,
      cardName: card.name, last4: card.last4,
      categoryId: hit?.id ?? null,
      categoryName: hit ? hit.name : null,
      percent, isFallback, limitReached,
      monthlyLimit: card.monthlyLimit, limitLeft: card.limitLeft,
      cashback,
    });
  }
  variants.sort((a, b) => b.percent - a.percent || num(String(a.bankName)).localeCompare(num(String(b.bankName))));

  return {
    mcc: m,
    title: resolved.title ?? null,
    best: variants[0]?.percent > 0 ? variants[0]?.cardId : null,
    variants,
  };
}

// Empty query -> ValidationError (см. lib/validation.js); эндпоинт мапит в 400.
