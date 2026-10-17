import { Effect, Schema } from 'effect';

import { decodeArgs } from '#infra/repl/repl-facade.js';
import { CredentialsSchema } from '#modules/auth/schemas/auth.schema.js';
import { LoginRequestBodySchema } from '#modules/auth/schemas/login/login.schema.js';
import { SignupInputSchema } from '#modules/auth/schemas/signup/signup.schema.js';
import { AuthService } from '#modules/auth/service/auth.service.js';

const ReplCredentialSchema = Schema.Union([
  CredentialsSchema,
  Schema.RedactedFromValue(Schema.String),
]);

export const AuthRepl = Effect.gen(function* () {
  const auth = yield* AuthService;

  return {
    signup: decodeArgs([SignupInputSchema], auth.signup),
    login: decodeArgs([LoginRequestBodySchema], auth.login),
    authenticate: decodeArgs([ReplCredentialSchema], auth.authenticate),
    logout: decodeArgs([ReplCredentialSchema], auth.logout),
  };
});
