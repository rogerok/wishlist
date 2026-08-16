import type { KyselyConfig } from 'kysely';

import * as Effect from 'effect/Effect';
import * as Client from 'effect/unstable/sql/SqlClient';
import {
  AlterTableColumnAlteringBuilder,
  CreateIndexBuilder,
  CreateSchemaBuilder,
  CreateTableBuilder,
  CreateTypeBuilder,
  CreateViewBuilder,
  DeleteQueryBuilder,
  DropIndexBuilder,
  DropSchemaBuilder,
  DropTableBuilder,
  DropTypeBuilder,
  DropViewBuilder,
  InsertQueryBuilder,
  Kysely,
  UpdateQueryBuilder,
  WheneableMergeQueryBuilder,
} from 'kysely';

import type { EffectKysely } from '../patch.types.js';

import { effectifyWithSql, patch } from './patch.js';

/**
 * @internal
 * patch all compilable/executable builders with commit prototypes
 *
 * @warning side effect
 */
patch(AlterTableColumnAlteringBuilder.prototype);
patch(CreateIndexBuilder.prototype);
patch(CreateSchemaBuilder.prototype);
patch(CreateTableBuilder.prototype);
patch(CreateTypeBuilder.prototype);
patch(CreateViewBuilder.prototype);
patch(DropIndexBuilder.prototype);
patch(DropSchemaBuilder.prototype);
patch(DropTableBuilder.prototype);
patch(DropTypeBuilder.prototype);
patch(DropViewBuilder.prototype);
patch(InsertQueryBuilder.prototype);
patch(UpdateQueryBuilder.prototype);
patch(DeleteQueryBuilder.prototype);
patch(WheneableMergeQueryBuilder.prototype);

export const makeWithSql = <DB>(config: KyselyConfig) =>
  Effect.gen(function* () {
    const client = yield* Client.SqlClient;

    const db = new Kysely<DB>(config) as unknown as EffectKysely<DB>;
    db.withTransaction = client.withTransaction;

    // selectNoFrom exposes the otherwise unexported SelectQueryBuilder prototype
    // without inventing a table name outside the generic database schema.
    const selectPrototype: object = Object.getPrototypeOf(db.selectNoFrom([]));
    patch(selectPrototype);

    return effectifyWithSql(db, client, ['withTransaction', 'compile']);
  });
