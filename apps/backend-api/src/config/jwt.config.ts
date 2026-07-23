import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  // Production startup validation rejects an empty secret. Tests use a
  // non-production-only value when no environment file is loaded.
  secret: process.env.JWT_SECRET ?? (process.env.NODE_ENV === 'test' ? 'test-secret' : ''),
  expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
}));
