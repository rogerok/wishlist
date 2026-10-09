import { Layer } from 'effect';

import { PasswordCredentialsRepositoryLive } from '#modules/auth/repository/password/password-credentials.repository.js';
import { SessionRepositoryLive } from '#modules/auth/repository/session/sesion.repository.js';
import { AuthServiceLive } from '#modules/auth/service/auth.service.js';
import { PasswordHasherLive } from '#modules/auth/service/password/password-hasher.service.js';
import {
  SecureRandomBytesLive,
  SessionTokenGeneratorLive,
} from '#modules/auth/service/session/session-token-generator.js';
import { UsersRepositoryLive } from '#modules/users/repository/users.repository.js';

const cryptoLayer = Layer.mergeAll(
  PasswordHasherLive,
  SessionTokenGeneratorLive.pipe(Layer.provide(SecureRandomBytesLive)),
);
const repoLayer = Layer.mergeAll(
  UsersRepositoryLive,
  PasswordCredentialsRepositoryLive,
  SessionRepositoryLive,
);

export const AuthModuleLive = AuthServiceLive.pipe(
  Layer.provide([repoLayer, cryptoLayer]),
);
