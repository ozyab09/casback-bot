// endpoints/deletePlace.js — POST /api/deletePlace
import { runCrud } from '../lib/crudEndpoint.js';

export default async function (input, ctx) {
  return runCrud('deletePlace', input, ctx);
}
