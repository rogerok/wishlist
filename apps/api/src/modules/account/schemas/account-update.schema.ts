import { Schema } from 'effect';

import { withRequestParseOptions } from '#infra/schemas/utils.js';
import { AccountDisplayNameInputSchema } from '#modules/account/schemas/account.schema.js';

export const AccountUpdateRequestSchema = Schema.Struct({
  displayName: AccountDisplayNameInputSchema,
}).pipe(withRequestParseOptions);
export type AccountUpdateRequest = Schema.Schema.Type<
  typeof AccountUpdateRequestSchema
>;

export const AccountUpdateResponseSchema = Schema.Struct({
  displayName: AccountDisplayNameInputSchema,
});
export type AccountUpdateResponse = Schema.Schema.Type<
  typeof AccountUpdateResponseSchema
>;
