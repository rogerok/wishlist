import type { SqlError } from 'effect/unstable/sql';

import { Option } from 'effect';
import { Context, Effect, Layer, Schema } from 'effect';
import { match } from 'ts-pattern';

import type {
  SessionCreateError,
  SessionDeleteByTokenDigestError,
  SessionGetByTokenDigestError,
} from '#modules/auth/repository/session/session.repository.errors.js';
import type { Session } from '#modules/auth/schemas/session/session.schema.js';
import type { UserId } from '#modules/users/schemas/user.schema.js';

import { DB } from '#infra/db/db.service.js';
import {
  SessionInvalidRecordError,
  SessionRepositoryError,
  SessionTokenDigestAlreadyExistsError,
} from '#modules/auth/repository/session/session.repository.errors.js';
import { SessionOperations } from '#modules/auth/schemas/session/session-operations.schema.js';
import { SessionSchema } from '#modules/auth/schemas/session/session.schema.js';

const sessionSelection = ['userId', 'id', 'createdAt', 'expiresAt'] as const;

const decodeRow = (row: unknown, operation: SessionOperations) =>
  Schema.decodeUnknownEffect(SessionSchema)(row).pipe(
    Effect.mapError(
      (cause) => new SessionInvalidRecordError({ cause, operation }),
    ),
  );

const mapRepoError =
  (operation: SessionOperations) => (cause: SqlError.SqlError) =>
    new SessionRepositoryError({ cause, operation });
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
    .otherwise(
      () =>
        new SessionRepositoryError({
          cause: cause,
          operation: SessionOperations.create,
        }),
    );

interface SessionRepositoryShape {
  readonly create: (
    userId: UserId,
    tokenDigest: Uint8Array,
    expiresAt: Date,
  ) => Effect.Effect<Session, SessionCreateError>;
  readonly deleteByTokenDigest: (
    tokenDigest: Uint8Array,
  ) => Effect.Effect<void, SessionDeleteByTokenDigestError>;
  readonly getByTokenDigest: (
    tokenDigest: Uint8Array,
  ) => Effect.Effect<Option.Option<Session>, SessionGetByTokenDigestError>;
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
        const [row] = yield* db
          .selectFrom('sessions')
          .select(sessionSelection)
          .where('tokenDigest', '=', Buffer.from(tokenDigest))
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
