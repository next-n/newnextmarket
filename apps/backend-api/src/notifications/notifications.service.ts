import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async listCustomer(userId: string, query: NotificationQueryDto) {
    return this.list({ ...query, userId });
  }

  async markRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!notification) throw new NotFoundException('Notification not found');
    return this.toNotificationResponse(
      await this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } }),
    );
  }

  async list(query: NotificationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: any = {
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.type ? { type: query.type } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items: items.map((item) => this.toNotificationResponse(item)), meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
  }

  async create(dto: CreateNotificationDto, adminId?: string) {
    const data = {
      type: dto.type,
      title: dto.title,
      message: dto.message,
      data: dto.data as any,
      adminId,
    };
    let result: any;
    if (dto.allUsers) {
      const users = await this.prisma.user.findMany({ select: { id: true } });
      await this.prisma.notification.createMany({
        data: users.map((user) => ({ ...data, userId: user.id })),
      });
      result = { createdCount: users.length };
    } else {
      result = this.toNotificationResponse(
        await this.prisma.notification.create({ data: { ...data, userId: dto.userId } }),
      );
    }
    await this.auditLogs.log({
      adminId,
      action: AuditAction.CREATE,
      entityType: 'Notification',
      metadata: { allUsers: dto.allUsers, userId: dto.userId },
    });
    return result;
  }

  private toNotificationResponse(notification: any) {
    return {
      id: notification.id,
      userId: notification.userId,
      adminId: notification.adminId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
    };
  }
}
