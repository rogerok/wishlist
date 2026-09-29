import { Effect, Schema, SchemaGetter } from 'effect';

import type { StoredPasswordHash } from '#modules/auth/service/password-hash-format.js';

import { makeBrandedSchema } from '#infra/schemas/utils.js';
import { StoredPasswordHashSchema } from '#modules/auth/service/password-hash-format.js';
import { parsePasswordHashStructure } from '#modules/auth/service/password-hash-format.js';
import { UserIdSchema } from '#modules/users/schemas/user.schema.js';

const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[#@$!%^&*?_+=\-{}[\]:;"'<>,.()|\\`~/])[A-Za-z\d#$@!%^&*?_+=\-{}[\]:;"'<>,.()|\\`~/]{8,100}$/;

export const PasswordSchema = makeBrandedSchema(
  'Password',
  Schema.String.check(
    Schema.isPattern(passwordRegex, { identifier: 'Password' }),
  ),
);

const checkStoredPasswordHash = SchemaGetter.checkEffect<StoredPasswordHash>(
  (hash) =>
    parsePasswordHashStructure(hash).pipe(
      Effect.match({
        onFailure: () => 'Invalid stored password hash',
        onSuccess: () => true,
      }),
    ),
);

const ValidatedStoredPasswordHashSchema = StoredPasswordHashSchema.pipe(
  Schema.decode({
    decode: checkStoredPasswordHash,
    encode: checkStoredPasswordHash,
  }),
);

export const PasswordCredentialsSchema = Schema.Struct({
  userId: UserIdSchema,
  passwordHash: ValidatedStoredPasswordHashSchema,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
});

export type PasswordCredentials = Schema.Schema.Type<
  typeof PasswordCredentialsSchema
>;
