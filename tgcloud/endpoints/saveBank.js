// endpoints/saveBank.js — POST /api/saveBank
import { runCrud } from '../lib/crudEndpoint.js';

export default async function (input, ctx) {
  return runCrud('saveBank', input, ctx);
}
