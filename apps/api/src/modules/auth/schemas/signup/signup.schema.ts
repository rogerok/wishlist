import { Schema, Struct } from 'effect';
import { HttpApiSchema } from 'effect/unstable/httpapi';

import { withRequestParseOptions } from '#infra/schemas/utils.js';
import {
  CredentialsSchema,
  ExpiresAtSchema,
} from '#modules/auth/schemas/auth.schema.js';
import { PasswordSchema } from '#modules/auth/schemas/password/password.schema.js';
import { UserResponseSchema } from '#modules/users/schemas/user-response.schema.js';
import {
  UserDisplayNameInputSchema,
  UserEmailSchema,
} from '#modules/users/schemas/user.schema.js';

export const passwordConfirmIssue = {
  path: ['passwordConfirm'],
  issue: "Passwords doesn't match",
} satisfies Schema.FilterIssue;

export const SignupRequestBodySchema = Schema.Struct({
  email: UserEmailSchema,
  password: PasswordSchema,
  passwordConfirm: PasswordSchema,
  displayName: UserDisplayNameInputSchema,
})
  .check(
    Schema.makeFilter(({ password, passwordConfirm }) =>
      password === passwordConfirm ? undefined : passwordConfirmIssue,
    ),
  )
  .pipe(withRequestParseOptions);

export const SignupResponseSuccessSchema = UserResponseSchema.pipe(
  HttpApiSchema.status(201),
);

export const SignupInputSchema = SignupRequestBodySchema.mapFields(
  Struct.omit(['passwordConfirm']),
);
export type SignupInput = Schema.Schema.Type<typeof SignupInputSchema>;

export const SignupResultSchema = Schema.Struct({
  user: UserResponseSchema,
  credential: CredentialsSchema,
  expiresAt: ExpiresAtSchema,
});
export type SignupResult = Schema.Schema.Type<typeof SignupResultSchema>;
