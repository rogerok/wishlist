import { Result, Schema } from 'effect';
import { Base64Url } from 'effect/encoding';

import { base64UrlRegex } from '#modules/auth/service/constants.js';

const canonicalBase64UrlFilter = Schema.makeFilter<string>(
  (input) => {
    const decoded = Base64Url.decode(input);

    return Result.match(decoded, {
      onFailure: () => false,
      onSuccess: (bytes) => Base64Url.encode(bytes) === input,
    });
  },
  {
    expected: 'a canonical Base64URL string',
  },
);

export const makeFromBase64Schema = (bytesLength: number, textLength: number) =>
  Schema.String.check(
    Schema.isBase64Url(),
    Schema.isPattern(base64UrlRegex),
    Schema.isBetweenLength(textLength, textLength),
    canonicalBase64UrlFilter,
  ).pipe(
    Schema.decodeTo(
      Schema.Uint8ArrayFromBase64Url.check(
        Schema.isBetweenLength(bytesLength, bytesLength),
      ),
    ),
  );
