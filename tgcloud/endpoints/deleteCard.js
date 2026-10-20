// endpoints/deleteCard.js — POST /api/deleteCard
import { runCrud } from '../lib/crudEndpoint.js';

export default async function (input, ctx) {
  return runCrud('deleteCard', input, ctx);
}
