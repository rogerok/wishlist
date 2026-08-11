import { Config } from 'effect';

export const AppConfig = Config.all({
  appName: Config.string('APP_NAME'),
  appPort: Config.port('APP_PORT'),
  mode: Config.literal('development', 'test', 'production')('MODE'),
  corsAllowedOrigins: Config.array(Config.url(), 'CORS_ALLOWED_ORIGINS').pipe(
    Config.map((urls) => urls.map((url) => url.origin)),
  ),
  corsCredentials: Config.boolean('CORS_CREDENTIALS').pipe(
    Config.withDefault(false),
  ),
});

export const PgConfig = Config.all({
  postgresUrl: Config.redacted('POSTGRES_URL'),
  maxConnections: Config.integer('POSTGRES_MAX_CONNECTIONS').pipe(
    Config.withDefault(10),
  ),
  idleTimeout: Config.duration('POSTGRES_IDLE_TIMEOUT').pipe(
    Config.withDefault('20 seconds'),
  ),
  connectTimeout: Config.duration('POSTGRES_CONNECT_TIMEOUT').pipe(
    Config.withDefault('10 seconds'),
  ),
});
