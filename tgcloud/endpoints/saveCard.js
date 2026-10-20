// endpoints/saveCard.js — POST /api/saveCard
import { runCrud } from '../lib/crudEndpoint.js';

export default async function (input, ctx) {
  return runCrud('saveCard', input, ctx);
}
