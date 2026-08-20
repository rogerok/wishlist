import { Effect } from 'effect';

import type { UsersReplFacade } from '#modules/users/repl/users.repl.js';
import type { RunPromise } from '#repl/repl.types.js';

import { makeUsersRepl } from '#modules/users/repl/users.repl.js';

export interface ReplContext {
  readonly users: UsersReplFacade;
}

export const makeReplContext = (runPromise: RunPromise) =>
  Effect.gen(function* () {
    const users = yield* makeUsersRepl(runPromise);

    return { users } satisfies ReplContext;
  });
