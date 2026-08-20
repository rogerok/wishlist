import type { Effect } from 'effect';

export type RunPromise = <A, E>(effect: Effect.Effect<A, E>) => Promise<A>;
