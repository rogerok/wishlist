import { faker } from '@faker-js/faker';
import { Array, Effect, Schema } from 'effect';

import type { CreateUserBodySchema } from '#modules/users/schemas/create-user.schema.js';

import { decodeArgs } from '#infra/repl/repl-facade.js';
import { UsersRepl } from '#modules/users/repl/users.repl.js';

type CreateUserInput = Schema.Codec.Encoded<typeof CreateUserBodySchema>;

const makeCreateUserInput = (): CreateUserInput => {
  const sex = faker.person.sexType();
  const givenName = faker.person.firstName(sex);
  const familyName = faker.person.lastName(sex);
  const username = faker.internet.username({
    firstName: givenName,
    lastName: familyName,
  });
  // A random suffix keeps emails unique across REPL sessions.
  const suffix = faker.string.alphanumeric({ length: 8, casing: 'lower' });

  return {
    displayName: `${givenName} ${familyName}`,
    email: `${username}.${suffix}@example.test`,
  };
};

const FakeCountSchema = Schema.Int.check(
  Schema.isBetween({ minimum: 1, maximum: 100 }),
);

export const UsersFake = Effect.gen(function* () {
  const users = yield* UsersRepl;

  // Overrides go through users.create, so the merged input is still decoded.
  const create = (overrides: Partial<CreateUserInput> = {}) =>
    Effect.gen(function* () {
      const input = yield* Effect.sync(makeCreateUserInput);

      return yield* users.create({ ...input, ...overrides });
    });

  const createMany = decodeArgs([FakeCountSchema], (count) =>
    Effect.forEach(Array.range(1, count), () => create()),
  );

  return { create, createMany };
});
