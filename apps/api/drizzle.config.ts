import { defineConfig } from 'drizzle-kit';
import * as process from 'node:process';
import { loadEnvFile } from 'node:process';

loadEnvFile('.env.development');
const dbUrl = process.env.POSTGRES_URL;
if (!dbUrl) {
  throw new Error('Missing POSTGRES_URL');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/**/*.ts',
  out: './drizzle',
  dbCredentials: {
    url: dbUrl,
  },
});
