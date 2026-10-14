import { Config, Schema } from 'effect';

export const ModeConfig = Config.Literals(
  ['development', 'test', 'production'],
  'MODE',
);
export type Mode = Config.Success<typeof ModeConfig>;

// Печатать текст и stack дефектов для отладки; при MODE=production игнорируется.
export const DefectDetailsConfig = Config.Boolean('LOG_DEFECT_DETAILS').pipe(
  Config.withDefault(false),
);

export const AppConfig = Config.all({
  appName: Config.String('APP_NAME'),
  appPort: Config.Port('APP_PORT'),
  mode: ModeConfig,
  corsAllowedOrigins: Config.Array(Schema.URL, 'CORS_ALLOWED_ORIGINS').pipe(
    Config.map((urls) => urls.map((url) => url.origin)),
  ),
  corsCredentials: Config.Boolean('CORS_CREDENTIALS').pipe(
    Config.withDefault(false),
  ),
});

export const PgConfig = Config.all({
  postgresUrl: Config.Redacted('POSTGRES_URL'),
  maxConnections: Config.Int('POSTGRES_MAX_CONNECTIONS').pipe(
    Config.withDefault(10),
  ),
  idleTimeout: Config.Duration('POSTGRES_IDLE_TIMEOUT').pipe(
    Config.withDefault('20 seconds'),
  ),
  connectTimeout: Config.Duration('POSTGRES_CONNECT_TIMEOUT').pipe(
    Config.withDefault('10 seconds'),
  ),
});
