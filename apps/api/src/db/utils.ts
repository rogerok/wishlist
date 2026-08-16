import { sql, SQL } from 'drizzle-orm';
import { AnyPgColumn } from 'drizzle-orm/pg-core/index';

export const lower = (email: AnyPgColumn): SQL => {
  return sql`lower(${email})`;
};
