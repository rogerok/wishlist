import { HttpApiSchema } from 'effect/unstable/httpapi';

export const asProblemJson = HttpApiSchema.asJson({
  contentType: 'application/problem+json',
});
