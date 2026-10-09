import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

import { NodeServices } from '@effect/platform-node';
import { PgClient, PgMigrator } from '@effect/sql-pg';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { Context, Effect, Layer, Redacted, String } from 'effect';
import { fileURLToPath } from 'url';

class PostgresContainer extends Context.Service<
  PostgresContainer,
  StartedPostgreSqlContainer
>()('test/PostgresContainer') {}

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
      transformQueryNames: String.camelToSnake,
      transformResultNames: String.snakeToCamel,
    });
  }),
).pipe(Layer.provide(PostgresContainerLive));

export const migrationsDir = fileURLToPath(
  new URL('./migrations/', import.meta.url),
);

// Пустая БД без миграций: для тестов, которые применяют миграции по шагам.
export const EmptyTestDatabaseLive = Layer.mergeAll(
  PgClientLive,
  NodeServices.layer,
);
const MigrationsLive = Layer.effectDiscard(
  PgMigrator.run({
    loader: PgMigrator.fromFileSystem(migrationsDir),
  }),
);

export const TestDatabaseLive = MigrationsLive.pipe(
  Layer.provideMerge(EmptyTestDatabaseLive),
);
