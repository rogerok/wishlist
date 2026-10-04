import { Encoding, Result, Schema } from 'effect';

import { base64UrlRegex } from '#modules/auth/service/constants.js';

const canonicalBase64UrlFilter = Schema.makeFilter<string>(
  (input) => {
    const decoded = Encoding.decodeBase64Url(input);

    return Result.match(decoded, {
      onFailure: () => false,
      onSuccess: (bytes) => Encoding.encodeBase64Url(bytes) === input,
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
    Schema.isLengthBetween(textLength, textLength),
    canonicalBase64UrlFilter,
  ).pipe(
    Schema.decodeTo(
      Schema.Uint8ArrayFromBase64Url.check(
        Schema.isLengthBetween(bytesLength, bytesLength),
      ),
    ),
  );
