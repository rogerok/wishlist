import { Effect } from 'effect';

import { decodeArgs } from '#infra/repl/repl-facade.js';
import { CreateUserBodySchema } from '#modules/users/schemas/create-user.schema.js';
import { UpdateUserBodySchema } from '#modules/users/schemas/update-user.schema.js';
import { UserIdSchema } from '#modules/users/schemas/user.schema.js';
import { UsersService } from '#modules/users/service/users.service.js';

export const UsersRepl = Effect.gen(function* () {
  const users = yield* UsersService;

  return {
    getAll: users.getAll,
    getById: decodeArgs([UserIdSchema], users.getById),
    create: decodeArgs([CreateUserBodySchema], users.create),
    update: decodeArgs([UserIdSchema, UpdateUserBodySchema], users.update),
    deleteById: decodeArgs([UserIdSchema], users.deleteById),
  };
});
