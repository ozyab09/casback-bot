// lib/crudEndpoint.js — общий клей для CRUD-эндпоинтов:
// владелец из initData → валидация → мутация → свежая сводка.
import { EndpointError } from 'sdk';
import { ValidationError } from './validation.js';
import { ensureUser, getSummary } from './repository.js';
import * as repo from './repository.js';

/** ValidationError → 400 EndointError; остальное — наверх (→ 500 INTERNAL). */
export function mapError(e) {
  if (e instanceof ValidationError) throw new EndpointError(e.message, { code: 'VALIDATION' });
  throw e;
}

export function reqId(input) {
  let id = input?.id;
  if (typeof id === 'string' && /^-?\d+$/.test(id.trim())) id = Number(id.trim());
  if (!Number.isInteger(id) || id <= 0)
    throw new ValidationError(`id: требуется целое положительное число, получено ${JSON.stringify(input?.id)}`);
  return id;
}

/** Запускает одну из CRUD-функций repository и возвращает сводку. */
export async function runCrud(fnName, input, ctx) {
  try {
    const userId = await ensureUser(ctx.initData.user);
    const isDelete = fnName.startsWith('delete');
    const arg = isDelete ? undefined : (input ?? {});
    if (!isDelete && arg.id != null) arg.id = reqId(arg);
    if (!isDelete && typeof arg.bankId === 'string' && /^\d+$/.test(arg.bankId.trim()))
      arg.bankId = Number(arg.bankId.trim());
    // delete-функции принимают голый id, save-функции — payload целиком
    await repo[fnName](userId, isDelete ? reqId(input) : arg);
    if (fnName === 'saveBank' || fnName === 'saveCard' || fnName === 'saveCategory' || fnName === 'savePlace')
      return { id: arg.id ?? null, summary: await getSummary(userId) };
    return await getSummary(userId);
  } catch (e) {
    mapError(e);
  }
}
