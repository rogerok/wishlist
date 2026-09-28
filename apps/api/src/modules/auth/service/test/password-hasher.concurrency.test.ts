import type * as Crypto from 'node:crypto';

import { describe, expect, it } from '@effect/vitest';
import { randomBytes } from 'crypto';
import { Deferred, Effect, Exit, Fiber, Redacted, Result } from 'effect';
import { beforeEach, vi } from 'vitest';

import { serializePasswordHash } from '#modules/auth/service/password-hash-format.js';
import {
  PasswordHashIntegrityError,
  PasswordHashOverloadedError,
} from '#modules/auth/service/password-hasher.service.errors.js';
import {
  PasswordHasher,
  PasswordHasherLive,
} from '#modules/auth/service/password-hasher.service.js';
import { SecurePrimitiveUnavailableError } from '#modules/auth/service/session-token-generator.errors.js';

type Scrypt = typeof Crypto.scrypt;
const scryptMock = vi.hoisted(() => vi.fn<Scrypt>());

beforeEach(() => {
  scryptMock.mockReset();
  vi.mocked(randomBytes).mockReset();
});

vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof Crypto>();

  return {
    ...actual,
    randomBytes: vi.fn(actual.randomBytes),
    scrypt: scryptMock,
  };
});

// A callback owns a native operation until the test explicitly completes it.
// On scope exit, drain even unexpected work so a failed assertion cannot leave
// an uninterruptible mock operation waiting forever.
const controlledScrypt = Effect.acquireRelease(
  Effect.sync(() => {
    const pending = new Map<number, (error: Error | null) => void>();
    let nextId = 0;
    scryptMock.mockImplementation(
      (_password, _salt, keyLength, _options, callback) => {
        const id = nextId++;
        const complete = (error: Error | null) => {
          pending.delete(id);
          callback(error, Buffer.alloc(keyLength));
        };
        pending.set(id, complete);
      },
    );
    return {
      get active() {
        return pending.size;
      },
      finish: (id: number, error: Error | null = null) =>
        Effect.gen(function* () {
          const callback = pending.get(id);
          if (callback === undefined) {
            return yield* Effect.die(new Error(`No pending scrypt call ${id}`));
          }
          callback(error);
        }),
      drain: () => {
        scryptMock.mockImplementation(
          (_password, _salt, keyLength, _options, callback) => {
            callback(null, Buffer.alloc(keyLength));
          },
        );
        for (const finish of [...pending.values()]) finish(null);
      },
    };
  }),
  (crypto) => Effect.sync(crypto.drain),
);

const password = Redacted.make('test-password');
const storedHash = serializePasswordHash(Buffer.alloc(16), Buffer.alloc(32));

