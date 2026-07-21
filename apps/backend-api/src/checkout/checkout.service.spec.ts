import { Test } from '@nestjs/testing';
import {
  CartStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ShipmentStatus,
  VariantStatus,
} from '@prisma/client';
import { CartService } from '../cart/cart.service';
import { PrismaService } from '../prisma/prisma.service';
import { CheckoutService } from './checkout.service';

const pendingOrder = {
  id: 'order_1',
  orderNumber: 'NB-1',
  userId: 'customer_1',
  cartId: 'cart_1',
  status: OrderStatus.PENDING,
  subtotal: 164.99,
  discountAmount: 16.5,
  shippingFee: 0,
  taxAmount: 0,
  totalAmount: 148.49,
  currency: 'USD',
  notes: null,
  shippingAddressSnapshot: { city: 'Boston', country: 'US' },
  billingAddressSnapshot: { city: 'Boston', country: 'US' },
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  cart: {
    id: 'cart_1',
    status: CartStatus.ACTIVE,
    couponId: 'coupon_1',
  },
  items: [
    {
      id: 'order_item_1',
      productId: 'product_1',
      productVariantId: 'variant_1',
      quantity: 2,
      unitPrice: 82.49,
      subtotal: 164.98,
      productName: 'Fresh Foam X 1080',
      sku: 'NB-FFX1080-BLK-090-D',
      size: '9',
      width: 'D',
      color: 'Black/White',
      productSnapshot: { productSlug: 'fresh-foam-x-1080' },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  ],
  payments: [
    {
      id: 'payment_1',
      method: 'MOCK',
      status: PaymentStatus.PENDING,
      amount: 148.49,
      currency: 'USD',
      provider: 'mock',
      transactionId: null,
      paidAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  ],
  shipments: [
    {
      id: 'shipment_1',
      status: ShipmentStatus.PENDING,
      carrier: null,
      trackingNumber: null,
      shippingMethod: 'standard',
      shippedAt: null,
      deliveredAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  ],
};

describe('CheckoutService', () => {
  let service: CheckoutService;
  let prisma: { $transaction: jest.Mock; order: { findFirst: jest.Mock } };
  let cartService: { validateCartForCheckout: jest.Mock };
  let tx: any;

  beforeEach(async () => {
    tx = {
      order: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      payment: {
        updateMany: jest.fn(),
      },
      productVariant: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      inventoryLog: {
        create: jest.fn(),
      },
      shipment: {
        update: jest.fn(),
      },
      cartItem: {
        deleteMany: jest.fn(),
      },
      cart: {
        update: jest.fn(),
      },
      user: {
        updateMany: jest.fn(),
      },
      couponUsage: {
        upsert: jest.fn(),
      },
    };
    cartService = {
      validateCartForCheckout: jest.fn(),
    };
    prisma = {
      order: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn((callback: (transaction: any) => unknown) =>
        callback(tx),
      ),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CheckoutService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: CartService,
          useValue: cartService,
        },
      ],
    }).compile();

    service = moduleRef.get(CheckoutService);
  });

  it('returns standard and express shipping rates with free standard shipping', async () => {
    cartService.validateCartForCheckout.mockResolvedValue({
      response: {
        currency: 'USD',
        shippingEstimate: {
          standard: 0,
          express: 15.98,
        },
      },
    });

    const response = await service.shippingRate('customer_1', {
      country: 'US',
      state: 'MA',
      city: 'Boston',
    });

    expect(response.methods).toEqual([
      expect.objectContaining({
        id: 'standard',
        amount: 0,
        isFree: true,
      }),
      expect.objectContaining({
        id: 'express',
        amount: 15.98,
        isFree: false,
      }),
    ]);
  });

  it('creates an order with item snapshots, payment, and shipment', async () => {
    cartService.validateCartForCheckout.mockResolvedValue({
      cart: {
        id: 'cart_1',
        items: [
          {
            quantity: 2,
            productVariant: {
              id: 'variant_1',
              sku: 'NB-FFX1080-BLK-090-D',
              size: '9',
              width: 'D',
              color: 'Black/White',
              imageUrl: null,
              price: 100,
              salePrice: 80,
              product: {
                id: 'product_1',
                name: 'Fresh Foam X 1080',
                slug: 'fresh-foam-x-1080',
                status: 'ACTIVE',
              },
            },
          },
        ],
      },
      totals: {
        subtotal: 160,
        discountAmount: 0,
        shippingFee: 0,
        taxAmount: 16,
        totalAmount: 176,
        currency: 'USD',
      },
    });
    prisma.order.findFirst.mockResolvedValue(null);
    tx.order.create.mockResolvedValue({
      ...pendingOrder,
      subtotal: 160,
      discountAmount: 0,
      taxAmount: 16,
      totalAmount: 176,
      items: [
        {
          ...pendingOrder.items[0],
          unitPrice: 80,
          subtotal: 160,
          productSnapshot: { productSlug: 'fresh-foam-x-1080' },
        },
      ],
      payments: [
        {
          ...pendingOrder.payments[0],
            method: PaymentMethod.CASH_ON_DELIVERY,
          amount: 176,
        },
      ],
      shipments: [
        {
          ...pendingOrder.shipments[0],
          shippingMethod: 'standard',
        },
      ],
    });
    tx.productVariant.findUnique.mockResolvedValue({
      id: 'variant_1',
      sku: 'NB-FFX1080-BLK-090-D',
      stock: 5,
      status: VariantStatus.ACTIVE,
      deletedAt: null,
    });
    tx.productVariant.updateMany.mockResolvedValue({ count: 1 });
    tx.order.findUniqueOrThrow.mockResolvedValue({
      ...pendingOrder,
      status: OrderStatus.CONFIRMED,
      items: [{
        ...pendingOrder.items[0],
        unitPrice: 80,
        subtotal: 160,
        productSnapshot: { productSlug: 'fresh-foam-x-1080' },
      }],
      payments: [{ ...pendingOrder.payments[0], method: PaymentMethod.CASH_ON_DELIVERY }],
    });

    const response = await service.createOrder('customer_1', {
      shippingMethod: 'standard',
      shippingAddress: {
        firstName: 'Alex',
        lastName: 'Runner',
        addressLine1: '123 Test Street',
        city: 'Boston',
        state: 'MA',
        postalCode: '02108',
        country: 'US',
      },
    });

    expect(response.order.items[0]).toEqual(
      expect.objectContaining({
        productName: 'Fresh Foam X 1080',
        productSlug: 'fresh-foam-x-1080',
        sku: 'NB-FFX1080-BLK-090-D',
        unitPrice: 80,
        lineTotal: 160,
      }),
    );
    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'customer_1',
          cartId: 'cart_1',
          totalAmount: 176,
          items: {
            create: [
              expect.objectContaining({
                productName: 'Fresh Foam X 1080',
                sku: 'NB-FFX1080-BLK-090-D',
                size: '9',
                width: 'D',
                color: 'Black/White',
                unitPrice: 80,
                subtotal: 160,
                productSnapshot: expect.objectContaining({
                  productSlug: 'fresh-foam-x-1080',
                }),
              }),
            ],
          },
          payments: {
            create: expect.objectContaining({
              method: PaymentMethod.CASH_ON_DELIVERY,
              status: PaymentStatus.PENDING,
              amount: 176,
            }),
          },
          shipments: {
            create: expect.objectContaining({
              status: ShipmentStatus.PENDING,
              shippingMethod: 'standard',
            }),
          },
        }),
        include: expect.any(Object),
      }),
    );
  });

  it('reduces inventory and clears cart when mock payment succeeds', async () => {
    tx.order.findFirst.mockResolvedValue(pendingOrder);
    tx.payment.updateMany.mockResolvedValue({ count: 1 });
    tx.productVariant.findUnique.mockResolvedValue({
      id: 'variant_1',
      stock: 10,
      status: VariantStatus.ACTIVE,
      deletedAt: null,
    });
    tx.order.findUniqueOrThrow.mockResolvedValue({
      ...pendingOrder,
      status: OrderStatus.CONFIRMED,
      cart: { ...pendingOrder.cart, status: CartStatus.CHECKED_OUT },
      payments: [
        {
          ...pendingOrder.payments[0],
          status: PaymentStatus.PAID,
          paidAt: new Date('2026-01-01T00:01:00.000Z'),
        },
      ],
    });

    const response: any = await service.confirmPayment('customer_1', {
      orderId: 'order_1',
      success: true,
    });

    expect(response.payment.status).toBe(PaymentStatus.PAID);
    expect(response.inventoryAdjusted).toBe(true);
    expect(tx.productVariant.update).toHaveBeenCalledWith({
      where: { id: 'variant_1' },
      data: { stock: 8, status: VariantStatus.ACTIVE },
    });
    expect(tx.inventoryLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productVariantId: 'variant_1',
        quantity: -2,
        stockBefore: 10,
        stockAfter: 8,
      }),
    });
    expect(tx.cart.update).toHaveBeenCalledWith({
      where: { id: 'cart_1' },
      data: { status: CartStatus.CHECKED_OUT, couponId: null },
    });
    expect(tx.couponUsage.upsert).toHaveBeenCalledWith({
      where: { orderId: 'order_1' },
      create: expect.objectContaining({
        couponId: 'coupon_1',
        userId: 'customer_1',
        orderId: 'order_1',
      }),
      update: expect.objectContaining({ discountAmount: 16.5 }),
    });
  });

  it('does not reduce inventory when mock payment fails', async () => {
    tx.order.findFirst.mockResolvedValue(pendingOrder);
    tx.order.findUniqueOrThrow.mockResolvedValue({
      ...pendingOrder,
      payments: [
        {
          ...pendingOrder.payments[0],
          status: PaymentStatus.FAILED,
        },
      ],
    });

    const response: any = await service.confirmPayment('customer_1', {
      orderId: 'order_1',
      success: false,
    });

    expect(response.payment.status).toBe(PaymentStatus.FAILED);
    expect(response.inventoryAdjusted).toBe(false);
    expect(tx.productVariant.update).not.toHaveBeenCalled();
    expect(tx.inventoryLog.create).not.toHaveBeenCalled();
    expect(tx.cart.update).not.toHaveBeenCalled();
  });

  it('does not reduce inventory twice for an already paid order', async () => {
    tx.order.findFirst.mockResolvedValue({
      ...pendingOrder,
      status: OrderStatus.CONFIRMED,
      payments: [
        {
          ...pendingOrder.payments[0],
          status: PaymentStatus.PAID,
        },
      ],
    });

    const response: any = await service.confirmPayment('customer_1', {
      orderId: 'order_1',
      success: true,
    });

    expect(response.alreadyProcessed).toBe(true);
    expect(response.inventoryAdjusted).toBe(false);
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
    expect(tx.productVariant.update).not.toHaveBeenCalled();
    expect(tx.inventoryLog.create).not.toHaveBeenCalled();
  });

  it('does not allow confirming another customer order', async () => {
    tx.order.findFirst.mockResolvedValue(null);

    await expect(
      service.confirmPayment('customer_2', {
        orderId: 'order_1',
        success: true,
      }),
    ).rejects.toThrow('Order not found');
    expect(tx.order.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'order_1',
        userId: 'customer_2',
      },
      include: expect.any(Object),
    });
  });
});
