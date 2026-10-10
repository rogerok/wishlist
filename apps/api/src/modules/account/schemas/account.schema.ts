import { Schema } from 'effect';

import { makeIdBrandedSchema } from '#infra/schemas/uuid4.schema.js';

export const AccountIdSchema = makeIdBrandedSchema('Account');

export const AccountDisplayNameSchema = Schema.String.pipe(
  Schema.check(Schema.isMinLength(1)),
  Schema.check(Schema.isMaxLength(100)),
);

export const AccountDisplayNameInputSchema = Schema.Trim.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(100),
);
