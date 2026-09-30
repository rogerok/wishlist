import { Effect } from 'effect';

import { ModeConfig } from '#infra/config/config.js';
import { makeReplFacade } from '#infra/repl/repl-facade.js';
import { HealthService } from '#modules/health/service/health.service.js';
import { UsersFake } from '#modules/users/repl/users.fake.js';
import { UsersRepl } from '#modules/users/repl/users.repl.js';

const makeFakeContext = Effect.gen(function* () {
  return {
    users: yield* makeReplFacade(yield* UsersFake),
  };
});

export const makeReplContext = Effect.gen(function* () {
  const context = {
    health: yield* makeReplFacade(yield* HealthService),
    users: yield* makeReplFacade(yield* UsersRepl),
  };

  const mode = yield* ModeConfig;

  if (mode !== 'development') {
    yield* Effect.logWarning(`REPL fake data is disabled in ${mode} mode`);

    return context;
  }

  return { ...context, fake: yield* makeFakeContext };
});
