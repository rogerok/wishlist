import type * as Client from 'effect/unstable/sql/SqlClient';
import type { SqlError } from 'effect/unstable/sql/SqlError';
import type { Compilable } from 'kysely';

import * as Effect from 'effect/Effect';
import * as Effectable from 'effect/Effectable';


const COMMIT_ERROR =
  "Kysely instance not properly initialised: use 'make' to create an Effect compatible instance";
const NATIVE_EXECUTION_METHODS = {
  connection: true,
  execute: true,
  executeQuery: true,
  executeTakeFirst: true,
  executeTakeFirstOrThrow: true,
  explain: true,
  stream: true,
  transaction: true,
} as const satisfies Readonly<Record<string, true>>;

interface EffectifiedQuery
  extends Effect.Effect<ReadonlyArray<unknown>, SqlError> {
  commit(): Effect.Effect<ReadonlyArray<unknown>, SqlError>;
}


const PatchProto = {
  ...Effectable.Prototype<EffectifiedQuery>({
    label: 'KyselyQuery',
    evaluate() {
      return this.commit();
    },
  }),
  commit() {
    return Effect.die(new Error(COMMIT_ERROR));
  },
};

/** @internal */
export const patch = (prototype: object) => {
  if (!(Effect.TypeId in prototype)) {
    void Object.assign(prototype, PatchProto);
  }
};

/**
 * @internal
 * this allows multiple database instances to use different Effect SQL clients
 */
function effectifyWith<T>(
  obj: T,
  commit: (
    this: Compilable,
  ) => Effect.Effect<ReadonlyArray<unknown>, SqlError>,
  whitelist: ReadonlyArray<string>,
): T {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const target: object = obj;

  // A Proxy preserves the public Kysely type while changing only runtime behavior.
  return new Proxy(target, {
    get(target, prop, receiver): unknown {
      // Respect the proxy invariant: non-configurable, non-writable
      // properties must return their actual value.
      const descriptor = Object.getOwnPropertyDescriptor(target, prop);
      if (
        descriptor !== undefined &&
        !descriptor.configurable &&
        !descriptor.writable
      ) {
        return Reflect.get(target, prop, target);
      }
      if (
        typeof prop === 'string' &&
        Object.hasOwn(NATIVE_EXECUTION_METHODS, prop)
      ) {
        return () => {
          throw new Error(
            `Kysely.${String(prop)}() is unavailable with the Effect SQL adapter. ` +
              'Yield the query as an Effect instead.',
          );
        };
      }


      const prototype: object | null = Object.getPrototypeOf(target);
      if (
        prototype !== null &&
        Effect.TypeId in prototype &&
        prop === 'commit'
      ) {
        // Only compilable Kysely builders receive the Effect prototype.
        return commit.bind(target as Compilable);
      }

      const value: unknown = Reflect.get(target, prop, target);
      if (Object.prototype.hasOwnProperty.call(PatchProto, prop)) {
        return typeof value === 'function' ? value.bind(receiver) : value;
      }
      if (typeof value === 'function') {
        if (typeof prop === 'string' && whitelist.includes(prop)) {
          return value.bind(target);
        }
        return (...args: Array<unknown>) =>
          effectifyWith(Reflect.apply(value, target, args), commit, whitelist);
      }
      return effectifyWith(value, commit, whitelist);
    },
  }) as T;
}

/** @internal */
const makeSqlCommit = (client: Client.SqlClient) => {
  return function (this: Compilable) {
    const { parameters, sql } = this.compile();
    return client.unsafe(sql, parameters);
  };
};

/**
 *  @internal
 */
export const effectifyWithSql = <T>(
  obj: T,
  client: Client.SqlClient,
  whitelist: Array<string> = [],
): T => effectifyWith(obj, makeSqlCommit(client), whitelist);
