import type { Effect } from 'effect';

import * as PgKysely from '@repo/sql-kysely/pg';
import { Context, Layer } from 'effect';
import { CamelCasePlugin } from 'kysely';

import type { DB as Database } from '#/infra/db/generated/database.js';

const dbEffect = PgKysely.make<Database>({
  plugins: [new CamelCasePlugin()],
});

export type DBKysely = Effect.Success<typeof dbEffect>;

export class DB extends Context.Service<DB, DBKysely>()('app/DB') {}

export const DBLive = Layer.effect(DB, dbEffect);
