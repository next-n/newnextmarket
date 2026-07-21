import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
  ReturnStatus,
  ShipmentStatus,
} from '@prisma/client';
import { CheckoutService } from './checkout/checkout.service';
import { OrdersService } from './orders/orders.service';
import { PaymentsService } from './payments/payments.service';
import { ReturnsService } from './returns/returns.service';
import { ShippingService } from './shipping/shipping.service';

const now = new Date('2026-01-01T00:00:00.000Z');

const order = {
  id: 'order_1',
  orderNumber: 'NB-1',
  userId: 'customer_1',
  status: OrderStatus.PENDING,
  subtotal: 100,
  discountAmount: 0,
  shippingFee: 0,
  taxAmount: 0,
  totalAmount: 100,
  currency: 'USD',
  notes: null,
  shippingAddressSnapshot: {},
  billingAddressSnapshot: {},
  cancelledAt: null,
  items: [],
  payments: [],
  shipments: [],
  returns: [],
  createdAt: now,
  updatedAt: now,
};

const paidPayment = {
  id: 'payment_1',
  orderId: 'order_1',
  method: PaymentMethod.MOCK,
  status: PaymentStatus.PAID,
  amount: 100,
  currency: 'USD',
  provider: 'mock',
  transactionId: 'txn_1',
  paidAt: now,
  refunds: [],
  order,
  createdAt: now,
  updatedAt: now,
};

const shipment = {
  id: 'shipment_1',
  orderId: 'order_1',
  carrier: null,
  trackingNumber: null,
  shippingMethod: 'standard',
  status: ShipmentStatus.PENDING,
  shippedAt: null,
  deliveredAt: null,
  order: {
    id: 'order_1',
    orderNumber: 'NB-1',
    status: OrderStatus.PROCESSING,
    userId: 'customer_1',
  },
  createdAt: now,
  updatedAt: now,
};

const deliveredOrderItem = {
  id: 'order_item_1',
  orderId: 'order_1',
  productVariantId: 'variant_1',
  productName: 'Fresh Foam X 1080',
  sku: 'NB-FFX1080-BLK-090-D',
  size: '9',
  width: 'D',
  color: 'Black/White',
  quantity: 2,
  unitPrice: 50,
  subtotal: 100,
};

const deliveredOrder = {
  ...order,
  status: OrderStatus.DELIVERED,
  items: [deliveredOrderItem],
  payments: [paidPayment],
};

