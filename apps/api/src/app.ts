import { Layer } from 'effect';

import { PgClientLive } from '#db/config.js';
import { DBLive } from '#db/db.service.js';
import { UsersModuleLive } from '#modules/users/users.module.js';

export const AppServicesLive = UsersModuleLive.pipe(
  Layer.provide(DBLive),
  Layer.provide(PgClientLive),
);
