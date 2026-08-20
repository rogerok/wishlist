#!/usr/bin/env -S pnpm exec tsx --conditions=development --env-file=.env.development

import { NodeRuntime } from '@effect/platform-node';
import { Context, Effect, ManagedRuntime, Schema } from 'effect';
import * as repl from 'node:repl';

import type { UserResponse } from '#modules/users/schemas/user-response.schema.js';

import { AppServicesLive } from '#app.js';
import { CreateUserBodySchema } from '#modules/users/schemas/create-user.schema.js';
import { UpdateUserBodySchema } from '#modules/users/schemas/update-user.schema.js';
import { UserIdSchema } from '#modules/users/schemas/user.schema.js';
import { UsersService } from '#modules/users/service/users.service.js';

type CreateUserReplInput = Schema.Codec.Encoded<typeof CreateUserBodySchema>;
type UpdateUserReplInput = Schema.Codec.Encoded<typeof UpdateUserBodySchema>;

interface UsersReplFacade {
  readonly create: (data: CreateUserReplInput) => Promise<UserResponse>;
  readonly deleteById: (id: string) => Promise<void>;
  readonly getAll: () => Promise<ReadonlyArray<UserResponse>>;
  readonly getById: (id: string) => Promise<UserResponse>;
  readonly update: (
    id: string,
    data: UpdateUserReplInput,
  ) => Promise<UserResponse>;
}

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
      const usersService = Context.get(context, UsersService);

      const getById = (id: string) =>
        Effect.gen(function* () {
          const userId = yield* Schema.decodeEffect(UserIdSchema)(id);

          return yield* usersService.getById(userId);
        });

      const create = (input: CreateUserReplInput) =>
        Effect.gen(function* () {
          const user = yield* Schema.decodeEffect(CreateUserBodySchema)(input);

          return yield* usersService.create(user);
        });

      const update = (id: string, input: UpdateUserReplInput) =>
        Effect.gen(function* () {
          const userId = yield* Schema.decodeEffect(UserIdSchema)(id);
          const user = yield* Schema.decodeEffect(UpdateUserBodySchema)(input);

          return yield* usersService.update(userId, user);
        });

      const deleteById = (id: string) =>
        Effect.gen(function* () {
          const userId = yield* Schema.decodeEffect(UserIdSchema)(id);

          return yield* usersService.deleteById(userId);
        });

      const users: UsersReplFacade = {
        getById: (id) => runtime.runPromise(getById(id)),
        getAll: () => runtime.runPromise(usersService.getAll),
        create: (input) => runtime.runPromise(create(input)),
        update: (id, input) => runtime.runPromise(update(id, input)),
        deleteById: (id) => runtime.runPromise(deleteById(id)),
      };

      const replServer = yield* Effect.sync(() =>
        repl.start({ useColors: true, prompt: '@wishlist/api> ' }),
      );
      replServer.context.users = users;

      yield* setupHistory(replServer);
      yield* waitForExit(replServer);
    }),
  (runtime) => runtime.disposeEffect,
);

NodeRuntime.runMain(program);
