import { Schema } from 'effect';

import { makeEmailBrandedSchema } from '#infra/schemas/email.schema.js';
import { makeIdBrandedSchema } from '#infra/schemas/uuid4.schema.js';

export const UserIdSchema = makeIdBrandedSchema('UserId');
export type UserId = Schema.Schema.Type<typeof UserIdSchema>;

export const UserEmailSchema = makeEmailBrandedSchema('UserEmail');
export type UserEmail = Schema.Schema.Type<typeof UserEmailSchema>;

export const UserDisplayNameSchema = Schema.String.pipe(
  Schema.check(Schema.isMinLength(1)),
  Schema.check(Schema.isMaxLength(100)),
);

// Во входящих запросах пробелы по краям удаляются до проверки длины: "   " отклоняется.
export const UserDisplayNameInputSchema = Schema.Trim.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(100),
);
