import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  OrderStatus,
  PaymentStatus,
  RefundStatus,
  ReturnStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { ReturnQueryDto } from './dto/return-query.dto';
import { UpdateReturnStatusDto } from './dto/update-return-status.dto';

const ACTIVE_RETURN_STATUSES = [
  ReturnStatus.REQUESTED,
  ReturnStatus.APPROVED,
  ReturnStatus.RECEIVED,
  ReturnStatus.REFUNDED,
];

@Injectable()
export class ReturnsService {
  constructor(private readonly prisma: PrismaService) {}

  async createCustomerReturn(userId: string, dto: CreateReturnDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: dto.orderId, userId },
      include: {
        items: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('Only delivered orders can be returned');
    }

    await this.validateReturnItems(order, dto.items);

    const returnRequest = await this.prisma.returnRequest.create({
      data: {
        orderId: order.id,
        userId,
        status: ReturnStatus.REQUESTED,
        reason: dto.reason,
        notes: dto.notes,
        items: {
          create: dto.items.map((item) => {
            const orderItem = order.items.find(
              (candidate) => candidate.id === item.orderItemId,
            );

            return {
              orderItemId: item.orderItemId,
              productVariantId: orderItem?.productVariantId,
              quantity: item.quantity,
              reason: item.reason,
            };
          }),
        },
      },
      include: this.returnInclude(),
    });

