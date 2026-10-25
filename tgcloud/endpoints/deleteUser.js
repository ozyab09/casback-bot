// endpoints/deleteUser.js — POST /api/deleteUser — полная очистка данных пользователя
import { ensureUser } from '../lib/repository.js';
import { wipeUser } from '../lib/repository.js';
import { mapError } from '../lib/crudEndpoint.js';

export default async function (input, ctx) {
  try {
    const userId = await ensureUser(ctx.initData.user);
    await wipeUser(userId);
    return { success: true, message: 'Данные пользователя удалены' };
  } catch (e) {
    mapError(e);
  }
}