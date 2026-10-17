import type { Schema } from 'effect';

import { makeLiteralUnionSchema } from '#infra/schemas/utils.js';

export const WishlistsOperationsSchema = makeLiteralUnionSchema([
  'create',
  'delete',
  'getAll',
  'getById',
  'getReadableById',
  'update',
]);

export type WishlistsOperations = Schema.Schema.Type<
  typeof WishlistsOperationsSchema
>;

export const WishlistsOperations = WishlistsOperationsSchema.values;
