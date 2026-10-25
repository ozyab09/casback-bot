// endpoints/getOverview.js — POST /api/getOverview — возврат сводки данных пользователя
import { getSummary } from '../lib/repository.js';
import { ensureUser } from '../lib/repository.js';

export default async function (input, ctx) {
  const userId = await ensureUser(ctx.initData.user);
  const summary = await getSummary(userId);
  return summary;
}