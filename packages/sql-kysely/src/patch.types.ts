import type { Effect } from 'effect';
import type { SqlError } from 'effect/unstable/sql/SqlError';
import type { Kysely, Simplify } from 'kysely';

declare module 'kysely' {
  export interface AlterTableColumnAlteringBuilder extends Effect.Effect<
    void,
    SqlError
  > {}
  export interface CreateIndexBuilder<C> extends Effect.Effect<
    void,
    SqlError
  > {}
  export interface CreateSchemaBuilder extends Effect.Effect<void, SqlError> {}
  export interface CreateTableBuilder<TB, C> extends Effect.Effect<
    void,
    SqlError
  > {}
  export interface CreateTypeBuilder extends Effect.Effect<void, SqlError> {}
  export interface CreateViewBuilder extends Effect.Effect<void, SqlError> {}
  export interface DropIndexBuilder extends Effect.Effect<void, SqlError> {}
  export interface DropSchemaBuilder extends Effect.Effect<void, SqlError> {}
  export interface DropTableBuilder extends Effect.Effect<void, SqlError> {}
  export interface DropTypeBuilder extends Effect.Effect<void, SqlError> {}
  export interface DropViewBuilder extends Effect.Effect<void, SqlError> {}
  export interface SelectQueryBuilder<DB, TB, O> extends Effect.Effect<
    Array<Simplify<O>>,
    SqlError
  > {}
  export interface InsertQueryBuilder<DB, TB, O> extends Effect.Effect<
    Array<Simplify<O>>,
    SqlError
  > {}
  export interface UpdateQueryBuilder<DB, UT, TB, O> extends Effect.Effect<
    Array<Simplify<O>>,
    SqlError
  > {}
  export interface DeleteQueryBuilder<DB, TB, O> extends Effect.Effect<
    Array<Simplify<O>>,
    SqlError
  > {}

  export interface WheneableMergeQueryBuilder<
    DB,
    TT,
    ST,
    O,
  > extends Effect.Effect<Array<Simplify<O>>, SqlError> {}
}

/**
 * @since 1.0.0
 * @category types
 */
export interface EffectKysely<DB> extends Omit<Kysely<DB>, 'transaction'> {
  withTransaction: <R, E, A>(
    self: Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, E | SqlError, R>;
}
