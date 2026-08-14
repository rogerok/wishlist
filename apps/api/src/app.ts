import { Effect } from 'effect';

// TODO:удалить
export const program = Effect.gen(function* () {
  yield* Effect.log('API started');
});
