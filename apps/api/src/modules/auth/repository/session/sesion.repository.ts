import type { SqlError } from 'effect/sql';

import { Clock, Option } from 'effect';
import { Context, Effect, Layer, Schema } from 'effect';
import { match } from 'ts-pattern';

import type { OperationFailed } from '#infra/errors/operation-failed.js';
import type { Session } from '#modules/auth/schemas/session/session.schema.js';
import type { UserId } from '#modules/users/schemas/user.schema.js';

import { DB } from '#infra/db/db.service.js';
import {
  invalidRecordFailed,
  sqlOperationFailed,
} from '#infra/db/repository-failure.js';
import { SessionTokenDigestAlreadyExistsError } from '#modules/auth/repository/session/session.repository.errors.js';
import { SessionOperations } from '#modules/auth/schemas/session/session-operations.schema.js';
import { SessionSchema } from '#modules/auth/schemas/session/session.schema.js';

const sessionSelection = ['userId', 'id', 'createdAt', 'expiresAt'] as const;
const source = 'sessionRepository';

const decodeRow = (row: unknown, operation: SessionOperations) =>
  Schema.decodeUnknownEffect(SessionSchema)(row).pipe(
    Effect.mapError(invalidRecordFailed(source, operation)),
  );

const mapRepoError = (operation: SessionOperations) =>
  sqlOperationFailed(source, operation);

const mapSessionCreateSqlError = (cause: SqlError.SqlError) =>
  match(cause.reason)
    .with(
      {
        _tag: 'UniqueViolation',
        constraint: 'sessions_token_digest_key',
      },
      () =>
        new SessionTokenDigestAlreadyExistsError({
          operation: SessionOperations.create,
        }),
    )
    .otherwise(() => mapRepoError(SessionOperations.create)(cause));

interface SessionRepositoryShape {
  readonly create: (
    userId: UserId,
    tokenDigest: Uint8Array,
    expiresAt: Date,
  ) => Effect.Effect<
    Session,
    OperationFailed | SessionTokenDigestAlreadyExistsError
  >;
  readonly deleteByTokenDigest: (
    tokenDigest: Uint8Array,
  ) => Effect.Effect<void, OperationFailed>;
  readonly getByTokenDigest: (
    tokenDigest: Uint8Array,
  ) => Effect.Effect<Option.Option<Session>, OperationFailed>;
}

export class SessionRepository extends Context.Service<
  SessionRepository,
  SessionRepositoryShape
>()('app/SessionRepository') {}

export const SessionRepositoryLive = Layer.effect(
  SessionRepository,
  Effect.gen(function* () {
    const db = yield* DB;

    const create: SessionRepositoryShape['create'] = (
      userId,
      tokenDigest,
      expiresAt,
    ) =>
      Effect.gen(function* () {
        const [row] = yield* db
          .insertInto('sessions')
          .values({ userId, tokenDigest: Buffer.from(tokenDigest), expiresAt })
          .returning(sessionSelection)
          .pipe(Effect.mapError(mapSessionCreateSqlError));

        return yield* decodeRow(row, SessionOperations.create);
      });

    const getByTokenDigest: SessionRepositoryShape['getByTokenDigest'] = (
      tokenDigest,
    ) =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;

        const [row] = yield* db
          .selectFrom('sessions')
          .select(sessionSelection)
          .where('tokenDigest', '=', Buffer.from(tokenDigest))
          .where('expiresAt', '>', new Date(now))
          .limit(1)
          .pipe(
            Effect.mapError(mapRepoError(SessionOperations.getByTokenDigest)),
          );

        if (row === undefined) {
          return Option.none();
        }

        const session = yield* decodeRow(
          row,
          SessionOperations.getByTokenDigest,
        );

        return Option.some(session);
      });

    const deleteByTokenDigest: SessionRepositoryShape['deleteByTokenDigest'] = (
      tokenDigest,
    ) =>
      db
        .deleteFrom('sessions')
        .where('tokenDigest', '=', Buffer.from(tokenDigest))
        .pipe(
          Effect.mapError(mapRepoError(SessionOperations.deleteByTokenDigest)),
          Effect.asVoid,
        );

    return { create, getByTokenDigest, deleteByTokenDigest };
  }),
);
