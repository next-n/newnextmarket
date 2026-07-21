import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Coupon, CouponStatus, CouponType } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { CouponQueryDto } from './dto/coupon-query.dto';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';

@Injectable()
export class CouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async create(dto: CreateCouponDto, adminId?: string) {
    try {
      const coupon = await this.prisma.coupon.create({
        data: this.toCouponData(dto) as any,
      });
      await this.auditLogs.log({
        adminId,
        action: AuditAction.CREATE,
        entityType: 'Coupon',
        entityId: coupon.id,
        metadata: { code: coupon.code },
      });
      return this.toCouponResponse(coupon);
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException('Coupon code already exists');
      }
      throw error;
    }
  }

  async list(query: CouponQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: any = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.search
        ? { code: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.coupon.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { usages: true } } },
      }),
      this.prisma.coupon.count({ where }),
    ]);
    return {
      items: items.map((coupon) => this.toCouponResponse(coupon)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async get(id: string) {
    const coupon = await this.prisma.coupon.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { usages: true } } },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return this.toCouponResponse(coupon);
  }

  async update(id: string, dto: UpdateCouponDto, adminId?: string) {
    await this.get(id);
    try {
      const coupon = await this.prisma.coupon.update({
        where: { id },
        data: this.toCouponData(dto),
      });
      await this.auditLogs.log({
        adminId,
        action: AuditAction.UPDATE,
        entityType: 'Coupon',
        entityId: coupon.id,
        metadata: { code: coupon.code },
      });
      return this.toCouponResponse(coupon);
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException('Coupon code already exists');
      }
      throw error;
    }
  }

  async delete(id: string, adminId?: string) {
    await this.get(id);
    const coupon = await this.prisma.coupon.update({
      where: { id },
      data: { status: CouponStatus.INACTIVE, deletedAt: new Date() },
    });
    await this.auditLogs.log({
      adminId,
      action: AuditAction.DELETE,
      entityType: 'Coupon',
      entityId: coupon.id,
      metadata: { code: coupon.code },
    });
    return this.toCouponResponse(coupon);
  }

  async validate(dto: ValidateCouponDto) {
    const coupon = await this.prisma.coupon.findFirst({
      where: { code: dto.code.trim().toUpperCase(), deletedAt: null },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');
    await this.assertUsable(coupon, dto.subtotal, dto.userId);
    const discountAmount = this.calculateDiscount(coupon, dto.subtotal);
    return {
      valid: true,
      code: coupon.code,
      type: coupon.type,
      subtotal: this.money(dto.subtotal),
      discountAmount,
      totalAfterDiscount: this.money(Math.max(dto.subtotal - discountAmount, 0)),
    };
  }

  private async assertUsable(coupon: Coupon, subtotal: number, userId?: string) {
    const now = new Date();
    if (
      coupon.status !== CouponStatus.ACTIVE ||
      (coupon.startsAt && coupon.startsAt > now) ||
      (coupon.endsAt && coupon.endsAt < now) ||
      (coupon.minOrderAmount && subtotal < Number(coupon.minOrderAmount))
    ) {
      throw new BadRequestException('Coupon is not valid');
    }
    const [totalUsage, userUsage] = await Promise.all([
      this.prisma.couponUsage.count({ where: { couponId: coupon.id } }),
      userId
        ? this.prisma.couponUsage.count({ where: { couponId: coupon.id, userId } })
        : Promise.resolve(0),
    ]);
    if (coupon.usageLimit !== null && totalUsage >= coupon.usageLimit) {
      throw new BadRequestException('Coupon usage limit has been reached');
    }
    if (coupon.usageLimitPerUser !== null && userUsage >= coupon.usageLimitPerUser) {
      throw new BadRequestException('Coupon user usage limit has been reached');
    }
  }

  private calculateDiscount(coupon: Coupon, subtotal: number) {
    if (coupon.type === CouponType.FREE_SHIPPING) return 0;
    const raw =
      coupon.type === CouponType.PERCENTAGE
        ? subtotal * (Number(coupon.value) / 100)
        : Number(coupon.value);
    const capped =
      coupon.maxDiscountAmount === null
        ? raw
        : Math.min(raw, Number(coupon.maxDiscountAmount));
    return this.money(Math.min(capped, subtotal));
  }

  private toCouponData(dto: Partial<CreateCouponDto>) {
    return {
      ...(dto.code !== undefined ? { code: dto.code.trim().toUpperCase() } : {}),
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.value !== undefined ? { value: dto.value } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.minOrderAmount !== undefined ? { minOrderAmount: dto.minOrderAmount } : {}),
      ...(dto.maxDiscountAmount !== undefined
        ? { maxDiscountAmount: dto.maxDiscountAmount }
        : {}),
      ...(dto.usageLimit !== undefined ? { usageLimit: dto.usageLimit } : {}),
      ...(dto.usageLimitPerUser !== undefined
        ? { usageLimitPerUser: dto.usageLimitPerUser }
        : {}),
      ...(dto.startsAt !== undefined ? { startsAt: new Date(dto.startsAt) } : {}),
      ...(dto.endsAt !== undefined ? { endsAt: new Date(dto.endsAt) } : {}),
    };
  }

  private toCouponResponse(coupon: any) {
    return {
      id: coupon.id,
      code: coupon.code,
      type: coupon.type,
      status: coupon.status,
      value: Number(coupon.value),
      minOrderAmount:
        coupon.minOrderAmount === null ? null : Number(coupon.minOrderAmount),
      maxDiscountAmount:
        coupon.maxDiscountAmount === null ? null : Number(coupon.maxDiscountAmount),
      usageLimit: coupon.usageLimit,
      usageLimitPerUser: coupon.usageLimitPerUser,
      usageCount: coupon._count?.usages,
      startsAt: coupon.startsAt,
      endsAt: coupon.endsAt,
      createdAt: coupon.createdAt,
      updatedAt: coupon.updatedAt,
      deletedAt: coupon.deletedAt,
    };
  }

  private money(value: number) {
    return Number((Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2));
  }
}
