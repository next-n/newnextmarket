import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, ProductStatus, ReviewStatus } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewQueryDto } from './dto/review-query.dto';
import { UpdateReviewStatusDto } from './dto/update-review-status.dto';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async publicProductReviews(productId: string, query: ReviewQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = { productId, status: ReviewStatus.APPROVED, deletedAt: null };
    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
      }),
      this.prisma.review.count({ where }),
    ]);
    return { items: items.map((review) => this.toReviewResponse(review)), meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
  }

  async create(productId: string, userId: string, dto: CreateReviewDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, status: ProductStatus.ACTIVE, deletedAt: null },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    const purchased = await this.prisma.orderItem.findFirst({
      where: {
        productId,
        order: { userId, status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as any } },
      },
      select: { id: true },
    });
    try {
      const review = await this.prisma.review.create({
        data: {
          productId,
          userId,
          rating: dto.rating,
          title: dto.title,
          comment: dto.comment,
          status: ReviewStatus.PENDING,
          isVerifiedPurchase: Boolean(purchased),
        },
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
      });
      return this.toReviewResponse(review);
    } catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException('Product review already exists');
      throw error;
    }
  }

  async adminList(query: ReviewQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: any = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.rating ? { rating: query.rating } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.review.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, include: this.adminReviewInclude() }),
      this.prisma.review.count({ where }),
    ]);
    return { items: items.map((review) => this.toReviewResponse(review, true)), meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
  }

  async adminGet(id: string) {
    const review = await this.prisma.review.findFirst({ where: { id, deletedAt: null }, include: this.adminReviewInclude() });
    if (!review) throw new NotFoundException('Review not found');
    return this.toReviewResponse(review, true);
  }

  async updateStatus(id: string, dto: UpdateReviewStatusDto, adminId?: string) {
    await this.adminGet(id);
    const review = await this.prisma.review.update({ where: { id }, data: { status: dto.status }, include: this.adminReviewInclude() });
    await this.auditLogs.log({ adminId, action: AuditAction.UPDATE, entityType: 'Review', entityId: id, metadata: { status: dto.status } });
    return this.toReviewResponse(review, true);
  }

  async delete(id: string, adminId?: string) {
    await this.adminGet(id);
    const review = await this.prisma.review.update({ where: { id }, data: { deletedAt: new Date(), status: ReviewStatus.REJECTED } });
    await this.auditLogs.log({ adminId, action: AuditAction.DELETE, entityType: 'Review', entityId: id });
    return this.toReviewResponse(review);
  }

  private adminReviewInclude() {
    return {
      user: { select: { id: true, firstName: true, lastName: true } },
      product: { select: { id: true, name: true, slug: true } },
    };
  }

  private toReviewResponse(review: any, includeAdmin = false) {
    return {
      id: review.id,
      productId: review.productId,
      userId: review.userId,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      status: review.status,
      isVerifiedPurchase: review.isVerifiedPurchase,
      user: review.user
        ? { id: review.user.id, firstName: review.user.firstName, lastName: review.user.lastName }
        : null,
      product: includeAdmin && review.product ? { id: review.product.id, name: review.product.name, slug: review.product.slug } : undefined,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    };
  }
}
