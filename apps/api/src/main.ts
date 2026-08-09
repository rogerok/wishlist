import { NodeRuntime } from '@effect/platform-node';
import { Effect } from 'effect';

const program = Effect.gen(function* () {
  yield* Effect.log('API started');
});

NodeRuntime.runMain(program);
