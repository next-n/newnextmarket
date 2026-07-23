import { validateProductionEnvironment } from './production-validation';

describe('validateProductionEnvironment', () => {
  it('allows development without production secrets', () => {
    expect(() => validateProductionEnvironment({ NODE_ENV: 'development' })).not.toThrow();
  });

  it('rejects missing production configuration', () => {
    expect(() => validateProductionEnvironment({ NODE_ENV: 'production' })).toThrow(
      'DATABASE_URL, JWT_SECRET, CORS_ORIGIN',
    );
  });

  it('rejects weak secrets and wildcard CORS in production', () => {
    const env = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://example',
      JWT_SECRET: 'too-short',
      CORS_ORIGIN: '*',
    };

    expect(() => validateProductionEnvironment(env)).toThrow(
      'JWT_SECRET must be at least 32 characters',
    );
  });

  it('accepts explicit production configuration', () => {
    expect(() =>
      validateProductionEnvironment({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://example',
        JWT_SECRET: 'a'.repeat(32),
        CORS_ORIGIN: 'https://www.newnextmarket.asia,https://admin.newnextmarket.asia',
      }),
    ).not.toThrow();
  });
});
