import { defineConfig } from 'drizzle-kit';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as process from 'node:process';
import { loadEnvFile } from 'node:process';

const developmentEnv = resolve(process.cwd(), '.env.development');

if (!process.env.POSTGRES_URL && existsSync(developmentEnv)) {
  loadEnvFile(developmentEnv);
}

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
