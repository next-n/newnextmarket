import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AuditAction,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
} from '@prisma/client';
import { CheckoutService } from '../checkout/checkout.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly checkoutService: CheckoutService,
  ) {}

  async getCustomerPayment(userId: string, id: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, order: { userId } },
      include: this.paymentInclude(),
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return this.toPaymentResponse(payment);
  }

  async createCustomerPayment(userId: string, dto: CreatePaymentDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: dto.orderId, userId },
      include: { payments: { orderBy: { createdAt: 'desc' } } },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const reusableStatuses: PaymentStatus[] = [
        PaymentStatus.PENDING,
        PaymentStatus.AUTHORIZED,
        PaymentStatus.PAID,
      ];
    const existingPayment = order.payments.find((payment) =>
      reusableStatuses.includes(payment.status),
    );

    if (existingPayment) {
      return this.getCustomerPayment(userId, existingPayment.id);
    }

    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        method: dto.method ?? PaymentMethod.MOCK,
        status: PaymentStatus.PENDING,
        amount: order.totalAmount,
        currency: order.currency,
        provider: 'mock',
      },
      include: this.paymentInclude(),
    });

    return this.toPaymentResponse(payment);
  }

  async confirmCustomerPayment(userId: string, dto: ConfirmPaymentDto) {
    const orderId = await this.resolveCustomerOrderId(userId, dto);

    return this.checkoutService.confirmPayment(userId, {
      orderId,
      success: dto.success,
      transactionId: dto.transactionId,
    });
  }

  async listAdminPayments(query: PaymentQueryDto) {
    const { skip, take, page, limit } = this.getPagination(query);
    const where: any = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.method ? { method: query.method } : {}),
      ...(query.orderId ? { orderId: query.orderId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: this.paymentInclude(),
      }),
      this.prisma.payment.count({ where }),
    ]);

    return this.paginate(
      items.map((payment) => this.toPaymentResponse(payment)),
      total,
      page,
      limit,
    );
  }

  async getAdminPayment(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: this.paymentInclude(),
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return this.toPaymentResponse(payment);
  }

  async collectCashOnDelivery(id: string, adminId?: string) {
    return this.prisma.$transaction(async (transaction) => {
      const tx: any = transaction;
      const payment = await tx.payment.findUnique({
        where: { id },
        include: { order: true },
      });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      if (payment.order.status === OrderStatus.CANCELLED) {
        throw new BadRequestException('Cancelled orders cannot be collected');
      }

      if (payment.method !== PaymentMethod.CASH_ON_DELIVERY) {
        throw new BadRequestException('Only cash-on-delivery payments can be collected');
      }

      if (payment.status === PaymentStatus.PAID) {
        return {
          alreadyCollected: true,
          payment: this.toPaymentResponse(payment),
        };
      }

      if (payment.status !== PaymentStatus.PENDING) {
        throw new BadRequestException('Only pending payments can be collected');
      }

      // The order can be cancelled concurrently after the read above. Make
      // collection a conditional state transition so a stale read can never
      // turn a cancelled order's payment into PAID.
      const collection = await tx.payment.updateMany({
        where: {
          id: payment.id,
          method: PaymentMethod.CASH_ON_DELIVERY,
          status: PaymentStatus.PENDING,
          order: { status: { not: OrderStatus.CANCELLED } },
        },
        data: {
          status: PaymentStatus.PAID,
          paidAt: new Date(),
          transactionId: payment.transactionId ?? `cod_${payment.id}`,
        },
      });

      if (collection.count !== 1) {
        const currentPayment = await tx.payment.findUnique({
          where: { id: payment.id },
          include: { order: true },
        });

        if (currentPayment?.order.status === OrderStatus.CANCELLED) {
          throw new BadRequestException('Cancelled orders cannot be collected');
        }
        if (currentPayment?.status === PaymentStatus.PAID) {
          return {
            alreadyCollected: true,
            payment: this.toPaymentResponse(currentPayment),
          };
        }

        throw new BadRequestException('Only pending payments can be collected');
      }

      const updatedPayment = await tx.payment.findUnique({
        where: { id: payment.id },
        include: this.paymentInclude(),
      });
      if (!updatedPayment) {
        throw new NotFoundException('Payment not found');
      }

      await this.audit(tx, adminId, AuditAction.UPDATE, 'Payment', payment.id, {
        method: PaymentMethod.CASH_ON_DELIVERY,
        previousStatus: payment.status,
        status: PaymentStatus.PAID,
      });

      return {
        alreadyCollected: false,
        payment: this.toPaymentResponse(updatedPayment),
      };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  async refundPayment(id: string, dto: RefundPaymentDto, adminId?: string) {
    return this.prisma.$transaction(async (transaction) => {
      const tx: any = transaction;
      const payment = await tx.payment.findUnique({
        where: { id },
        include: {
          order: true,
          refunds: true,
        },
      });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      if (
        ![PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED].includes(
          payment.status,
        )
      ) {
        throw new BadRequestException('Only paid payments can be refunded');
      }

      const paidAmount = Number(payment.amount);
      const alreadyRefunded = payment.refunds
        .filter(
          (refund: any) =>
            ![RefundStatus.FAILED, RefundStatus.CANCELLED].includes(
              refund.status,
            ),
        )
        .reduce((total: number, refund: any) => total + Number(refund.amount), 0);
      const remaining = this.money(paidAmount - alreadyRefunded);
      const refundAmount = this.money(dto.amount ?? remaining);

      if (refundAmount <= 0 || refundAmount > remaining) {
        throw new BadRequestException('Refund amount exceeds refundable amount');
      }

      const refund = await tx.refund.create({
        data: {
          paymentId: payment.id,
          status: RefundStatus.COMPLETED,
          amount: refundAmount,
          currency: payment.currency,
          reason: dto.reason,
          providerRefundId: this.generateMockRefundId(),
          processedAt: new Date(),
        },
      });
      const isFullRefund = this.money(alreadyRefunded + refundAmount) >= paidAmount;

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: isFullRefund
            ? PaymentStatus.REFUNDED
            : PaymentStatus.PARTIALLY_REFUNDED,
        },
      });

      if (isFullRefund) {
        await tx.order.update({
          where: { id: payment.orderId },
          data: { status: OrderStatus.REFUNDED },
        });
      }

      await this.audit(tx, adminId, AuditAction.UPDATE, 'Payment', payment.id, {
        refundId: refund.id,
        amount: refundAmount,
        fullRefund: isFullRefund,
      });

      const updatedPayment = await tx.payment.findUnique({
        where: { id: payment.id },
        include: this.paymentInclude(),
      });

      return {
        payment: this.toPaymentResponse(updatedPayment),
        refund: this.toRefundResponse(refund),
      };
    });
  }

  private async resolveCustomerOrderId(userId: string, dto: ConfirmPaymentDto) {
    if (dto.orderId) {
      const order = await this.prisma.order.findFirst({
        where: { id: dto.orderId, userId },
        select: { id: true },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      return order.id;
    }

    if (dto.paymentId) {
      const payment = await this.prisma.payment.findFirst({
        where: { id: dto.paymentId, order: { userId } },
        select: { orderId: true },
      });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      return payment.orderId;
    }

    throw new BadRequestException('orderId or paymentId is required');
  }

  private paymentInclude(): any {
    return {
      order: {
        select: {
          id: true,
          orderNumber: true,
          userId: true,
          status: true,
          totalAmount: true,
          currency: true,
        },
      },
      refunds: {
        orderBy: { createdAt: 'desc' },
      },
    };
  }

  private toPaymentResponse(payment: any) {
    return {
      id: payment.id,
      orderId: payment.orderId,
      method: payment.method,
      status: payment.status,
      amount: this.money(Number(payment.amount)),
      currency: payment.currency,
      provider: payment.provider,
      transactionId: payment.transactionId,
      paidAt: payment.paidAt,
      order: payment.order
        ? {
            id: payment.order.id,
            orderNumber: payment.order.orderNumber,
            status: payment.order.status,
            totalAmount: this.money(Number(payment.order.totalAmount)),
            currency: payment.order.currency,
          }
        : null,
      refunds: (payment.refunds ?? []).map((refund: any) =>
        this.toRefundResponse(refund),
      ),
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }

  private toRefundResponse(refund: any) {
    return {
      id: refund.id,
      paymentId: refund.paymentId,
      returnRequestId: refund.returnRequestId,
      status: refund.status,
      amount: this.money(Number(refund.amount)),
      currency: refund.currency,
      reason: refund.reason,
      providerRefundId: refund.providerRefundId,
      processedAt: refund.processedAt,
      createdAt: refund.createdAt,
      updatedAt: refund.updatedAt,
    };
  }

  private getPagination(query: PaymentQueryDto) {
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
    return `mock_refund_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private money(value: number) {
    return Number((Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2));
  }
}
