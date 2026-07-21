import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CartStatus,
  InventoryLogType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ShipmentStatus,
  VariantStatus,
} from '@prisma/client';
import { CartService, ShippingMethod } from '../cart/cart.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { ShippingAddressDto } from './dto/shipping-address.dto';
import { ShippingRateDto } from './dto/shipping-rate.dto';

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cartService: CartService,
  ) {}

  async validate(userId: string) {
    const validated = await this.cartService.validateCartForCheckout(userId);

    return {
      cart: validated.response,
      totals: validated.totals,
    };
  }

  async shippingRate(userId: string, dto: ShippingRateDto) {
    const validated = await this.cartService.validateCartForCheckout(userId);
    const shippingEstimate = validated.response.shippingEstimate;
    const destination = dto.shippingAddress
      ? {
          country: dto.shippingAddress.country,
          state: dto.shippingAddress.state,
          city: dto.shippingAddress.city,
        }
      : {
          country: dto.country,
          state: dto.state,
          city: dto.city,
        };

    return {
      currency: validated.response.currency,
      destination,
      methods: [
        {
          id: 'standard',
          name: 'Standard Shipping',
          amount: shippingEstimate.standard,
          estimatedDeliveryDays: { min: 3, max: 7 },
          isFree: shippingEstimate.standard === 0,
        },
        {
          id: 'express',
          name: 'Express Shipping',
          amount: shippingEstimate.express,
          estimatedDeliveryDays: { min: 1, max: 3 },
          isFree: false,
        },
      ],
    };
  }

  async createOrder(userId: string, dto: CreateOrderDto) {
    const validated = await this.cartService.validateCartForCheckout(
      userId,
      dto.shippingMethod,
    );
    const existingOrder = await this.prisma.order.findFirst({
      where: {
        userId,
        cartId: validated.cart.id,
      },
      include: this.orderInclude(),
    });

    if (existingOrder) {
      return this.toCheckoutResponse(existingOrder, {
        reusedExistingOrder: true,
      });
    }

    const order = await this.prisma.$transaction(async (transaction) => {
      const tx: any = transaction;
      const createdOrder = await tx.order.create({
        data: {
          orderNumber: this.generateOrderNumber(),
          userId,
          cartId: validated.cart.id,
          status: OrderStatus.CONFIRMED,
          subtotal: validated.totals.subtotal,
          discountAmount: validated.totals.discountAmount,
          shippingFee: validated.totals.shippingFee,
          taxAmount: validated.totals.taxAmount,
          totalAmount: validated.totals.totalAmount,
          currency: validated.totals.currency,
          notes: dto.notes,
          shippingAddressSnapshot: this.toAddressSnapshot(dto.shippingAddress),
          billingAddressSnapshot: this.toAddressSnapshot(
            dto.billingAddress ?? dto.shippingAddress,
          ),
          items: {
            create: validated.cart.items.map((item: any) =>
              this.toOrderItemCreateInput(item),
            ),
          },
          payments: {
            create: {
              method: dto.paymentMethod ?? PaymentMethod.CASH_ON_DELIVERY,
              status: PaymentStatus.PENDING,
              amount: validated.totals.totalAmount,
              currency: validated.totals.currency,
              provider: 'mock',
            },
          },
          shipments: {
            create: {
              status: ShipmentStatus.PENDING,
              shippingMethod: dto.shippingMethod,
            },
          },
        },
        include: this.orderInclude(),
      });

      for (const item of validated.cart.items) {
        const variant = await tx.productVariant.findUnique({
          where: { id: item.productVariant.id },
        });

        if (
          !variant ||
          variant.deletedAt !== null ||
          variant.status !== VariantStatus.ACTIVE ||
          variant.stock < item.quantity
        ) {
          throw new BadRequestException(
            `Insufficient stock for product variant ${item.productVariant.sku}`,
          );
        }

        const stockAfter = variant.stock - item.quantity;
        const stockTransition = await tx.productVariant.updateMany({
          where: {
            id: variant.id,
            status: VariantStatus.ACTIVE,
            stock: { gte: item.quantity },
          },
          data: {
            stock: { decrement: item.quantity },
            status: stockAfter === 0 ? VariantStatus.OUT_OF_STOCK : VariantStatus.ACTIVE,
          },
        });

        if (stockTransition.count !== 1) {
          throw new BadRequestException(
            `Stock changed before checkout for product variant ${item.productVariant.sku}`,
          );
        }

        await tx.inventoryLog.create({
          data: {
            productVariantId: variant.id,
            type: InventoryLogType.STOCK_OUT,
            quantity: -item.quantity,
            stockBefore: variant.stock,
            stockAfter,
            note: `Cash on delivery order ${createdOrder.orderNumber}`,
          },
        });
      }

      await tx.cartItem.deleteMany({ where: { cartId: validated.cart.id } });
      await tx.cart.update({
        where: { id: validated.cart.id },
        data: { status: CartStatus.CHECKED_OUT, couponId: null },
      });
      await tx.user.updateMany({
        where: { id: userId, activeCartId: validated.cart.id },
        data: { activeCartId: null },
      });

      const finalizedOrder = await tx.order.findUniqueOrThrow({
        where: { id: createdOrder.id },
        include: this.orderInclude(),
      });

      return finalizedOrder;
    });

    return this.toCheckoutResponse(order, { reusedExistingOrder: false });
  }

  async confirmPayment(userId: string, dto: ConfirmPaymentDto) {
    return this.prisma.$transaction(async (transaction) => {
      const tx: any = transaction;
      const order = await tx.order.findFirst({
        where: {
          id: dto.orderId,
          userId,
        },
        include: this.orderInclude(),
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      const payment = this.getPrimaryPayment(order);

      if (!payment) {
        throw new BadRequestException('Order payment record not found');
      }

      if (payment.method === PaymentMethod.CASH_ON_DELIVERY) {
        return this.toCheckoutResponse(order, {
          alreadyProcessed: true,
          inventoryAdjusted: false,
          paymentPending: true,
        });
      }

      if (payment.status === PaymentStatus.PAID) {
        return this.toCheckoutResponse(order, {
          alreadyProcessed: true,
          inventoryAdjusted: false,
        });
      }

      if (!dto.success) {
        await tx.payment.updateMany({
          where: {
            id: payment.id,
            status: { not: PaymentStatus.PAID },
          },
          data: {
            status: PaymentStatus.FAILED,
            provider: 'mock',
            transactionId: dto.transactionId ?? payment.transactionId,
            providerPayload: {
              success: false,
              confirmedAt: new Date().toISOString(),
            },
          },
        });

        const failedOrder = await tx.order.findUniqueOrThrow({
          where: { id: order.id },
          include: this.orderInclude(),
        });

        return this.toCheckoutResponse(failedOrder, {
          alreadyProcessed: false,
          inventoryAdjusted: false,
        });
      }

      const paymentTransition = await tx.payment.updateMany({
        where: {
          id: payment.id,
          status: { not: PaymentStatus.PAID },
        },
        data: {
          status: PaymentStatus.PAID,
          provider: 'mock',
          transactionId: dto.transactionId ?? this.generateMockTransactionId(),
          providerPayload: {
            success: true,
            confirmedAt: new Date().toISOString(),
          },
          paidAt: new Date(),
        },
      });

      if (paymentTransition.count === 0) {
        const paidOrder = await tx.order.findUniqueOrThrow({
          where: { id: order.id },
          include: this.orderInclude(),
        });

        return this.toCheckoutResponse(paidOrder, {
          alreadyProcessed: true,
          inventoryAdjusted: false,
        });
      }

      for (const item of order.items) {
        if (!item.productVariantId) {
          throw new BadRequestException(
            `Order item ${item.id} no longer references a variant`,
          );
        }

        const variant = await tx.productVariant.findUnique({
          where: { id: item.productVariantId },
        });

        if (
          !variant ||
          variant.deletedAt !== null ||
          variant.status === VariantStatus.INACTIVE ||
          variant.status === VariantStatus.DISCONTINUED
        ) {
          throw new BadRequestException(
            `Product variant ${item.sku} is not available`,
          );
        }

        if (variant.stock < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for product variant ${item.sku}`,
          );
        }

        const stockBefore = variant.stock;
        const stockAfter = stockBefore - item.quantity;

        await tx.productVariant.update({
          where: { id: variant.id },
          data: {
            stock: stockAfter,
            status:
              stockAfter === 0 ? VariantStatus.OUT_OF_STOCK : variant.status,
          },
        });

        await tx.inventoryLog.create({
          data: {
            productVariantId: variant.id,
            type: InventoryLogType.STOCK_OUT,
            quantity: -item.quantity,
            stockBefore,
            stockAfter,
            note: `Checkout order ${order.orderNumber}`,
          },
        });
      }

      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.CONFIRMED },
      });

      if (order.shipments[0]) {
        await tx.shipment.update({
          where: { id: order.shipments[0].id },
          data: { status: ShipmentStatus.PENDING },
        });
      }

      if (order.cartId) {
        await tx.cartItem.deleteMany({ where: { cartId: order.cartId } });
        await tx.cart.update({
          where: { id: order.cartId },
          data: {
            status: CartStatus.CHECKED_OUT,
            couponId: null,
          },
        });
        await tx.user.updateMany({
          where: {
            id: userId,
            activeCartId: order.cartId,
          },
          data: { activeCartId: null },
        });
      }

      if (order.cart?.couponId) {
        await tx.couponUsage.upsert({
          where: { orderId: order.id },
          create: {
            couponId: order.cart.couponId,
            userId,
            orderId: order.id,
            discountAmount: order.discountAmount,
          },
          update: {
            discountAmount: order.discountAmount,
          },
        });
      }

      const paidOrder = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: this.orderInclude(),
      });

      return this.toCheckoutResponse(paidOrder, {
        alreadyProcessed: false,
        inventoryAdjusted: true,
        cartCleared: true,
      });
    });
  }

  private orderInclude(): any {
    return {
      cart: {
        select: {
          id: true,
          status: true,
          couponId: true,
        },
      },
      items: {
        orderBy: { createdAt: 'asc' },
      },
      payments: {
        orderBy: { createdAt: 'desc' },
      },
      shipments: {
        orderBy: { createdAt: 'desc' },
      },
    };
  }

  private toOrderItemCreateInput(item: any) {
    const variant = item.productVariant;
    const product = variant.product;
    const unitPrice = this.getUnitPrice(variant);

    return {
      productId: product.id,
      productVariantId: variant.id,
      quantity: item.quantity,
      unitPrice,
      subtotal: this.money(unitPrice * item.quantity),
      productName: product.name,
      sku: variant.sku,
      size: variant.size,
      width: variant.width,
      color: variant.color,
      productSnapshot: {
        productSlug: product.slug,
        productName: product.name,
        productStatus: product.status,
        variantId: variant.id,
        sku: variant.sku,
        size: variant.size,
        width: variant.width,
        color: variant.color,
        imageUrl: variant.imageUrl,
      },
    };
  }

  private toCheckoutResponse(order: any, flags: Record<string, unknown> = {}) {
    const payment = this.getPrimaryPayment(order);
    const shipment = order.shipments[0] ?? null;

    return {
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
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
        items: order.items.map((item: any) => ({
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
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
      payment: payment
        ? {
            id: payment.id,
            method: payment.method,
            status: payment.status,
            amount: this.money(Number(payment.amount)),
            currency: payment.currency,
            provider: payment.provider,
            transactionId: payment.transactionId,
            paidAt: payment.paidAt,
          }
        : null,
      shipment: shipment
        ? {
            id: shipment.id,
            status: shipment.status,
            carrier: shipment.carrier,
            trackingNumber: shipment.trackingNumber,
            shippingMethod: shipment.shippingMethod,
            shippedAt: shipment.shippedAt,
            deliveredAt: shipment.deliveredAt,
          }
        : null,
      cart: order.cart
        ? {
            id: order.cart.id,
            status: order.cart.status,
          }
        : null,
      ...flags,
    };
  }

  private getPrimaryPayment(order: any) {
    return order.payments[0] ?? null;
  }

  private toAddressSnapshot(address: ShippingAddressDto) {
    return {
      firstName: address.firstName,
      lastName: address.lastName,
      phone: address.phone ?? null,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 ?? null,
      city: address.city,
      state: address.state ?? null,
      postalCode: address.postalCode,
      country: address.country,
    };
  }

  private getUnitPrice(variant: any) {
    return variant.salePrice === null
      ? Number(variant.price)
      : Number(variant.salePrice);
  }

  private generateOrderNumber() {
    const suffix = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');

    return `NB-${Date.now()}-${suffix}`;
  }

  private generateMockTransactionId() {
    return `mock_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private money(value: number) {
    return Number((Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2));
  }
}
