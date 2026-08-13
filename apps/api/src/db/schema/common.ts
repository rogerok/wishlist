import { timestamp, uuid } from 'drizzle-orm/pg-core';

export const common = {
  id: uuid().primaryKey().defaultRandom(),
  createdAt: timestamp({ withTimezone: true, precision: 3 })
    .$default(() => new Date())
    .notNull(),
  updatedAt: timestamp({ withTimezone: true, precision: 3 })
    .$onUpdate(() => new Date())
    .notNull(),
};
