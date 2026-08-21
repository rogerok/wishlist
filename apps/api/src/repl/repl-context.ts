import { Effect } from 'effect';

import type { HealthReplFacade } from '#modules/health/repl/health.repl.js';
import type { UsersReplFacade } from '#modules/users/repl/users.repl.js';
import type { RunPromise } from '#repl/repl.types.js';

import { makeHealthRepl } from '#modules/health/repl/health.repl.js';
import { makeUsersRepl } from '#modules/users/repl/users.repl.js';

export interface ReplContext {
  readonly health: HealthReplFacade;
  readonly users: UsersReplFacade;
}

export const makeReplContext = (runPromise: RunPromise) =>
  Effect.gen(function* () {
    const users = yield* makeUsersRepl(runPromise);
    const health = yield* makeHealthRepl(runPromise);

    return { users, health } satisfies ReplContext;
  });
