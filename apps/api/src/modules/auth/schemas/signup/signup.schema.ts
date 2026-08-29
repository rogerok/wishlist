import { Schema } from 'effect';
import { HttpApiSchema } from 'effect/unstable/httpapi';

import { withRequestParseOptions } from '#infra/schemas/utils.js';
import { PasswordSchema } from '#modules/auth/schemas/password/password.schema.js';
import { UserResponseSchema } from '#modules/users/schemas/user-response.schema.js';
import {
  UserEmailSchema,
  UserNameInputSchema,
} from '#modules/users/schemas/user.schema.js';

export const passwordConfirmIssue = {
  path: ['passwordConfirm'],
  issue: "Passwords doesn't match",
} satisfies Schema.FilterIssue;

export const SignupRequestBodySchema = Schema.Struct({
  email: UserEmailSchema,
  password: PasswordSchema,
  passwordConfirm: PasswordSchema,
  firstName: UserNameInputSchema,
  lastName: UserNameInputSchema,
  middleName: UserNameInputSchema,
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
