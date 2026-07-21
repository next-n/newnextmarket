import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  OrderStatus,
  PaymentStatus,
} from '@prisma/client';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { RefundOrderDto } from './dto/refund-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [
    OrderStatus.PROCESSING,
    OrderStatus.CANCELLED,
    OrderStatus.REFUNDED,
  ],
  [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [OrderStatus.RETURNED, OrderStatus.REFUNDED],
  [OrderStatus.RETURNED]: [OrderStatus.REFUNDED],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REFUNDED]: [],
};

const CANCELLABLE_STATUSES = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
];

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
  ) {}

  async listCustomerOrders(userId: string, query: OrderQueryDto) {
    const { skip, take, page, limit } = this.getPagination(query);
    const where: any = {
      userId,
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: this.orderInclude(false),
      }),
      this.prisma.order.count({ where }),
    ]);

    return this.paginate(
      items.map((order) => this.toOrderResponse(order)),
      total,
      page,
      limit,
    );
  }

  async getCustomerOrder(userId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, userId },
      include: this.orderInclude(false),
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.toOrderResponse(order);
  }

  async cancelCustomerOrder(userId: string, id: string, dto: CancelOrderDto) {
    const order = await this.prisma.order.findFirst({
      where: { id, userId },
      include: this.orderInclude(false),
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.cancelOrder(order, dto.reason);
  }

  async listAdminOrders(query: OrderQueryDto) {
    const { skip, take, page, limit } = this.getPagination(query);
    const createdAt: any = {
      ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
      ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
    };
    const where: any = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.customerId ? { userId: query.customerId } : {}),
      ...(query.paymentStatus
        ? { payments: { some: { status: query.paymentStatus } } }
        : {}),
      ...(query.shipmentStatus
        ? { shipments: { some: { status: query.shipmentStatus } } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { orderNumber: { contains: query.search, mode: 'insensitive' } },
              { user: { email: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take,
        orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc' },
        include: this.orderInclude(true),
      }),
      this.prisma.order.count({ where }),
    ]);

    return this.paginate(
      items.map((order) => this.toOrderResponse(order, true)),
      total,
      page,
      limit,
    );
  }

  async getAdminOrder(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: this.orderInclude(true),
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.toOrderResponse(order, true);
  }

  async updateOrderStatus(
    id: string,
    dto: UpdateOrderStatusDto,
    adminId?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: this.orderInclude(true),
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    this.assertValidTransition(order.status, dto.status);

    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: { status: dto.status },
      include: this.orderInclude(true),
    });

    await this.audit(adminId, AuditAction.UPDATE, 'Order', id, {
      from: order.status,
      to: dto.status,
    });

    return this.toOrderResponse(updatedOrder, true);
  }

  async cancelAdminOrder(id: string, dto: CancelOrderDto, adminId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: this.orderInclude(true),
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const response = await this.cancelOrder(order, dto.reason, true);

    await this.audit(adminId, AuditAction.UPDATE, 'Order', id, {
      action: 'cancel',
      reason: dto.reason,
    });

    return response;
  }

  async refundAdminOrder(id: string, dto: RefundOrderDto, adminId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        payments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const refundablePaymentStatuses: PaymentStatus[] = [
      PaymentStatus.PAID,
      PaymentStatus.PARTIALLY_REFUNDED,
    ];
    const payment = order.payments.find(
      (orderPayment) =>
        refundablePaymentStatuses.includes(orderPayment.status),
    );

    if (!payment) {
      throw new BadRequestException('Order has no paid payment to refund');
    }

    return this.paymentsService.refundPayment(payment.id, dto, adminId);
  }

  private async cancelOrder(order: any, reason?: string, includeAdmin = false) {
    if (!CANCELLABLE_STATUSES.includes(order.status)) {
      throw new BadRequestException('Order cannot be cancelled');
    }

    const hasPaidPayment = (order.payments ?? []).some(
      (payment: any) => payment.status === PaymentStatus.PAID,
    );
    const updatedOrder = await this.prisma.$transaction(async (tx: any) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
          notes: reason
            ? [order.notes, `Cancellation reason: ${reason}`]
                .filter(Boolean)
                .join('\n')
            : order.notes,
        },
        include: this.orderInclude(includeAdmin),
      });

      await tx.payment.updateMany({
        where: {
          orderId: order.id,
          status: PaymentStatus.PENDING,
        },
        data: { status: PaymentStatus.CANCELLED },
      });

      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: this.orderInclude(includeAdmin),
      });
    });

    return {
      order: this.toOrderResponse(updatedOrder, includeAdmin),
      refundRequired: hasPaidPayment,
    };
  }

  private assertValidTransition(from: OrderStatus, to: OrderStatus) {
    if (from === to) {
      return;
    }

    if (!ORDER_TRANSITIONS[from].includes(to)) {
      throw new BadRequestException(
        `Invalid order status transition from ${from} to ${to}`,
      );
    }
  }

  private orderInclude(includeCustomer: boolean): any {
    return {
      user: includeCustomer
        ? {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              status: true,
            },
          }
        : false,
      items: {
        orderBy: { createdAt: 'asc' },
      },
      payments: {
        orderBy: { createdAt: 'desc' },
        include: {
          refunds: {
            orderBy: { createdAt: 'desc' },
          },
        },
      },
      shipments: {
        orderBy: { createdAt: 'desc' },
      },
      returns: {
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
          refund: true,
        },
      },
    };
  }

  private toOrderResponse(order: any, includeCustomer = false) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      status: order.status,
      subtotal: this.money(Number(order.subtotal)),
      discountAmount: this.money(Number(order.discountAmount)),
      shippingFee: this.money(Number(order.shippingFee)),
      taxAmount: this.money(Number(order.taxAmount)),
      totalAmount: this.money(Number(order.totalAmount)),
      currency: order.currency,
      notes: order.notes,
      shippingAddress: order.shippingAddressSnapshot,
      billingAddress: order.billingAddressSnapshot,
      customer:
        includeCustomer && order.user
          ? {
              id: order.user.id,
              email: order.user.email,
              firstName: order.user.firstName,
              lastName: order.user.lastName,
              phone: order.user.phone,
              status: order.user.status,
            }
          : undefined,
      items: (order.items ?? []).map((item: any) => ({
        id: item.id,
        productId: item.productId,
        productVariantId: item.productVariantId,
        productName: item.productName,
        productSlug: item.productSnapshot?.productSlug ?? null,
        sku: item.sku,
        size: item.size,
        width: item.width,
        color: item.color,
        quantity: item.quantity,
        unitPrice: this.money(Number(item.unitPrice)),
        lineTotal: this.money(Number(item.subtotal)),
      })),
      payment: order.payments?.[0] ? this.toPaymentSummary(order.payments[0]) : null,
      payments: (order.payments ?? []).map((payment: any) =>
        this.toPaymentSummary(payment),
      ),
      shipment: order.shipments?.[0]
        ? this.toShipmentSummary(order.shipments[0])
        : null,
      shipments: (order.shipments ?? []).map((shipment: any) =>
        this.toShipmentSummary(shipment),
      ),
      returns: (order.returns ?? []).map((returnRequest: any) => ({
        id: returnRequest.id,
        status: returnRequest.status,
        reason: returnRequest.reason,
        notes: returnRequest.notes,
        itemCount: returnRequest.items?.length ?? 0,
        refund: returnRequest.refund
          ? {
              id: returnRequest.refund.id,
              status: returnRequest.refund.status,
              amount: this.money(Number(returnRequest.refund.amount)),
            }
          : null,
        createdAt: returnRequest.createdAt,
      })),
      cancelledAt: order.cancelledAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  private toPaymentSummary(payment: any) {
    return {
      id: payment.id,
      method: payment.method,
      status: payment.status,
      amount: this.money(Number(payment.amount)),
      currency: payment.currency,
      paidAt: payment.paidAt,
      refunds: (payment.refunds ?? []).map((refund: any) => ({
        id: refund.id,
        status: refund.status,
        amount: this.money(Number(refund.amount)),
      })),
    };
  }

  private toShipmentSummary(shipment: any) {
    return {
      id: shipment.id,
      status: shipment.status,
      carrier: shipment.carrier,
      trackingNumber: shipment.trackingNumber,
      shippingMethod: shipment.shippingMethod,
      shippedAt: shipment.shippedAt,
      deliveredAt: shipment.deliveredAt,
    };
  }

  private getPagination(query: OrderQueryDto) {
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
    adminId: string | undefined,
    action: AuditAction,
    entity: string,
    entityId: string,
    metadata: Record<string, unknown>,
  ) {
    if (!adminId) {
      return;
    }

    await this.prisma.auditLog.create({
      data: {
        adminId,
        action,
        entity,
        entityId,
        metadata: metadata as any,
      },
    });
  }

  private money(value: number) {
    return Number((Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2));
  }
}
