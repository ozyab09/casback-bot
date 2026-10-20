import { table, integer, text, json, boolean, index, sql, check } from 'sdk/db';

// «Мой Кэшбэк» — учёт карт, категорий кэшбэка и MCC-справочника.
// FK на платформе не поддерживаются — целостность поддерживается в коде
// (см. tgcloud/lib/repository.js: удаляем потомков перед родителем).

/** Владелец данных. PK — Telegram user id (не autoIncrement). */
export const users = table('users', {
  id:        integer('id').primaryKey(),               // Telegram user id
  username:  text('username'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

/** Банк пользователя. */
export const banks = table('banks', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  userId:    integer('user_id').notNull(),             // logical → users.id
  name:      text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (t) => ({
  userIdx: index('idx_banks_user').on(t.userId),
}));

/** Карта (несколько карт одного банка поддерживаются). */
export const cards = table('cards', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  userId:       integer('user_id').notNull(),
  bankId:       integer('bank_id').notNull(),          // logical → banks.id
  name:         text('name').notNull(),
  last4:        text('last4'),                         // последние 4 цифры, различие карт одного банка
  holder:       text('holder'),                        // владелец
  monthlyLimit: integer('monthly_limit'),              // месячный лимит, ₽ (справочно)
  limitLeft:    integer('limit_left'),                 // остаток лимита на месяц (ведёт пользователь)
  note:         text('note'),
  createdAt:    integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (t) => ({
  bankIdx: index('idx_cards_bank').on(t.bankId),
  userIdx: index('idx_cards_user').on(t.userId),
}));

/** Категория кэшбэка внутри банка. */
export const categories = table('categories', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  userId:      integer('user_id').notNull(),
  bankId:      integer('bank_id').notNull(),           // logical → banks.id
  name:        text('name').notNull(),
  percent:     integer('percent').notNull().default(0), // базовый процент
  mcc:         json('mcc', { mode: 'json' }).notNull().default([]),      // список MCC-кодов
  excludedMcc: json('excluded_mcc', { mode: 'json' }).notNull().default([]), // исключения
  isAll:       boolean('is_all').notNull().default(false),              // «Все покупки» (fallback)
  note:        text('note'),
  createdAt:   integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (t) => ({
  bankIdx: index('idx_categories_bank').on(t.bankId),
  userIdx: index('idx_categories_user').on(t.userId),
  mccCheck: check('chk_mcc_json', sql`json_valid(${t.mcc}) or ${t.mcc} is null`),
}));

/** Личная торговая точка (название → MCC). */
export const places = table('places', {
  id:     integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  name:   text('name').notNull(),
  mcc:    integer('mcc').notNull(),
  note:   text('note'),
}, (t) => ({
  userIdx: index('idx_places_user').on(t.userId),
  nameIdx: index('idx_places_user_name').on(t.userId, t.name),
}));

/** Встроенный справочник MCC (read-only, seed из tgcloud/lib/mccRefData.js). */
export const mccRef = table('mcc_ref', {
  mcc:   integer('mcc').primaryKey(),
  title: text('title').notNull(),
});
