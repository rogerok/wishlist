import { defineRelations } from 'drizzle-orm';
import * as PgDrizzle from 'drizzle-orm/effect-postgres';
import { Context, Effect, Layer } from 'effect';

import { users } from '#db/schema/users.js';

const relations = defineRelations({ users });

const dbEffect = PgDrizzle.makeWithDefaults({ relations });
export type DBDrizzle = Effect.Success<typeof dbEffect>;

export class DB extends Context.Service<DB, DBDrizzle>()('app/DB') {}

export const DBLive = Layer.effect(DB, dbEffect);
