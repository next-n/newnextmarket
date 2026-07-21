import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client?: Redis;
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private stats = { hits: 0, misses: 0, errors: 0 };

  constructor(private readonly configService: ConfigService) {}

  async get<T>(key: string): Promise<T | null> {
    const value = await this.execute((client) => client.get(key));

    if (value === null || value === undefined) {
      this.stats.misses += 1;
      return null;
    }

    try {
      this.stats.hits += 1;
      return JSON.parse(value) as T;
    } catch {
      this.stats.hits += 1;
      return value as T;
    }
  }

  async remember<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const existing = this.inFlight.get(key) as Promise<T> | undefined;
    if (existing) return existing;

    const pending = loader().then(async (value) => {
      await this.set(key, value, ttlSeconds);
      return value;
    });
    this.inFlight.set(key, pending);

    try {
      return await pending;
    } finally {
      this.inFlight.delete(key);
    }
  }

  getStats() {
    return { ...this.stats };
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.execute((client) =>
      client.set(key, JSON.stringify(value), 'EX', ttlSeconds),
    );
  }

  async getVersion(namespace: string): Promise<number> {
    const key = `cache:version:${namespace}`;
    const existing = await this.execute((client) => client.get(key));

    if (existing) {
      return Number(existing) || 1;
    }

    await this.execute((client) => client.set(key, '1', 'NX'));
    return 1;
  }

  async invalidate(namespace: string): Promise<void> {
    await this.execute((client) => client.incr(`cache:version:${namespace}`));
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client && !['end', 'close'].includes(this.client.status)) {
      try {
        await this.client.quit();
      } catch {
        // Redis may already be unavailable while the application is shutting down.
      }
    }
  }

  private async execute<T>(operation: (client: Redis) => Promise<T>): Promise<T | null> {
    const url = this.configService.get<string>('redis.url');

    if (!url) {
      return null;
    }

    try {
      if (!this.client) {
        this.client = new Redis(url, {
          lazyConnect: true,
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
          connectTimeout: 1000,
          retryStrategy: () => null,
        });
        this.client.on('error', () => undefined);
      }
      if (this.client.status === 'wait') {
        await this.client.connect();
      }
      return await operation(this.client);
    } catch {
      this.stats.errors += 1;
      return null;
    }
  }
}
