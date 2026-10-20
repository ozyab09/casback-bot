// endpoints/deleteCategory.js — POST /api/deleteCategory
import { runCrud } from '../lib/crudEndpoint.js';

export default async function (input, ctx) {
  return runCrud('deleteCategory', input, ctx);
}
