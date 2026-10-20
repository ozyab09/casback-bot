// endpoints/saveCategory.js — POST /api/saveCategory
import { runCrud } from '../lib/crudEndpoint.js';

export default async function (input, ctx) {
  return runCrud('saveCategory', input, ctx);
}
