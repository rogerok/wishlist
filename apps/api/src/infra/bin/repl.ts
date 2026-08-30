#!/usr/bin/env -S pnpm exec tsx --conditions=development --env-file=.env.development

import { NodeRuntime } from '@effect/platform-node';
import { Effect, ManagedRuntime } from 'effect';
import * as repl from 'node:repl';

import { AppServicesLive } from '#app.js';
import { makeReplContext } from '#infra/repl/repl-context.js';

// TODO: rewrite
const waitForExit = (replServer: repl.REPLServer) =>
  Effect.callback<void>((resume) => {
    const onExit = () => resume(Effect.void);

    replServer.once('exit', onExit);

    return Effect.sync(() => replServer.off('exit', onExit));
  });

const setupHistory = (replServer: repl.REPLServer) =>
  Effect.callback<void>((resume) => {
    replServer.setupHistory('.node_repl_history', (err) => {
      if (err) {
        resume(Effect.logWarning('Failed to load REPL history', err));
      } else {
        resume(Effect.void);
      }
    });
  });

const program = Effect.acquireUseRelease(
  Effect.sync(() => ManagedRuntime.make(AppServicesLive)),
  (runtime) =>
    Effect.gen(function* () {
      const context = yield* runtime.contextEffect;
      const replContext = yield* makeReplContext(runtime.runPromise).pipe(
        Effect.provide(context),
      );

      const replServer = yield* Effect.sync(() =>
        repl.start({ useColors: true, prompt: '@wishlist/api> ' }),
      );
      Object.assign(replServer.context, replContext);

      yield* setupHistory(replServer);
      yield* waitForExit(replServer);
    }),
  (runtime) => runtime.disposeEffect,
);

NodeRuntime.runMain(program);
