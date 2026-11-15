// endpoints/mccSuggest.js — POST /api/mccSuggest — автодополнение MCC при вводе
import { EndpointError } from 'sdk';
import { ValidationError } from '../lib/validation.js';
import { search } from '../lib/match.js';
import { ensureUser } from '../lib/repository.js';

export default async function (input, ctx) {
  try {
    const userId = await ensureUser(ctx.initData.user);
    const query = input?.query?.trim();
    if (!query) throw new ValidationError('query: требуется строка');

    const result = await search(userId, { query });

    if (result.mcc != null) {
      return { mcc: result.mcc, title: result.title };
    }

    if (result.suggestions && result.suggestions.length > 0) {
      return { suggestions: result.suggestions.map(s => ({ mcc: s.mcc, title: s.title })) };
    }

    return { mcc: null };
  } catch (e) {
    if (e instanceof ValidationError) {
      throw new EndpointError(e.message, { code: 'VALIDATION' });
    }
    throw e;
  }
}