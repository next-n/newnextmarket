import { Injectable } from '@nestjs/common';
import { OrderStatus, PaymentStatus, VariantStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsQueryDto } from './dto/reports-query.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(query: ReportsQueryDto) {
    const where = this.dateWhere(query);
    const activeOrderWhere = {
      ...where,
      status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
    };
    const [
      paidPayments,
      totalOrders,
      totalCustomers,
      pendingOrders,
      lowStockProducts,
      recentOrders,
      ordersByStatus,
      paidPaymentRows,
      topSellingProducts,
      periodOrders,
    ] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { status: { in: [PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.REFUNDED] }, order: activeOrderWhere },
        _sum: { amount: true },
      }),
      this.prisma.order.count({ where: activeOrderWhere }),
      this.prisma.user.count({ where }),
      this.prisma.order.count({ where: { ...where, status: OrderStatus.PENDING } }),
      this.prisma.productVariant.count({ where: { stock: { lte: 5 }, status: { not: VariantStatus.DISCONTINUED } } }),
      this.prisma.order.findMany({ where, take: 10, orderBy: { createdAt: 'desc' } }),
      this.prisma.order.groupBy({ by: ['status'], where, _count: { id: true } }),
      this.prisma.payment.findMany({
        where: { status: { in: [PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.REFUNDED] }, order: activeOrderWhere },
        include: { order: true, refunds: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.orderItem.groupBy({
        by: ['productId'],
        where: this.orderRelationWhere(activeOrderWhere),
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
      }),
      this.prisma.order.findMany({
        where: activeOrderWhere,
        select: {
          totalAmount: true,
          payments: { select: { method: true, status: true } },
        },
      }),
    ]);
    const salesValue = periodOrders.reduce((total, order) => total + Number(order.totalAmount), 0);
    const pendingCod = periodOrders.filter((order) =>
      order.payments.some((payment) => payment.method === 'CASH_ON_DELIVERY' && payment.status === PaymentStatus.PENDING),
    ).length;
    const collectedRevenue = paidPaymentRows.reduce((total, payment) => total + this.netPaymentAmount(payment), 0);
    return {
      totalRevenue: collectedRevenue,
      collectedRevenue,
      salesValue,
      pendingCod,
      totalOrders,
      totalCustomers,
      pendingOrders,
      lowStockProducts,
      recentOrders: recentOrders.map((order) => this.orderSummary(order)),
      ordersByStatus: ordersByStatus.map((row) => ({ status: row.status, count: row._count.id })),
      topSellingProducts: topSellingProducts.map((row) => ({
        productId: row.productId,
        quantity: row._sum.quantity ?? 0,
      })),
      revenueByDate: this.groupByDate(paidPaymentRows, query.groupBy ?? 'day', (payment) => this.netPaymentAmount(payment)),
    };
  }

  async sales(query: ReportsQueryDto) {
    const activeOrderWhere = {
      ...this.dateWhere(query),
      status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
    };
    const payments = await this.prisma.payment.findMany({
      where: { status: { in: [PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.REFUNDED] }, order: activeOrderWhere },
      include: { order: true },
      orderBy: { createdAt: 'asc' },
    });
    return {
      revenueByDate: this.groupByDate(payments, query.groupBy ?? 'day', (payment) => this.netPaymentAmount(payment)),
      totalRevenue: payments.reduce((total, payment) => total + this.netPaymentAmount(payment), 0),
    };
  }

  private netPaymentAmount(payment: any) {
    const amount = Number(payment.amount ?? 0);
    const refunds = (payment.refunds ?? []).reduce((total: number, refund: any) => total + Number(refund.amount ?? 0), 0);
    return Math.max(amount - refunds, 0);
  }

  async orders(query: ReportsQueryDto) {
    const where = this.dateWhere(query);
    const [orders, byStatus] = await Promise.all([
      this.prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, take: query.limit ?? 20 }),
      this.prisma.order.groupBy({ by: ['status'], where, _count: { id: true } }),
    ]);
    return { orders: orders.map((order) => this.orderSummary(order)), ordersByStatus: byStatus.map((row) => ({ status: row.status, count: row._count.id })) };
  }

  async products(_query: ReportsQueryDto) {
    const [bestSellingProducts, inventorySummary] = await Promise.all([
      this.prisma.orderItem.groupBy({ by: ['productId'], _sum: { quantity: true }, orderBy: { _sum: { quantity: 'desc' } }, take: 10 }),
      this.prisma.productVariant.aggregate({ _sum: { stock: true }, _count: { id: true } }),
    ]);
    return { bestSellingProducts, productInventorySummary: { totalVariants: inventorySummary._count.id, totalStock: inventorySummary._sum.stock ?? 0 } };
  }

  async customers(query: ReportsQueryDto) {
    const users = await this.prisma.user.findMany({ where: { createdAt: this.dateWhere(query).createdAt }, orderBy: { createdAt: 'asc' } });
    return { totalCustomers: users.length, customersByDate: this.groupByDate(users, query.groupBy ?? 'day', () => 1) };
  }

  private dateWhere(query: ReportsQueryDto) {
    const createdAt: any = {
      ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
      ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
    };
    return Object.keys(createdAt).length ? { createdAt } : {};
  }

  private orderRelationWhere(orderWhere: Record<string, unknown>) {
    return Object.keys(orderWhere).length ? { order: orderWhere } : {};
  }

  private groupByDate(items: any[], groupBy: 'day' | 'week' | 'month', value: (item: any) => number) {
    const groups = new Map<string, number>();
    for (const item of items) {
      const date = new Date(item.createdAt);
      const key =
        groupBy === 'month'
          ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
          : date.toISOString().slice(0, 10);
      groups.set(key, (groups.get(key) ?? 0) + value(item));
    }
    return Array.from(groups.entries()).map(([date, total]) => ({ date, total }));
  }

  private orderSummary(order: any) {
    return { id: order.id, orderNumber: order.orderNumber, status: order.status, totalAmount: Number(order.totalAmount), createdAt: order.createdAt };
  }
}
