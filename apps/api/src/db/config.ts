import { PgClient } from '@effect/sql-pg';
import { Effect, Layer, String } from 'effect';

import { PgConfig } from '#config/config.js';

export const PgClientLive = Layer.unwrap(
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
