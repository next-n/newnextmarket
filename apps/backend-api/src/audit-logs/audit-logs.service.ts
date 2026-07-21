import { Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    adminId?: string;
    userId?: string;
    action: AuditAction;
    entityType: string;
    entityId?: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.auditLog.create({
      data: {
        adminId: params.adminId,
        userId: params.userId,
        action: params.action,
        entity: params.entityType,
        entityId: params.entityId,
        description: params.description,
        metadata: params.metadata as any,
      },
    });
  }

  async list(query: AuditLogQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const createdAt: any = {
      ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
      ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
    };
    const where: any = {
      ...(query.adminId ? { adminId: query.adminId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.entityType ? { entity: query.entityType } : {}),
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          admin: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        adminId: item.adminId,
        userId: item.userId,
        action: item.action,
        entityType: item.entity,
        entityId: item.entityId,
        description: item.description,
        metadata: item.metadata,
        admin: item.admin
          ? {
              id: item.admin.id,
              email: item.admin.email,
              firstName: item.admin.firstName,
              lastName: item.admin.lastName,
            }
          : null,
        createdAt: item.createdAt,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}