describe('PasswordHasher concurrency', () => {
  it.effect('limits active derivations to two', () =>
    Effect.gen(function* () {
      const hasher = yield* PasswordHasher;
      const password = Redacted.make('password');

      const twoStarted = yield* Deferred.make<void>();
      const threeStarted = yield* Deferred.make<void>();

      const finishCall = (index: number) =>
        Effect.gen(function* () {
          const call = scryptMock.mock.calls[index];

          if (call === undefined) {
            return yield* Effect.die(
              new Error(`Expected a recorded scrypt call at index ${index}`),
            );
          }

          const keyLength = call[2];
          const callback = call[4];

          callback(null, Buffer.alloc(keyLength));
        });

      scryptMock.mockImplementation(() => {
        switch (scryptMock.mock.calls.length) {
          case 2:
            Deferred.doneUnsafe(twoStarted, Effect.void);
            return;
          case 3:
            Deferred.doneUnsafe(threeStarted, Effect.void);
            return;
        }
      });

      const firstFiber = yield* Effect.forkChild(hasher.hash(password));
      const secondFiber = yield* Effect.forkChild(hasher.hash(password));
      yield* Deferred.await(twoStarted);

      const thirdFiber = yield* Effect.forkChild(hasher.hash(password), {
        startImmediately: true,
      });

      const callsBeforeRelease = scryptMock.mock.calls.length;
      yield* finishCall(0);
      yield* Deferred.await(threeStarted);
      yield* finishCall(1);
      yield* finishCall(2);

      yield* Fiber.joinAll([firstFiber, secondFiber, thirdFiber]);

      expect(callsBeforeRelease).toBe(2);
      expect(scryptMock).toHaveBeenCalledTimes(3);
    }).pipe(Effect.provide(PasswordHasherLive)),
  );

  it.effect(
    'rejects hash and verify when execution and waiting capacity are full',
    () =>
      Effect.gen(function* () {
        const hasher = yield* PasswordHasher;
        const password = Redacted.make('password');
        const storedHash = yield* serializePasswordHash(
          Buffer.alloc(16),
          Buffer.alloc(32),
        );
        const twoStarted = yield* Deferred.make<void>();

        scryptMock.mockImplementation(() => {
          if (scryptMock.mock.calls.length === 2) {
            Deferred.doneUnsafe(twoStarted, Effect.void);
          }
        });

        const firstFiber = yield* Effect.forkChild(hasher.hash(password));
        const secondFiber = yield* Effect.forkChild(
          hasher.verify(password, storedHash),
        );
        yield* Deferred.await(twoStarted);

        const thirdFiber = yield* Effect.forkChild(hasher.hash(password), {
          startImmediately: true,
        });
        const fourthFiber = yield* Effect.forkChild(
          hasher.verify(password, storedHash),
          { startImmediately: true },
        );

        const excessHashFiber = yield* Effect.forkChild(
          Effect.result(hasher.hash(password)),
          { startImmediately: true },
        );
        const excessVerifyFiber = yield* Effect.forkChild(
          Effect.result(hasher.verify(password, storedHash)),
          { startImmediately: true },
        );

        // Snapshot before any callback: overload must not wait for a permit.
        const excessHashExit = excessHashFiber.pollUnsafe();
        const excessVerifyExit = excessVerifyFiber.pollUnsafe();
        const callsBeforeRelease = scryptMock.mock.calls.length;
        const pendingCalls = [...scryptMock.mock.calls];

        // Drain queued work even if a regression admitted the excess requests.
        scryptMock.mockImplementation(
          (_password, _salt, keyLength, _options, callback) => {
            callback(null, Buffer.alloc(keyLength));
          },
        );
        for (const call of pendingCalls) {
          call[4](null, Buffer.alloc(call[2]));
        }

        const results = yield* Fiber.joinAll([
          firstFiber,
          secondFiber,
          thirdFiber,
          fourthFiber,
        ]);
        yield* Fiber.joinAll([excessHashFiber, excessVerifyFiber]);

        expect(callsBeforeRelease).toBe(2);
        expect(scryptMock).toHaveBeenCalledTimes(4);
        expect(results[1]).toBe(true);
        expect(results[3]).toBe(true);

        if (excessHashExit === undefined || excessVerifyExit === undefined) {
          return yield* Effect.die(
            new Error('Expected excess requests to fail before any callback'),
          );
        }
        if (
          !Exit.isSuccess(excessHashExit) ||
          !Exit.isSuccess(excessVerifyExit)
        ) {
          return yield* Effect.die(
            new Error('Expected overload to remain in the typed error channel'),
          );
        }

        expect(excessHashExit.value).toBeResultFailure(
          PasswordHashOverloadedError,
          {},
        );
        expect(excessVerifyExit.value).toBeResultFailure(
          PasswordHashOverloadedError,
          {},
        );
      }).pipe(Effect.provide(PasswordHasherLive)),
  );

  it.effect.each(['hash', 'verify'] as const)(
    'returns execution and admission permits after a %s callback failure',
    (operation) =>
      Effect.gen(function* () {
        const crypto = yield* controlledScrypt;
        const hasher = yield* PasswordHasher;
        const stored = yield* storedHash;
        const failure = new Error('native scrypt failure');
        const failed = yield* Effect.forkChild(
          Effect.result(
            operation === 'hash'
              ? Effect.asVoid(hasher.hash(password))
              : Effect.asVoid(hasher.verify(password, stored)),
          ),
          { startImmediately: true },
        );
        const active = yield* Effect.forkChild(hasher.hash(password), {
          startImmediately: true,
        });
        const waiting = yield* Effect.forkChild(hasher.hash(password), {
          startImmediately: true,
        });
        const otherWaiting = yield* Effect.forkChild(
          hasher.verify(password, stored),
          { startImmediately: true },
        );

        yield* crypto.finish(0, failure);
        const result = yield* Fiber.join(failed);
        yield* Effect.yieldNow;
        const callsAfterFailure = scryptMock.mock.calls.length;
        const activeAfterFailure = crypto.active;
        const replacement = yield* Effect.forkChild(
          Effect.result(hasher.hash(password)),
          { startImmediately: true },
        );

        crypto.drain();
        yield* Fiber.joinAll([active, waiting, otherWaiting]);
        const replacementResult = yield* Fiber.join(replacement);

        expect(result).toBeResultFailure(SecurePrimitiveUnavailableError, {
          cause: failure,
        });
        expect(callsAfterFailure).toBe(3);
        expect(activeAfterFailure).toBe(2);
        expect(Result.isSuccess(replacementResult)).toBe(true);
        expect(scryptMock).toHaveBeenCalledTimes(5);
      }).pipe(Effect.scoped, Effect.provide(PasswordHasherLive)),
  );

  it.effect(
    'keeps synchronous scrypt throws as defects and releases permits',
    () =>
      Effect.gen(function* () {
        const crypto = yield* controlledScrypt;
        const hasher = yield* PasswordHasher;
        const failure = new Error('invalid native configuration');

        for (let attempt = 0; attempt < 5; attempt++) {
          scryptMock.mockImplementationOnce(() => {
            throw failure;
          });
          const exit = yield* Effect.exit(hasher.hash(password));
          expect(Exit.hasDies(exit)).toBe(true);
          expect(Exit.hasFails(exit)).toBe(false);
          expect(Exit.findDefect(exit)).toBeResultSuccess(failure);
        }

        const first = yield* Effect.forkChild(hasher.hash(password), {
          startImmediately: true,
        });
        const second = yield* Effect.forkChild(hasher.hash(password), {
          startImmediately: true,
        });
        const activeAfterFailures = crypto.active;
        crypto.drain();
        yield* Fiber.joinAll([first, second]);

        expect(activeAfterFailures).toBe(2);
      }).pipe(Effect.scoped, Effect.provide(PasswordHasherLive)),
  );

  it.effect(
    'removes an interrupted waiter and reuses its admission permit',
    () =>
      Effect.gen(function* () {
        const crypto = yield* controlledScrypt;
        const hasher = yield* PasswordHasher;
        const stored = yield* storedHash;
        const first = yield* Effect.forkChild(hasher.hash(password), {
          startImmediately: true,
        });
        const second = yield* Effect.forkChild(hasher.hash(password), {
          startImmediately: true,
        });
        const cancelled = yield* Effect.forkChild(
          hasher.verify(password, stored),
          { startImmediately: true },
        );
        const waiting = yield* Effect.forkChild(hasher.hash(password), {
          startImmediately: true,
        });

        yield* Fiber.interrupt(cancelled);
        const cancelledExit = yield* Fiber.await(cancelled);
        const replacement = yield* Effect.forkChild(
          Effect.result(hasher.verify(password, stored)),
          { startImmediately: true },
        );
        const callsBeforeRelease = scryptMock.mock.calls.length;
        const replacementBeforeRelease = replacement.pollUnsafe();

        crypto.drain();
        yield* Fiber.joinAll([first, second, waiting]);
        const replacementResult = yield* Fiber.join(replacement);

        expect(Exit.hasInterrupts(cancelledExit)).toBe(true);
        expect(callsBeforeRelease).toBe(2);
        expect(replacementBeforeRelease).toBeUndefined();
        expect(replacementResult).toBeResultSuccess(true);
        // Two active jobs, one surviving waiter and its replacement; no cancelled job.
        expect(scryptMock).toHaveBeenCalledTimes(4);
      }).pipe(Effect.scoped, Effect.provide(PasswordHasherLive)),
  );

  it.effect(
    'holds both permits after active interruption until the callback',
    () =>
      Effect.gen(function* () {
        const crypto = yield* controlledScrypt;
        const hasher = yield* PasswordHasher;
        const stored = yield* storedHash;
        const cancelled = yield* Effect.forkChild(hasher.hash(password), {
          startImmediately: true,
        });
        const second = yield* Effect.forkChild(
          hasher.verify(password, stored),
          { startImmediately: true },
        );
        const waiting = yield* Effect.forkChild(hasher.hash(password), {
          startImmediately: true,
        });
        const otherWaiting = yield* Effect.forkChild(
          hasher.verify(password, stored),
          { startImmediately: true },
        );

        const interruption = yield* Effect.forkChild(
          Fiber.interrupt(cancelled),
          {
            startImmediately: true,
          },
        );
        yield* Effect.yieldNow;
        const cancelledBeforeCallback = cancelled.pollUnsafe();
        const interruptionBeforeCallback = interruption.pollUnsafe();
        const callsBeforeCallback = scryptMock.mock.calls.length;
        const excess = yield* Effect.forkChild(
          Effect.result(hasher.hash(password)),
          { startImmediately: true },
        );
        const excessBeforeCallback = excess.pollUnsafe();

        yield* crypto.finish(0);
        yield* Fiber.join(interruption);
        yield* Effect.yieldNow;
        const callsAfterCallback = scryptMock.mock.calls.length;
        const activeAfterCallback = crypto.active;
        const replacement = yield* Effect.forkChild(
          Effect.result(hasher.hash(password)),
          { startImmediately: true },
        );

        crypto.drain();
        yield* Fiber.joinAll([second, waiting, otherWaiting]);
        yield* Fiber.join(excess);
        const cancelledExit = yield* Fiber.await(cancelled);
        const replacementResult = yield* Fiber.join(replacement);

        expect(cancelledBeforeCallback).toBeUndefined();
        expect(interruptionBeforeCallback).toBeUndefined();
        expect(callsBeforeCallback).toBe(2);
        expect(callsAfterCallback).toBe(3);
        expect(activeAfterCallback).toBe(2);
        expect(Exit.hasInterrupts(cancelledExit)).toBe(true);
        expect(Result.isSuccess(replacementResult)).toBe(true);
        if (
          excessBeforeCallback === undefined ||
          !Exit.isSuccess(excessBeforeCallback)
        ) {
          return yield* Effect.die(
            new Error('Expected immediate typed overload'),
          );
        }
        expect(excessBeforeCallback.value).toBeResultFailure(
          PasswordHashOverloadedError,
          {},
        );
        expect(scryptMock).toHaveBeenCalledTimes(5);
      }).pipe(Effect.scoped, Effect.provide(PasswordHasherLive)),
  );

  it.effect(
    'rejects malformed hashes before admission even at full capacity',
    () =>
      Effect.gen(function* () {
        const crypto = yield* controlledScrypt;
        const hasher = yield* PasswordHasher;
        const fibers = [];
        for (let index = 0; index < 4; index++) {
          fibers.push(
            yield* Effect.forkChild(hasher.hash(password), {
              startImmediately: true,
            }),
          );
        }
        const malformed = yield* Effect.forkChild(
          Effect.result(hasher.verify(password, 'invalid-hash')),
          { startImmediately: true },
        );
        const malformedBeforeRelease = malformed.pollUnsafe();
        const callsBeforeRelease = scryptMock.mock.calls.length;

        crypto.drain();
        yield* Fiber.joinAll(fibers);
        yield* Fiber.join(malformed);

        expect(callsBeforeRelease).toBe(2);
        expect(scryptMock).toHaveBeenCalledTimes(4);
        if (
          malformedBeforeRelease === undefined ||
          !Exit.isSuccess(malformedBeforeRelease)
        ) {
          return yield* Effect.die(
            new Error('Expected immediate typed integrity failure'),
          );
        }
        expect(malformedBeforeRelease.value).toBeResultFailure(
          PasswordHashIntegrityError,
          {},
        );
      }).pipe(Effect.scoped, Effect.provide(PasswordHasherLive)),
  );

  it.effect('propagates random-source failure without starting scrypt', () =>
    Effect.gen(function* () {
      const crypto = yield* controlledScrypt;
      const hasher = yield* PasswordHasher;
      const failure = new Error('random source unavailable');
      vi.mocked(randomBytes).mockImplementationOnce(() => {
        throw failure;
      });

      const result = yield* Effect.result(hasher.hash(password));
      const callsAfterFailure = scryptMock.mock.calls.length;

      // A transient random-source failure must not poison subsequent calls.
      const recovery = yield* Effect.forkChild(hasher.hash(password), {
        startImmediately: true,
      });
      crypto.drain();
      const recoveredHash = yield* Fiber.join(recovery);
      const verified = yield* hasher.verify(password, recoveredHash);

      expect(result).toBeResultFailure(SecurePrimitiveUnavailableError, {
        cause: failure,
      });
      expect(callsAfterFailure).toBe(0);
      expect(verified).toBe(true);
    }).pipe(Effect.scoped, Effect.provide(PasswordHasherLive)),
  );

  it.effect(
    'reuses the full execution and waiting capacity after success',
    () =>
      Effect.gen(function* () {
        const hasher = yield* PasswordHasher;
        const stored = yield* storedHash;

        for (let batch = 0; batch < 2; batch++) {
          const crypto = yield* controlledScrypt;
          const first = yield* Effect.forkChild(hasher.hash(password), {
            startImmediately: true,
          });
          const second = yield* Effect.forkChild(
            hasher.verify(password, stored),
            { startImmediately: true },
          );
          const third = yield* Effect.forkChild(hasher.hash(password), {
            startImmediately: true,
          });
          const fourth = yield* Effect.forkChild(
            hasher.verify(password, stored),
            { startImmediately: true },
          );
          const activeBeforeRelease = crypto.active;
          crypto.drain();
          const results = yield* Fiber.joinAll([first, second, third, fourth]);

          expect(activeBeforeRelease).toBe(2);
          expect(results[1]).toBe(true);
          expect(results[3]).toBe(true);
        }
        expect(scryptMock).toHaveBeenCalledTimes(8);
      }).pipe(Effect.scoped, Effect.provide(PasswordHasherLive)),
  );
});