describe('Post-checkout order, payment, shipping, and return services', () => {
  let prisma: any;
  let tx: any;
  let checkoutService: { confirmPayment: jest.Mock };
  let paymentsService: PaymentsService;
  let ordersService: OrdersService;
  let shippingService: ShippingService;
  let returnsService: ReturnsService;

  beforeEach(() => {
    tx = {
      payment: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      refund: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      order: {
        update: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      shipment: {
        update: jest.fn(),
      },
      returnRequest: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };
    prisma = {
      order: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      payment: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      shipment: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
      },
      setting: {
        findMany: jest.fn(),
      },
      returnRequest: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      returnItem: {
        aggregate: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn((callback: (transaction: any) => unknown) =>
        callback(tx),
      ),
    };
    checkoutService = {
      confirmPayment: jest.fn(),
    };
    paymentsService = new PaymentsService(
      prisma,
      checkoutService as unknown as CheckoutService,
    );
    ordersService = new OrdersService(prisma, paymentsService);
    shippingService = new ShippingService(prisma);
    returnsService = new ReturnsService(prisma);
  });

  it('customer order list only queries the logged-in customer orders', async () => {
    prisma.order.findMany.mockResolvedValue([order]);
    prisma.order.count.mockResolvedValue(1);

    const response = await ordersService.listCustomerOrders('customer_1', {});

    expect(response.items).toHaveLength(1);
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'customer_1' },
      }),
    );
  });

  it('customer order detail blocks another customer order', async () => {
    prisma.order.findFirst.mockResolvedValue(null);

    await expect(
      ordersService.getCustomerOrder('customer_2', 'order_1'),
    ).rejects.toThrow('Order not found');
    expect(prisma.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order_1', userId: 'customer_2' },
      }),
    );
  });

  it('customer can cancel an eligible unpaid order', async () => {
    prisma.order.findFirst.mockResolvedValue(order);
    prisma.order.update.mockResolvedValue({
      ...order,
      status: OrderStatus.CANCELLED,
      cancelledAt: now,
    });

    const response = await ordersService.cancelCustomerOrder(
      'customer_1',
      'order_1',
      { reason: 'Changed my mind' },
    );

    expect(response.refundRequired).toBe(false);
    expect(response.order.status).toBe(OrderStatus.CANCELLED);
  });

  it('customer cannot cancel delivered order', async () => {
    prisma.order.findFirst.mockResolvedValue(deliveredOrder);

    await expect(
      ordersService.cancelCustomerOrder('customer_1', 'order_1', {}),
    ).rejects.toThrow('Order cannot be cancelled');
  });

  it.each([
    OrderStatus.CANCELLED,
    OrderStatus.REFUNDED,
    OrderStatus.DELIVERED,
  ])('customer cannot cancel %s order', async (status) => {
    prisma.order.findFirst.mockResolvedValue({ ...order, status });

    await expect(
      ordersService.cancelCustomerOrder('customer_1', 'order_1', {}),
    ).rejects.toThrow('Order cannot be cancelled');
  });

  it('admin can list and filter orders', async () => {
    prisma.order.findMany.mockResolvedValue([order]);
    prisma.order.count.mockResolvedValue(1);

    await ordersService.listAdminOrders({
      status: OrderStatus.PENDING,
      paymentStatus: PaymentStatus.PAID,
      shipmentStatus: ShipmentStatus.PENDING,
      customerId: 'customer_1',
      search: 'NB',
    });

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: OrderStatus.PENDING,
          userId: 'customer_1',
          payments: { some: { status: PaymentStatus.PAID } },
          shipments: { some: { status: ShipmentStatus.PENDING } },
        }),
      }),
    );
  });

  it('admin can update a valid order status', async () => {
    prisma.order.findUnique.mockResolvedValue(order);
    prisma.order.update.mockResolvedValue({
      ...order,
      status: OrderStatus.CONFIRMED,
    });

    const response = await ordersService.updateOrderStatus(
      'order_1',
      { status: OrderStatus.CONFIRMED },
      'admin_1',
    );

    expect(response.status).toBe(OrderStatus.CONFIRMED);
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: OrderStatus.CONFIRMED },
      }),
    );
  });

  it('invalid order status transition is rejected', async () => {
    prisma.order.findUnique.mockResolvedValue(deliveredOrder);

    await expect(
      ordersService.updateOrderStatus('order_1', {
        status: OrderStatus.PROCESSING,
      }),
    ).rejects.toThrow('Invalid order status transition');
  });

  it('payment detail blocks another customer payment', async () => {
    prisma.payment.findFirst.mockResolvedValue(null);

    await expect(
      paymentsService.getCustomerPayment('customer_2', 'payment_1'),
    ).rejects.toThrow('Payment not found');
    expect(prisma.payment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'payment_1', order: { userId: 'customer_2' } },
      }),
    );
  });

  it('admin collects pending cash-on-delivery payment and records an audit event', async () => {
    const pendingCodPayment = {
      ...paidPayment,
      method: PaymentMethod.CASH_ON_DELIVERY,
      status: PaymentStatus.PENDING,
      transactionId: null,
      paidAt: null,
      order: { ...order, status: OrderStatus.CONFIRMED },
    };
    const collectedPayment = {
      ...pendingCodPayment,
      status: PaymentStatus.PAID,
      transactionId: 'cod_payment_1',
      paidAt: now,
      refunds: [],
    };
    tx.payment.findUnique.mockResolvedValue(pendingCodPayment);
    tx.payment.update.mockResolvedValue(collectedPayment);

    const response = await paymentsService.collectCashOnDelivery(
      'payment_1',
      'admin_1',
    );

    expect(response.alreadyCollected).toBe(false);
    expect(response.payment.status).toBe(PaymentStatus.PAID);
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: 'payment_1' },
      data: {
        status: PaymentStatus.PAID,
        paidAt: expect.any(Date),
        transactionId: 'cod_payment_1',
      },
      include: expect.anything(),
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminId: 'admin_1',
        entity: 'Payment',
        entityId: 'payment_1',
      }),
    });
  });

  it('payment confirm reuses checkout confirmation and remains idempotent', async () => {
    prisma.payment.findFirst.mockResolvedValue({ orderId: 'order_1' });
    checkoutService.confirmPayment.mockResolvedValue({
      alreadyProcessed: true,
      inventoryAdjusted: false,
    });

    const response: any = await paymentsService.confirmCustomerPayment('customer_1', {
      paymentId: 'payment_1',
      success: true,
    });

    expect(response.alreadyProcessed).toBe(true);
    expect(checkoutService.confirmPayment).toHaveBeenCalledWith('customer_1', {
      orderId: 'order_1',
      success: true,
      transactionId: undefined,
    });
  });

  it('admin full refund creates refund and marks payment and order refunded', async () => {
    tx.payment.findUnique.mockResolvedValue(paidPayment);
    tx.refund.create.mockResolvedValue({
      id: 'refund_1',
      paymentId: 'payment_1',
      status: RefundStatus.COMPLETED,
      amount: 100,
      currency: 'USD',
      reason: 'Full refund',
      createdAt: now,
      updatedAt: now,
    });
    tx.payment.findUnique.mockResolvedValueOnce(paidPayment).mockResolvedValueOnce({
      ...paidPayment,
      status: PaymentStatus.REFUNDED,
      refunds: [],
    });

    const response = await paymentsService.refundPayment(
      'payment_1',
      { reason: 'Full refund' },
      'admin_1',
    );

    expect(response.refund.amount).toBe(100);
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: 'payment_1' },
      data: { status: PaymentStatus.REFUNDED },
    });
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'order_1' },
      data: { status: OrderStatus.REFUNDED },
    });
  });

  it('refund cannot exceed paid amount minus previous refunds', async () => {
    tx.payment.findUnique.mockResolvedValue({
      ...paidPayment,
      refunds: [{ amount: 90, status: RefundStatus.COMPLETED }],
    });

    await expect(
      paymentsService.refundPayment('payment_1', { amount: 20 }),
    ).rejects.toThrow('Refund amount exceeds refundable amount');
  });

  it('admin partial refund marks payment partially refunded without marking order refunded', async () => {
    tx.payment.findUnique
      .mockResolvedValueOnce(paidPayment)
      .mockResolvedValueOnce({
        ...paidPayment,
        status: PaymentStatus.PARTIALLY_REFUNDED,
        refunds: [],
      });
    tx.refund.create.mockResolvedValue({
      id: 'refund_1',
      paymentId: 'payment_1',
      status: RefundStatus.COMPLETED,
      amount: 40,
      currency: 'USD',
      createdAt: now,
      updatedAt: now,
    });

    const response = await paymentsService.refundPayment('payment_1', {
      amount: 40,
    });

    expect(response.refund.amount).toBe(40);
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: 'payment_1' },
      data: { status: PaymentStatus.PARTIALLY_REFUNDED },
    });
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it('refund cannot be applied again when no refundable amount remains', async () => {
    tx.payment.findUnique.mockResolvedValue({
      ...paidPayment,
      status: PaymentStatus.PARTIALLY_REFUNDED,
      refunds: [{ amount: 100, status: RefundStatus.COMPLETED }],
    });

    await expect(
      paymentsService.refundPayment('payment_1', { amount: 1 }),
    ).rejects.toThrow('Refund amount exceeds refundable amount');
    expect(tx.refund.create).not.toHaveBeenCalled();
  });

  it('shipping methods and calculation match checkout fee behavior', async () => {
    prisma.setting.findMany.mockResolvedValue([
      { key: 'currency', value: 'USD' },
      { key: 'default_shipping_fee', value: 8 },
      { key: 'free_shipping_threshold', value: 100 },
    ]);

    const methods = await shippingService.methods();
    const rates = await shippingService.calculate({ subtotal: 120 });

    expect(methods.methods.map((method) => method.id)).toEqual([
      'standard',
      'express',
    ]);
    expect(rates.methods).toEqual([
      expect.objectContaining({ id: 'standard', amount: 0, isFree: true }),
      expect.objectContaining({ id: 'express', amount: 16 }),
    ]);
  });

  it('admin shipment update works', async () => {
    prisma.shipment.findUnique.mockResolvedValue(shipment);
    tx.shipment.update.mockResolvedValue({
      ...shipment,
      carrier: 'UPS',
      trackingNumber: '1Z123',
    });

    const response = await shippingService.updateShipment(
      'shipment_1',
      { carrier: 'UPS', trackingNumber: '1Z123' },
      'admin_1',
    );

    expect(response.carrier).toBe('UPS');
    expect(tx.shipment.update).toHaveBeenCalled();
  });

  it('delivered shipment can update order to delivered', async () => {
    prisma.shipment.findUnique.mockResolvedValue(shipment);
    tx.shipment.update.mockResolvedValue({
      ...shipment,
      status: ShipmentStatus.DELIVERED,
    });

    await shippingService.updateShipment(
      'shipment_1',
      { status: ShipmentStatus.DELIVERED },
      'admin_1',
    );

    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'order_1' },
      data: { status: OrderStatus.DELIVERED },
    });
  });

  it('customer can create return for delivered order', async () => {
    prisma.order.findFirst.mockResolvedValue(deliveredOrder);
    prisma.returnItem.aggregate.mockResolvedValue({ _sum: { quantity: 0 } });
    prisma.returnRequest.create.mockResolvedValue({
      id: 'return_1',
      orderId: 'order_1',
      userId: 'customer_1',
      status: ReturnStatus.REQUESTED,
      reason: 'Too small',
      notes: null,
      order: deliveredOrder,
      items: [
        {
          id: 'return_item_1',
          orderItemId: 'order_item_1',
          productVariantId: 'variant_1',
          quantity: 1,
          reason: 'Too small',
          orderItem: deliveredOrderItem,
        },
      ],
      refund: null,
      requestedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const response = await returnsService.createCustomerReturn('customer_1', {
      orderId: 'order_1',
      reason: 'Too small',
      items: [{ orderItemId: 'order_item_1', quantity: 1 }],
    });

    expect(response.status).toBe(ReturnStatus.REQUESTED);
    expect(response.items[0].quantity).toBe(1);
  });

  it('customer cannot return non-delivered order', async () => {
    prisma.order.findFirst.mockResolvedValue(order);

    await expect(
      returnsService.createCustomerReturn('customer_1', {
        orderId: 'order_1',
        reason: 'Too small',
        items: [{ orderItemId: 'order_item_1', quantity: 1 }],
      }),
    ).rejects.toThrow('Only delivered orders can be returned');
  });

  it('return item quantity cannot exceed purchased quantity', async () => {
    prisma.order.findFirst.mockResolvedValue(deliveredOrder);
    prisma.returnItem.aggregate.mockResolvedValue({ _sum: { quantity: 1 } });

    await expect(
      returnsService.createCustomerReturn('customer_1', {
        orderId: 'order_1',
        reason: 'Too small',
        items: [{ orderItemId: 'order_item_1', quantity: 2 }],
      }),
    ).rejects.toThrow('Return quantity exceeds remaining purchased quantity');
  });

  it('return items must belong to the order', async () => {
    prisma.order.findFirst.mockResolvedValue(deliveredOrder);

    await expect(
      returnsService.createCustomerReturn('customer_1', {
        orderId: 'order_1',
        reason: 'Wrong item',
        items: [{ orderItemId: 'other_order_item', quantity: 1 }],
      }),
    ).rejects.toThrow('Return item does not belong to order');
  });

  it.each([
    ReturnStatus.APPROVED,
    ReturnStatus.REJECTED,
    ReturnStatus.RECEIVED,
  ])('admin can update return status to %s', async (status) => {
    const returnRequest = {
      id: 'return_1',
      orderId: 'order_1',
      userId: 'customer_1',
      status: ReturnStatus.REQUESTED,
      reason: 'Too small',
      notes: null,
      order: deliveredOrder,
      items: [],
      refund: null,
      requestedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    tx.returnRequest.findUnique
      .mockResolvedValueOnce(returnRequest)
      .mockResolvedValueOnce({ ...returnRequest, status });
    tx.returnRequest.update.mockResolvedValue({ ...returnRequest, status });

    const response = await returnsService.updateReturnStatus(
      'return_1',
      { status },
      'admin_1',
    );

    expect(response.status).toBe(status);
  });

  it('admin can refund a return once', async () => {
    const returnRequest = {
      id: 'return_1',
      orderId: 'order_1',
      userId: 'customer_1',
      status: ReturnStatus.RECEIVED,
      reason: 'Too small',
      notes: null,
      order: deliveredOrder,
      items: [
        {
          id: 'return_item_1',
          quantity: 1,
          orderItem: deliveredOrderItem,
        },
      ],
      refund: null,
      requestedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    tx.returnRequest.findUnique
      .mockResolvedValueOnce(returnRequest)
      .mockResolvedValueOnce({
        ...returnRequest,
        status: ReturnStatus.REFUNDED,
        refund: { id: 'refund_1', amount: 50, status: RefundStatus.COMPLETED },
      });
    tx.returnRequest.update.mockResolvedValue({
      ...returnRequest,
      status: ReturnStatus.REFUNDED,
    });
    tx.refund.findMany.mockResolvedValue([]);

    const response = await returnsService.updateReturnStatus(
      'return_1',
      { status: ReturnStatus.REFUNDED },
      'admin_1',
    );

    expect(response.status).toBe(ReturnStatus.REFUNDED);
    expect(tx.refund.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          returnRequestId: 'return_1',
          amount: 50,
        }),
      }),
    );
  });

  it('return refund workflow does not double refund an already refunded return', async () => {
    const refundedReturn = {
      id: 'return_1',
      orderId: 'order_1',
      userId: 'customer_1',
      status: ReturnStatus.REFUNDED,
      reason: 'Too small',
      notes: null,
      order: deliveredOrder,
      items: [],
      refund: { id: 'refund_1', amount: 50, status: RefundStatus.COMPLETED },
      requestedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    tx.returnRequest.findUnique.mockResolvedValue(refundedReturn);

    const response = await returnsService.updateReturnStatus('return_1', {
      status: ReturnStatus.REFUNDED,
    });

    expect(response.status).toBe(ReturnStatus.REFUNDED);
    expect(tx.refund.create).not.toHaveBeenCalled();
  });

  it('return refund workflow rejects refunding a return that already has a refund', async () => {
    const returnRequest = {
      id: 'return_1',
      orderId: 'order_1',
      userId: 'customer_1',
      status: ReturnStatus.RECEIVED,
      reason: 'Too small',
      notes: null,
      order: deliveredOrder,
      items: [],
      refund: { id: 'refund_1', amount: 50, status: RefundStatus.COMPLETED },
      requestedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    tx.returnRequest.findUnique.mockResolvedValue(returnRequest);
    tx.returnRequest.update.mockResolvedValue({
      ...returnRequest,
      status: ReturnStatus.REFUNDED,
    });

    await expect(
      returnsService.updateReturnStatus('return_1', {
        status: ReturnStatus.REFUNDED,
      }),
    ).rejects.toThrow('Return request has already been refunded');
    expect(tx.refund.create).not.toHaveBeenCalled();
  });

  it('customer cannot access another customer return', async () => {
    prisma.returnRequest.findFirst.mockResolvedValue(null);

    await expect(
      returnsService.getCustomerReturn('customer_2', 'return_1'),
    ).rejects.toThrow('Return request not found');
  });

  it('safe admin order responses never expose password hashes', async () => {
    prisma.order.findUnique.mockResolvedValue({
      ...order,
      user: {
        id: 'customer_1',
        email: 'customer@example.com',
        firstName: 'Alex',
        lastName: 'Runner',
        phone: null,
        status: 'ACTIVE',
        password: 'secret',
        refreshTokenHash: 'refresh',
      },
    });

    const response: any = await ordersService.getAdminOrder('order_1');

    expect(response.customer.password).toBeUndefined();
    expect(response.customer.refreshTokenHash).toBeUndefined();
  });
});
