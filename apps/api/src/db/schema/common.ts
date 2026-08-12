import { timestamp, uuid } from 'drizzle-orm/pg-core';

export const common = {
  id: uuid().primaryKey().defaultRandom(),
  createdAt: timestamp()
    .$default(() => new Date())
    .notNull(),
  updatedAt: timestamp()
    .$onUpdate(() => new Date())
    .notNull(),
};
