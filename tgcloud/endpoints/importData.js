// endpoints/importData.js — POST /api/importData — загрузка документа spec 3.
import { ensureUser } from '../lib/repository.js';
import { importData as doImport } from '../lib/importExport.js';
import { mapError } from '../lib/crudEndpoint.js';

export default async function (input, ctx) {
  try {
    const userId = await ensureUser(ctx.initData.user);
    return await doImport(userId, { mode: input?.mode, data: input?.data });
  } catch (e) {
    mapError(e);
  }
}
