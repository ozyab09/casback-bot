// endpoints/getOverview.js — POST /api/getOverview — первый пакет данных SPA.
import { ensureMccRef, ensureUser, getSummary } from '../lib/repository.js';
import { mapError } from '../lib/crudEndpoint.js';

export default async function (input, ctx) {
  try {
    const userId = await ensureUser(ctx.initData.user);
    await ensureMccRef();
    return await getSummary(userId);
  } catch (e) {
    mapError(e);
  }
}
