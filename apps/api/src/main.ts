import { NodeRuntime } from '@effect/platform-node';
import { Layer } from 'effect';

import { PgClientLive } from '#db/config.js';
import { DBLive } from '#db/db.service.js';
import { UsersModuleLive } from '#modules/users/users.module.js';
import { HttpLive } from '#server.js';

const MainLive = HttpLive.pipe(
  Layer.provide(UsersModuleLive),
  Layer.provide(DBLive),
  Layer.provide(PgClientLive),
);

NodeRuntime.runMain(Layer.launch(MainLive));
