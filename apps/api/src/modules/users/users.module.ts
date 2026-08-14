import { Layer } from 'effect';

import { UsersRepositoryLive } from '#modules/users/repository/users.repository.js';
import { UsersServiceLive } from '#modules/users/service/users.service.js';

export const UsersModuleLive = UsersServiceLive.pipe(
  Layer.provide(UsersRepositoryLive),
);
