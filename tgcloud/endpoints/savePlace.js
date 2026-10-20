// endpoints/savePlace.js — POST /api/savePlace
import { runCrud } from '../lib/crudEndpoint.js';

export default async function (input, ctx) {
  return runCrud('savePlace', input, ctx);
}
