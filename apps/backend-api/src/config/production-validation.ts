const REQUIRED_PRODUCTION_ENV = ['DATABASE_URL', 'JWT_SECRET', 'CORS_ORIGIN'];

export function validateProductionEnvironment(env: NodeJS.ProcessEnv = process.env): void {
  if ((env.NODE_ENV ?? 'development') !== 'production') {
    return;
  }

  const missing = REQUIRED_PRODUCTION_ENV.filter((key) => !env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }

  if ((env.JWT_SECRET?.length ?? 0) < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }

  if (env.CORS_ORIGIN === '*') {
    throw new Error('CORS_ORIGIN must list explicit frontend origins in production');
  }
}
