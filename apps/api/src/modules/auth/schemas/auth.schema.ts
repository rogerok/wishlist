import { Schema } from 'effect';

import { makeFromBase64Schema } from '#modules/auth/schemas/base64url.schema.js';
import {
  tokenBytesLength,
  tokenTextLength,
} from '#modules/auth/service/constants.js';

export const CredentialsSchema = Schema.Redacted(Schema.String);
export const ExpiresAtSchema = Schema.Date;
export const AuthTokenSchema = makeFromBase64Schema(
  tokenBytesLength,
  tokenTextLength,
);
