import { Effect } from 'effect';

import { makeReplFacade } from '#infra/repl/repl-facade.js';
import { HealthService } from '#modules/health/service/health.service.js';
import { UsersRepl } from '#modules/users/repl/users.repl.js';

export const makeReplContext = Effect.gen(function* () {
  return {
    health: yield* makeReplFacade(yield* HealthService),
    users: yield* makeReplFacade(yield* UsersRepl),
  };
});
