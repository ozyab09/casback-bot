// endpoints/exportData.js — POST /api/exportData — JSON формата spec 3.
import { ensureUser } from '../lib/repository.js';
import { exportData as doExport } from '../lib/importExport.js';
import { mapError } from '../lib/crudEndpoint.js';

export default async function (input, ctx) {
  try {
    const userId = await ensureUser(ctx.initData.user);
    return await doExport(userId);
  } catch (e) {
    mapError(e);
  }
}
