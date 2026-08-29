import { Layer } from 'effect';

import { PgClientLive } from '#infra/db/config.js';
import { DBLive } from '#infra/db/db.service.js';
import { HealthModuleLive } from '#modules/health/health.module.js';
import { UsersModuleLive } from '#modules/users/users.module.js';

const ModulesLive = Layer.mergeAll(HealthModuleLive, UsersModuleLive);

export const AppServicesLive = ModulesLive.pipe(
  Layer.provide(DBLive),
  Layer.provide(PgClientLive),
);
