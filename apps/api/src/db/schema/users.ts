import { pgEnum, snakeCase, uniqueIndex, varchar } from 'drizzle-orm/pg-core';

import { lower } from '#db/utils.js';

import { common } from './common.js';

export const roles = pgEnum('roles', ['admin', 'user']);

export const USERS_EMAIL_UNIQUE_CONSTRAINT = 'users_email_lower_unique_idx';

export const users = snakeCase.table(
  'users',
  {
    ...common,
    email: varchar({ length: 255 }).notNull(),
    middleName: varchar({ length: 255 }),
    firstName: varchar({ length: 255 }),
    lastName: varchar({ length: 255 }),
    role: roles().default('user').notNull(),
  },
  (table) => [
    uniqueIndex(USERS_EMAIL_UNIQUE_CONSTRAINT).on(lower(table.email)),
  ],
);
