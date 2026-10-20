// endpoints/search.js — POST /api/search — «чем платить» по MCC/точке.
import { ValidationError } from '../lib/validation.js';
import { search } from '../lib/match.js';
import { ensureUser } from '../lib/repository.js';
import { mapError } from '../lib/crudEndpoint.js';

export default async function (input, ctx) {
  try {
    const userId = await ensureUser(ctx.initData.user);
    const amount = input?.amount;
    if (amount != null && (typeof amount !== 'number' || amount < 0 || !Number.isFinite(amount)))
      throw new ValidationError('amount: неотрицательное число');
    return await search(userId, { query: input?.query, amount });
  } catch (e) {
    mapError(e);
  }
}
