import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

const PUBLIC_KEYS = [
  'store_name',
  'currency',
  'default_shipping_fee',
  'free_shipping_threshold',
  'tax_rate',
];
const NUMERIC_KEYS = ['default_shipping_fee', 'free_shipping_threshold', 'tax_rate', 'low_stock_threshold'];

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  async publicSettings() {
    const version = (await this.redis?.getVersion('settings')) ?? 1;
    const cacheKey = `settings:public:${version}`;
    const cached = await this.redis?.get<Record<string, unknown>>(cacheKey);

    if (cached) {
      return cached;
    }

    const settings = await this.prisma.setting.findMany({
      where: { key: { in: PUBLIC_KEYS } },
      orderBy: { key: 'asc' },
    });
    const response = this.toObject(settings);
    await this.redis?.set(cacheKey, response, 1800);
    return response;
  }

  async adminSettings() {
    const settings = await this.prisma.setting.findMany({ orderBy: { key: 'asc' } });
    return settings.map((setting) => ({
      id: setting.id,
      key: setting.key,
      value: setting.value,
      dataType: setting.dataType,
      group: setting.group,
      description: setting.description,
      createdAt: setting.createdAt,
      updatedAt: setting.updatedAt,
    }));
  }

  async update(dto: UpdateSettingsDto, adminId?: string) {
    for (const [key, value] of Object.entries(dto.settings)) {
      if (NUMERIC_KEYS.includes(key) && (typeof value !== 'number' || Number.isNaN(value))) {
        throw new BadRequestException(`${key} must be numeric`);
      }
      await this.prisma.setting.upsert({
        where: { key },
        create: {
          key,
          value: value as any,
          dataType: typeof value,
          group: 'store',
        },
        update: {
          value: value as any,
          dataType: typeof value,
        },
      });
    }
    await this.auditLogs.log({
      adminId,
      action: AuditAction.UPDATE,
      entityType: 'Setting',
      metadata: { keys: Object.keys(dto.settings) },
    });
    await this.redis?.invalidate('settings');
    return this.adminSettings();
  }

  private toObject(settings: any[]) {
    return settings.reduce<Record<string, unknown>>((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});
  }
}
