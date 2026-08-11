import type { SqlClient } from '@effect/sql';

import * as PgDrizzle from '@effect/sql-drizzle/Pg';
import { PgClient } from '@effect/sql-pg';
import { Effect, Layer, ManagedRuntime, String } from 'effect';

import { PgConfig } from '#config/config.js';

export const PgClientLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const config = yield* PgConfig;

    return PgClient.layer({
      transformQueryNames: String.camelToSnake,
      transformResultNames: String.snakeToCamel,
      url: config.postgresUrl,
      maxConnections: config.maxConnections,
      idleTimeout: config.idleTimeout,
      connectTimeout: config.connectTimeout,
    });
  }),
);

export const AppLive = PgDrizzle.layer.pipe(Layer.provideMerge(PgClientLive));

export const runtime = ManagedRuntime.make(AppLive);

export type AppContext = PgDrizzle.PgDrizzle | SqlClient.SqlClient;
