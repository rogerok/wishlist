#!/usr/bin/env -S pnpm exec tsx --conditions=development --env-file=.env.development

import { NodeRuntime } from '@effect/platform-node';
import { Effect } from 'effect';
import * as repl from 'node:repl';

import { AppServicesLive } from '#app.js';
import { makeReplContext } from '#infra/repl/repl-context.js';

const startRepl = Effect.acquireRelease(
  Effect.sync(() => repl.start({ useColors: true, prompt: '@wishlist/api> ' })),
  (replServer) => Effect.sync(() => replServer.close()),
);

const setupHistory = (replServer: repl.REPLServer) =>
  Effect.callback<void>((resume) => {
    replServer.setupHistory('.node_repl_history', (err) => {
      resume(
        err
          ? Effect.logWarning('Failed to load REPL history', err)
          : Effect.void,
      );
    });
  });

const waitForExit = (replServer: repl.REPLServer) =>
  Effect.callback<void>((resume) => {
    const onExit = () => resume(Effect.void);

    replServer.once('exit', onExit);

    return Effect.sync(() => replServer.off('exit', onExit));
  });

const program = Effect.gen(function* () {
  const replContext = yield* makeReplContext;
  const replServer = yield* startRepl;

  Object.assign(replServer.context, replContext);
  // `.clear` creates a fresh context, so the facades have to be added again.
  replServer.on('reset', (context) => Object.assign(context, replContext));

  yield* setupHistory(replServer);
  yield* waitForExit(replServer);
}).pipe(Effect.scoped, Effect.provide(AppServicesLive));

NodeRuntime.runMain(program);
