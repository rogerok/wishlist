import { NodeRuntime } from '@effect/platform-node';
import { Layer } from 'effect';

import { PgClientLive } from '#db/config.js';
import { DBLive } from '#db/db.service.js';
import { UsersRepositoryLive } from '#modules/users/repository/users.repository.js';
import { UsersServiceLive } from '#modules/users/users.service.js';
import { HttpLive } from '#server.js';

const MainLive = HttpLive.pipe(
  Layer.provide(UsersServiceLive),
  Layer.provide(UsersRepositoryLive),
  Layer.provide(DBLive),
  Layer.provide(PgClientLive),
);

NodeRuntime.runMain(Layer.launch(MainLive));
