import { Schema } from 'effect';

import { makeBrandedSchema } from '#schemas/utils.js';

const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[#@$!%^&*?_+=\-{}[\]:;"'<>,.()|\\`~/])[A-Za-z\d#$@!%^&*?_+=\-{}[\]:;"'<>,.()|\\`~/]{8,100}$/;

export const PasswordSchema = makeBrandedSchema(
  'Password',
  Schema.String.check(
    Schema.isPattern(passwordRegex, { identifier: 'Password' }),
  ),
);
