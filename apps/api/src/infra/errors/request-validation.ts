import type { HttpApiError } from 'effect/unstable/httpapi';

import { Effect, Schema, SchemaIssue } from 'effect';
import { HttpServerRequest } from 'effect/unstable/http';
import { HttpApiMiddleware } from 'effect/unstable/httpapi';
import { match } from 'ts-pattern';

import { asProblemJson } from '#infra/errors/http-problem.js';
import { makeLiteralUnionSchema } from '#infra/schemas/utils.js';

export const ValidationIssueLocationSchema = makeLiteralUnionSchema([
  'payload',
  'params',
  'query',
  'headers',
]);

export const ValidationIssueLocation = ValidationIssueLocationSchema.values;

export type ValidationIssueLocation = Schema.Schema.Type<
  typeof ValidationIssueLocationSchema
>;

export const RequestValidationIssueSchema = Schema.Struct({
  location: ValidationIssueLocationSchema,
  path: Schema.Array(Schema.Union([Schema.String, Schema.Int])),
  message: Schema.String,
});

export class RequestValidationHttpError extends Schema.Error<RequestValidationHttpError>(
  'RequestValidationHttpError',
)(
  {
    code: Schema.tag('REQUEST_VALIDATION_FAILED'),
    detail: Schema.tag('The request contains invalid data'),
    errors: Schema.Array(RequestValidationIssueSchema),
    instance: Schema.String,
    status: Schema.tag(400),
    title: Schema.tag('Request validation failed'),
    type: Schema.tag('/errors/request-validation'),
  },
  {
    httpApiStatus: 400,
  },
) {}

export class RequestValidationMiddleware extends HttpApiMiddleware.Service<RequestValidationMiddleware>()(
  'app/RequestValidationMiddleware',
  {
    error: RequestValidationHttpError.pipe(asProblemJson),
  },
) {}

const toRequestLocation = (
  kind: HttpApiError.HttpApiSchemaError['kind'],
): ValidationIssueLocation | undefined =>
  match(kind)
    .with('Headers', () => ValidationIssueLocation.headers)
    .with('Query', () => ValidationIssueLocation.query)
    .with('Params', () => ValidationIssueLocation.params)
    .with('Payload', () => ValidationIssueLocation.payload)
    .with('Body', 'ResponseHeaders', () => undefined)
    .exhaustive();

const toPublicPathSegment = (
  segment: PropertyKey | { readonly key: PropertyKey },
): number | string => {
  const key = typeof segment === 'object' ? segment.key : segment;

  return typeof key === 'symbol' ? (key.description ?? key.toString()) : key;
};

const formatSchemaIssue = SchemaIssue.makeFormatterStandardSchemaV1();

export const RequestValidationMiddlewareLive =
  HttpApiMiddleware.layerSchemaErrorTransform(
    RequestValidationMiddleware,
    (err) => {
      const location = toRequestLocation(err.kind);

      if (!location) {
        return Effect.die(
          new Error(`Failed to encode HTTP ${err.kind}`, {
            cause: err,
          }),
        );
      }

      return Effect.gen(function* () {
        const req = yield* HttpServerRequest.HttpServerRequest;
        const pathname = new URL(req.originalUrl, 'http://localhost').pathname;
        const formattedIssues = formatSchemaIssue(err.cause.issue).issues;
        return yield* new RequestValidationHttpError({
          instance: pathname,
          errors: formattedIssues.map((iss) => ({
            location,
            message: iss.message,
            path: (iss.path ?? []).map(toPublicPathSegment),
          })),
        });
      });
    },
  );
