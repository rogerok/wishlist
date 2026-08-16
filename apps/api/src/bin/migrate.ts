import { NodeRuntime, NodeServices } from '@effect/platform-node';
import { PgMigrator } from '@effect/sql-pg';
import { Effect } from 'effect';
import { fileURLToPath } from 'url';

import { PgClientLive } from '#db/config.js';

const migrationsDir = fileURLToPath(
  new URL('../db/migrations', import.meta.url),
);

const program = Effect.gen(function* () {
  const appliedMigrations = yield* PgMigrator.run({
    loader: PgMigrator.fromFileSystem(migrationsDir),
  });

  yield* Effect.logInfo(
    !appliedMigrations.length
      ? 'DB schema is up to date'
      : `Applied ${appliedMigrations.length} migrations`,
  );
}).pipe(Effect.provide([PgClientLive, NodeServices.layer]));

NodeRuntime.runMain(program);
