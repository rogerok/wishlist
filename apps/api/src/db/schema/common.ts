import { sql } from 'drizzle-orm';
import { timestamp, uuid } from 'drizzle-orm/pg-core';

export const common = {
  id: uuid().primaryKey().defaultRandom(),
  createdAt: timestamp({ withTimezone: true, precision: 3 })
    .defaultNow()
    .notNull(),

  updatedAt: timestamp({ withTimezone: true, precision: 3 })
    .defaultNow()
    .$onUpdate(() => sql`now()`)
    .notNull(),
};
