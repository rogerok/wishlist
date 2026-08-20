import { Effect, Schema } from 'effect';

import type { UserResponse } from '#modules/users/schemas/user-response.schema.js';
import type { RunPromise } from '#repl/repl.types.js';

import { CreateUserBodySchema } from '#modules/users/schemas/create-user.schema.js';
import { UpdateUserBodySchema } from '#modules/users/schemas/update-user.schema.js';
import { UserIdSchema } from '#modules/users/schemas/user.schema.js';
import { UsersService } from '#modules/users/service/users.service.js';

type CreateUserReplInput = Schema.Codec.Encoded<typeof CreateUserBodySchema>;

type UpdateUserReplInput = Schema.Codec.Encoded<typeof UpdateUserBodySchema>;

export interface UsersReplFacade {
  readonly create: (data: CreateUserReplInput) => Promise<UserResponse>;
  readonly deleteById: (id: string) => Promise<void>;
  readonly getAll: () => Promise<ReadonlyArray<UserResponse>>;
  readonly getById: (id: string) => Promise<UserResponse>;
  readonly update: (
    id: string,
    data: UpdateUserReplInput,
  ) => Promise<UserResponse>;
}

export const makeUsersRepl = (runPromise: RunPromise) =>
  Effect.gen(function* () {
    const usersService = yield* UsersService;

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
      getById: (id) => runPromise(getById(id)),
      getAll: () => runPromise(usersService.getAll),
      create: (input) => runPromise(create(input)),
      update: (id, input) => runPromise(update(id, input)),
      deleteById: (id) => runPromise(deleteById(id)),
    };

    return users;
  });
