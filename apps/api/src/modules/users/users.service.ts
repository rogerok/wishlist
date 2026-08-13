import { Context, Data, Effect, Layer, Option } from 'effect';

import {
  makeUserNotFoundError,
  UserNotFoundError,
} from '#modules/users/errors/user-not-found.error.js';
import { UserMissing } from '#modules/users/repository/users-repository.errors.js';
import {
  UserRecord,
  UsersRepository,
} from '#modules/users/repository/users.repository.js';
import { UserResponse } from '#modules/users/schemas/user-response.schema.js';
import { UserId } from '#modules/users/schemas/user.schema.js';

export class UsersUnavailable extends Data.TaggedError('UsersUnavailable')<{
  readonly cause: unknown;
}> {}

export interface UsersServiceShape {
  readonly getAll: Effect.Effect<ReadonlyArray<UserRecord>, UsersUnavailable>;
  readonly getById: (
    id: UserId,
  ) => Effect.Effect<UserResponse, UserNotFoundError>;
}

export class UsersService extends Context.Service<
  UsersService,
  UsersServiceShape
>()('app/UsersService') {}

export const UsersServiceLive = Layer.effect(
  UsersService,
  Effect.gen(function* () {
    const repository = yield* UsersRepository;

    // const getById: UsersServiceShape['getById'] = (id) =>
    //   repository.getById(id).pipe(
    //     Effect.mapError(
    //       (cause) =>
    //         new UsersUnavailable({
    //           cause,
    //         }),
    //     ),
    //     Effect.flatMap(
    //       Option.match({
    //         onNone: () =>
    //           Effect.fail(
    //             new UserMissing({
    //               user: id,
    //             }),
    //           ),
    //         onSome: Effect.succeed,
    //       }),
    //     ),
    //   );
    //
    const getById: UsersServiceShape['getById'] = (id) =>
      repository.getById(id).pipe(
        Effect.mapError((cause) => makeUserNotFoundError({ cause, id })),
        Effect.flatMap(
          Option.match({
            onNone: () => makeUserNotFoundError({ id }),
            onSome: Effect.succeed,
          }),
        ),
      );

    const getAll: UsersServiceShape['getAll'] = repository
      .getAll()
      .pipe(Effect.mapError((cause) => new UsersUnavailable({ cause })));

    return { getById, getAll };
  }),
);