    return this.toReturnResponse(returnRequest);
  }

  async listCustomerReturns(userId: string, query: ReturnQueryDto) {
    const { skip, take, page, limit } = this.getPagination(query);
    const where: any = {
      userId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.orderId ? { orderId: query.orderId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.returnRequest.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: this.returnInclude(),
      }),
      this.prisma.returnRequest.count({ where }),
    ]);

    return this.paginate(
      items.map((returnRequest) => this.toReturnResponse(returnRequest)),
      total,
      page,
      limit,
    );
  }

  async getCustomerReturn(userId: string, id: string) {
    const returnRequest = await this.prisma.returnRequest.findFirst({
      where: { id, userId },
      include: this.returnInclude(),
    });

    if (!returnRequest) {
      throw new NotFoundException('Return request not found');
    }

    return this.toReturnResponse(returnRequest);
  }

  async listAdminReturns(query: ReturnQueryDto) {
    const { skip, take, page, limit } = this.getPagination(query);
    const createdAt: any = {
      ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
      ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
    };
    const where: any = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.orderId ? { orderId: query.orderId } : {}),
      ...(query.customerId ? { userId: query.customerId } : {}),
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.returnRequest.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: this.returnInclude(true),
      }),
      this.prisma.returnRequest.count({ where }),
    ]);

    return this.paginate(
      items.map((returnRequest) => this.toReturnResponse(returnRequest, true)),
      total,
      page,
      limit,
    );
  }

  async getAdminReturn(id: string) {
    const returnRequest = await this.prisma.returnRequest.findUnique({
      where: { id },
      include: this.returnInclude(true),
    });

    if (!returnRequest) {
      throw new NotFoundException('Return request not found');
    }

    return this.toReturnResponse(returnRequest, true);
  }

  async updateReturnStatus(
    id: string,
    dto: UpdateReturnStatusDto,
    adminId?: string,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const tx: any = transaction;
      const returnRequest = await tx.returnRequest.findUnique({
        where: { id },
        include: this.returnInclude(true),
      });

      if (!returnRequest) {
        throw new NotFoundException('Return request not found');
      }

      if (
        returnRequest.status === ReturnStatus.REFUNDED &&
        dto.status === ReturnStatus.REFUNDED
      ) {
        return this.toReturnResponse(returnRequest, true);
      }

      const updated = await tx.returnRequest.update({
        where: { id },
        data: { status: dto.status },
        include: this.returnInclude(true),
      });

      if (dto.status === ReturnStatus.REFUNDED) {
        await this.createReturnRefundIfNeeded(tx, updated);
      }

      await this.audit(tx, adminId, AuditAction.UPDATE, 'ReturnRequest', id, {
        from: returnRequest.status,
        to: dto.status,
      });

      const refreshed = await tx.returnRequest.findUnique({
        where: { id },
        include: this.returnInclude(true),
      });

      return this.toReturnResponse(refreshed, true);
    });
  }

  private async validateReturnItems(order: any, items: any[]) {
    for (const item of items) {
      const orderItem = order.items.find(
        (candidate: any) => candidate.id === item.orderItemId,
      );

      if (!orderItem) {
        throw new BadRequestException('Return item does not belong to order');
      }

      const existingReturned = await this.prisma.returnItem.aggregate({
        where: {
          orderItemId: item.orderItemId,
          returnRequest: {
            status: { in: ACTIVE_RETURN_STATUSES },
          },
        },
        _sum: { quantity: true },
      });
      const returnedQuantity = existingReturned._sum.quantity ?? 0;

      if (item.quantity > orderItem.quantity - returnedQuantity) {
        throw new BadRequestException(
          'Return quantity exceeds remaining purchased quantity',
        );
      }
    }
  }

  private async createReturnRefundIfNeeded(tx: any, returnRequest: any) {
    if (returnRequest.refund) {
      throw new BadRequestException('Return request has already been refunded');
    }

    const payment = returnRequest.order.payments.find(
      (candidate: any) => candidate.status === PaymentStatus.PAID,
    );

    if (!payment) {
      throw new BadRequestException('Order has no paid payment to refund');
    }

    const refundAmount = this.money(
      returnRequest.items.reduce((total: number, returnItem: any) => {
        return total + Number(returnItem.orderItem.unitPrice) * returnItem.quantity;
      }, 0),
    );
    const previousRefunds = await tx.refund.findMany({
      where: {
        paymentId: payment.id,
        status: { notIn: [RefundStatus.FAILED, RefundStatus.CANCELLED] },
      },
    });
    const previousRefundAmount = previousRefunds.reduce(
      (total: number, refund: any) => total + Number(refund.amount),
      0,
    );

    if (refundAmount > Number(payment.amount) - previousRefundAmount) {
      throw new BadRequestException('Refund amount exceeds refundable amount');
    }

    await tx.refund.create({
      data: {
        paymentId: payment.id,
        returnRequestId: returnRequest.id,
        status: RefundStatus.COMPLETED,
        amount: refundAmount,
        currency: payment.currency,
        reason: `Return request ${returnRequest.id}`,
        providerRefundId: this.generateMockRefundId(),
        processedAt: new Date(),
      },
    });

    const isFullRefund =
      this.money(previousRefundAmount + refundAmount) >= Number(payment.amount);

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: isFullRefund
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PARTIALLY_REFUNDED,
      },
    });

    await tx.order.update({
      where: { id: returnRequest.orderId },
      data: { status: isFullRefund ? OrderStatus.REFUNDED : OrderStatus.RETURNED },
    });
  }

  private returnInclude(includeCustomer = false): any {
    return {
      user: includeCustomer
        ? {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          }
        : false,
      order: {
        include: {
          payments: {
            include: { refunds: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      },
      items: {
        orderBy: { createdAt: 'asc' },
        include: {
          orderItem: true,
        },
      },
      refund: true,
    };
  }

  private toReturnResponse(returnRequest: any, includeCustomer = false) {
    return {
      id: returnRequest.id,
      orderId: returnRequest.orderId,
      userId: returnRequest.userId,
      status: returnRequest.status,
      reason: returnRequest.reason,
      notes: returnRequest.notes,
      customer:
        includeCustomer && returnRequest.user
          ? {
              id: returnRequest.user.id,
              email: returnRequest.user.email,
              firstName: returnRequest.user.firstName,
              lastName: returnRequest.user.lastName,
              phone: returnRequest.user.phone,
            }
          : undefined,
      order: returnRequest.order
        ? {
            id: returnRequest.order.id,
            orderNumber: returnRequest.order.orderNumber,
            status: returnRequest.order.status,
          }
        : null,
      items: (returnRequest.items ?? []).map((item: any) => ({
        id: item.id,
        orderItemId: item.orderItemId,
        productVariantId: item.productVariantId,
        productName: item.orderItem?.productName,
        sku: item.orderItem?.sku,
        quantity: item.quantity,
        reason: item.reason,
      })),
      refund: returnRequest.refund
        ? {
            id: returnRequest.refund.id,
            status: returnRequest.refund.status,
            amount: this.money(Number(returnRequest.refund.amount)),
            currency: returnRequest.refund.currency,
            processedAt: returnRequest.refund.processedAt,
          }
        : null,
      requestedAt: returnRequest.requestedAt,
      createdAt: returnRequest.createdAt,
      updatedAt: returnRequest.updatedAt,
    };
  }

  private getPagination(query: ReturnQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    return {
      page,
      limit,
      skip: (page - 1) * limit,
      take: limit,
    };
  }

  private paginate<T>(items: T[], total: number, page: number, limit: number) {
    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  private async audit(
    tx: any,
    adminId: string | undefined,
    action: AuditAction,
    entity: string,
    entityId: string,
    metadata: Record<string, unknown>,
  ) {
    if (!adminId) {
      return;
    }

    await tx.auditLog.create({
      data: {
        adminId,
        action,
        entity,
        entityId,
        metadata,
      },
    });
  }

  private generateMockRefundId() {
    return `mock_return_refund_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  }

  private money(value: number) {
    return Number((Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2));
  }
}
