import { Schema } from 'effect';

import { makeFromBase64Schema } from '#modules/auth/schemas/base64url.schema.js';
import {
  derivedKeyBytesLength,
  derivedKeyTextLength,
  saltBytesLength,
  saltTextLength,
} from '#modules/auth/service/constants.js';

export const StoredPasswordHashSchema = Schema.String.pipe(
  Schema.brand('StoredPasswordHash'),
);
export type StoredPasswordHash = Schema.Schema.Type<
  typeof StoredPasswordHashSchema
>;

export const SaltFromBase64Schema = makeFromBase64Schema(
  saltBytesLength,
  saltTextLength,
);

export const DerivedKeyFromBase64Schema = makeFromBase64Schema(
  derivedKeyBytesLength,
  derivedKeyTextLength,
);
