// endpoints/deleteBank.js — POST /api/deleteBank
import { runCrud } from '../lib/crudEndpoint.js';

export default async function (input, ctx) {
  return runCrud('deleteBank', input, ctx);
}
