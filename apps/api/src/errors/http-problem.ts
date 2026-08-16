import { Effect, Schema } from 'effect';
import { HttpApiSchema } from 'effect/unstable/httpapi';

export interface HttpProblemDefinition {
  readonly code: string;
  readonly detail: string;
  readonly status: number;
  readonly title: string;
  readonly type: string;
}

const literalWithDefault = <V extends number | string>(value: V) =>
  Schema.Literal(value).pipe(
    Schema.withConstructorDefault(Effect.succeed(value)),
  );

export const makeHttpProblemFields = <Definition extends HttpProblemDefinition>(
  definition: Definition,
) => ({
  code: literalWithDefault(definition.code),
  detail: literalWithDefault(definition.detail),
  status: literalWithDefault(definition.status),
  title: literalWithDefault(definition.title),
  type: literalWithDefault(definition.type),
});

export const asProblemJson = HttpApiSchema.asJson({
  contentType: 'application/problem+json',
});
