import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { Generated } from 'kysely';

import { PgClient } from '@effect/sql-pg';
import { assert, layer } from '@effect/vitest';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { Context, Effect, Exit, Layer, Redacted } from 'effect';

import * as PgKysely from '../src/pg.js';

interface User {
  readonly id: Generated<number>;
  readonly name: string;
  readonly nickname: string | null;
}

interface Database {
  readonly crudUsers: User;
  readonly transactionUsers: User;
}

class TestDatabase extends Context.Service<
  TestDatabase,
  PgKysely.EffectKysely<Database>
>()('test/sql-kysely/TestDatabase') {}

class PostgresContainer extends Context.Service<
  PostgresContainer,
  StartedPostgreSqlContainer
>()('test/sql-kysely/PostgresContainer') {}

const PostgresContainerLive = Layer.effect(
  PostgresContainer,
  Effect.acquireRelease(
    Effect.promise(() =>
      new PostgreSqlContainer('postgres:16.3-alpine3.19').start(),
    ),
    (container) => Effect.promise(() => container.stop()),
  ),
);

const PgClientLive = Layer.unwrap(
  Effect.gen(function* () {
    const container = yield* PostgresContainer;

    return PgClient.layer({
      url: Redacted.make(container.getConnectionUri()),
    });
  }),
).pipe(Layer.provide(PostgresContainerLive));

const TestDatabaseLive = Layer.effect(
  TestDatabase,
  PgKysely.make<Database>(),
).pipe(Layer.provide(PgClientLive));

layer(TestDatabaseLive, { timeout: '60 seconds' })('PgKysely', (it) => {
  it.effect('executes PostgreSQL CRUD queries', () =>
    Effect.gen(function* () {
      const db = yield* TestDatabase;

      yield* db.schema
        .createTable('crudUsers')
        .addColumn('id', 'serial', (column) => column.primaryKey())
        .addColumn('name', 'text', (column) => column.notNull())
        .addColumn('nickname', 'text');

      const inserted = yield* db
        .insertInto('crudUsers')
        .values({ name: 'Alice' })
        .returningAll();
      const selected = yield* db.selectFrom('crudUsers').selectAll();
      const updated = yield* db
        .updateTable('crudUsers')
        .set({ name: 'Bob', nickname: 'The Bobinator' })
        .returningAll();
      const deleted = yield* db.deleteFrom('crudUsers').returningAll();

      assert.deepStrictEqual(inserted, [
        { id: 1, name: 'Alice', nickname: null },
      ]);
      assert.deepStrictEqual(selected, [
        { id: 1, name: 'Alice', nickname: null },
      ]);
      assert.deepStrictEqual(updated, [
        { id: 1, name: 'Bob', nickname: 'The Bobinator' },
      ]);
      assert.deepStrictEqual(deleted, [
        { id: 1, name: 'Bob', nickname: 'The Bobinator' },
      ]);
    }),
  );
  it.effect('rejects native Kysely execution methods', () =>
    Effect.gen(function* () {
      const db = yield* TestDatabase;

      assert.throws(
        () => {
          void db.selectFrom('crudUsers').selectAll().execute();
        },
        /Kysely\.execute\(\).*Yield the query as an Effect/,
      );
    }),
  );


  it.effect('rolls back failed transactions', () =>
    Effect.gen(function* () {
      const db = yield* TestDatabase;

      yield* db.schema
        .createTable('transactionUsers')
        .addColumn('id', 'serial', (column) => column.primaryKey())
        .addColumn('name', 'text', (column) => column.notNull())
        .addColumn('nickname', 'text');

      const transactionExit = yield* Effect.exit(
        db.withTransaction(
          Effect.gen(function* () {
            yield* db
              .insertInto('transactionUsers')
              .values({ name: 'Rolled back' });
            return yield* Effect.fail('rollback');
          }),
        ),
      );

      assert.isTrue(Exit.isFailure(transactionExit));

      const users = yield* db.selectFrom('transactionUsers').selectAll();
      assert.deepStrictEqual(users, []);
    }),
  );
});
