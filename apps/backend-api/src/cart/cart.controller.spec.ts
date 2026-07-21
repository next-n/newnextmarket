import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ApiResponseInterceptor } from '../common/interceptors/api-response.interceptor';
import { CheckoutController } from '../checkout/checkout.controller';
import { CheckoutService } from '../checkout/checkout.service';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

const cartResponse = {
  id: 'cart_1',
  status: 'ACTIVE',
  currency: 'USD',
  items: [
    {
      id: 'cart_item_1',
      productVariantId: 'variant_1',
      productId: 'product_1',
      quantity: 1,
      unitPrice: 164.99,
      lineTotal: 164.99,
      product: {
        id: 'product_1',
        name: 'Fresh Foam X 1080',
        slug: 'fresh-foam-x-1080',
      },
      variant: {
        id: 'variant_1',
        sku: 'NB-FFX1080-BLK-090-D',
        size: '9',
        width: 'D',
        color: 'Black/White',
        stock: 10,
      },
    },
  ],
  subtotal: 164.99,
  discountAmount: 0,
  shippingEstimate: {
    selectedMethod: 'standard',
    standard: 0,
    express: 15.98,
    amount: 0,
    isFreeShipping: true,
  },
  taxAmount: 0,
  totalAmount: 164.99,
  appliedCoupon: null,
};

const orderResponse = {
  order: {
    id: 'order_1',
    orderNumber: 'NB-1',
    status: 'PENDING',
    subtotal: 164.99,
    discountAmount: 16.5,
    shippingFee: 0,
    taxAmount: 0,
    totalAmount: 148.49,
    currency: 'USD',
    items: [
      {
        id: 'order_item_1',
        productName: 'Fresh Foam X 1080',
        productSlug: 'fresh-foam-x-1080',
        sku: 'NB-FFX1080-BLK-090-D',
        size: '9',
        width: 'D',
        color: 'Black/White',
        quantity: 1,
        unitPrice: 164.99,
        lineTotal: 164.99,
      },
    ],
  },
  payment: {
    id: 'payment_1',
    method: 'MOCK',
    status: 'PENDING',
    amount: 148.49,
    currency: 'USD',
  },
  shipment: {
    id: 'shipment_1',
    status: 'PENDING',
    shippingMethod: 'standard',
  },
  cart: {
    id: 'cart_1',
    status: 'ACTIVE',
  },
};

describe('Cart and checkout controllers', () => {
  let app: INestApplication;
  const cartService = {
    getCart: jest.fn(),
    addItem: jest.fn(),
    updateItem: jest.fn(),
    removeItem: jest.fn(),
    clearCart: jest.fn(),
    applyCoupon: jest.fn(),
    removeCoupon: jest.fn(),
  };
  const checkoutService = {
    validate: jest.fn(),
    shippingRate: jest.fn(),
    createOrder: jest.fn(),
    confirmPayment: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CartController, CheckoutController],
      providers: [
        {
          provide: CartService,
          useValue: cartService,
        },
        {
          provide: CheckoutService,
          useValue: checkoutService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => {
            getRequest: () => {
              user?: { id: string; email: string; type: 'customer' };
            };
          };
        }) => {
          const request = context.switchToHttp().getRequest();
          request.user = {
            id: 'customer_1',
            email: 'customer@example.com',
            type: 'customer',
          };

          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires customer authentication guards on cart and checkout controllers', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, CartController)).toContain(
      JwtAuthGuard,
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, CheckoutController)).toContain(
      JwtAuthGuard,
    );
  });

  it('gets or creates the active cart', async () => {
    cartService.getCart.mockResolvedValue(cartResponse);

    const response = await request(app.getHttpServer())
      .get('/api/cart')
      .set('Authorization', 'Bearer customer-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe('cart_1');
    expect(cartService.getCart).toHaveBeenCalledWith('customer_1');
  });

  it('adds an item to the cart', async () => {
    cartService.addItem.mockResolvedValue(cartResponse);

    const response = await request(app.getHttpServer())
      .post('/api/cart/items')
      .set('Authorization', 'Bearer customer-token')
      .send({ productVariantId: 'variant_1', quantity: 1 })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(cartService.addItem).toHaveBeenCalledWith('customer_1', {
      productVariantId: 'variant_1',
      quantity: 1,
    });
  });

  it('rejects adding quantity greater than stock', async () => {
    cartService.addItem.mockRejectedValue(
      new BadRequestException('Requested quantity exceeds available stock'),
    );

    const response = await request(app.getHttpServer())
      .post('/api/cart/items')
      .set('Authorization', 'Bearer customer-token')
      .send({ productVariantId: 'variant_1', quantity: 1000 })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      'Requested quantity exceeds available stock',
    );
  });

  it('updates a cart item quantity', async () => {
    cartService.updateItem.mockResolvedValue({
      ...cartResponse,
      items: [{ ...cartResponse.items[0], quantity: 2, lineTotal: 329.98 }],
    });

    const response = await request(app.getHttpServer())
      .patch('/api/cart/items/cart_item_1')
      .set('Authorization', 'Bearer customer-token')
      .send({ quantity: 2 })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(cartService.updateItem).toHaveBeenCalledWith(
      'customer_1',
      'cart_item_1',
      { quantity: 2 },
    );
  });

  it('removes a cart item', async () => {
    cartService.removeItem.mockResolvedValue({ ...cartResponse, items: [] });

    const response = await request(app.getHttpServer())
      .delete('/api/cart/items/cart_item_1')
      .set('Authorization', 'Bearer customer-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(cartService.removeItem).toHaveBeenCalledWith(
      'customer_1',
      'cart_item_1',
    );
  });

  it('applies a valid coupon', async () => {
    cartService.applyCoupon.mockResolvedValue({
      ...cartResponse,
      discountAmount: 16.5,
      totalAmount: 148.49,
      appliedCoupon: {
        id: 'coupon_1',
        code: 'WELCOME10',
        type: 'PERCENTAGE',
        value: 10,
      },
    });

    const response = await request(app.getHttpServer())
      .post('/api/cart/apply-coupon')
      .set('Authorization', 'Bearer customer-token')
      .send({ code: 'WELCOME10' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.appliedCoupon.code).toBe('WELCOME10');
    expect(cartService.applyCoupon).toHaveBeenCalledWith('customer_1', {
      code: 'WELCOME10',
    });
  });

  it('rejects invalid or expired coupons', async () => {
    cartService.applyCoupon.mockRejectedValue(
      new BadRequestException('Coupon is not valid for this cart'),
    );

    const response = await request(app.getHttpServer())
      .post('/api/cart/apply-coupon')
      .set('Authorization', 'Bearer customer-token')
      .send({ code: 'EXPIRED10' })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Coupon is not valid for this cart');
  });

  it('validates checkout totals', async () => {
    checkoutService.validate.mockResolvedValue({
      cart: cartResponse,
      totals: {
        subtotal: 164.99,
        discountAmount: 0,
        shippingFee: 0,
        taxAmount: 0,
        totalAmount: 164.99,
        currency: 'USD',
      },
    });

    const response = await request(app.getHttpServer())
      .post('/api/checkout/validate')
      .set('Authorization', 'Bearer customer-token')
      .send({})
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.totals.totalAmount).toBe(164.99);
  });

  it('creates an order from the cart', async () => {
    checkoutService.createOrder.mockResolvedValue(orderResponse);

    const response = await request(app.getHttpServer())
      .post('/api/checkout/create-order')
      .set('Authorization', 'Bearer customer-token')
      .send({
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
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.order.orderNumber).toBe('NB-1');
    expect(checkoutService.createOrder).toHaveBeenCalled();
  });

  it('confirms mock payment success and returns checkout completion data', async () => {
    checkoutService.confirmPayment.mockResolvedValue({
      ...orderResponse,
      order: { ...orderResponse.order, status: 'CONFIRMED' },
      payment: { ...orderResponse.payment, status: 'PAID' },
      cart: { id: 'cart_1', status: 'CHECKED_OUT' },
      inventoryAdjusted: true,
      cartCleared: true,
    });

    const response = await request(app.getHttpServer())
      .post('/api/checkout/confirm-payment')
      .set('Authorization', 'Bearer customer-token')
      .send({ orderId: 'order_1', success: true })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.payment.status).toBe('PAID');
    expect(response.body.data.inventoryAdjusted).toBe(true);
  });

  it('confirms mock payment failure without inventory adjustment', async () => {
    checkoutService.confirmPayment.mockResolvedValue({
      ...orderResponse,
      payment: { ...orderResponse.payment, status: 'FAILED' },
      inventoryAdjusted: false,
    });

    const response = await request(app.getHttpServer())
      .post('/api/checkout/confirm-payment')
      .set('Authorization', 'Bearer customer-token')
      .send({ orderId: 'order_1', success: false })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.payment.status).toBe('FAILED');
    expect(response.body.data.inventoryAdjusted).toBe(false);
  });

  it('treats repeated payment confirmation as already processed', async () => {
    checkoutService.confirmPayment
      .mockResolvedValueOnce({
        ...orderResponse,
        payment: { ...orderResponse.payment, status: 'PAID' },
        inventoryAdjusted: true,
      })
      .mockResolvedValueOnce({
        ...orderResponse,
        payment: { ...orderResponse.payment, status: 'PAID' },
        alreadyProcessed: true,
        inventoryAdjusted: false,
      });

    await request(app.getHttpServer())
      .post('/api/checkout/confirm-payment')
      .set('Authorization', 'Bearer customer-token')
      .send({ orderId: 'order_1', success: true })
      .expect(200);

    const response = await request(app.getHttpServer())
      .post('/api/checkout/confirm-payment')
      .set('Authorization', 'Bearer customer-token')
      .send({ orderId: 'order_1', success: true })
      .expect(200);

    expect(response.body.data.alreadyProcessed).toBe(true);
    expect(response.body.data.inventoryAdjusted).toBe(false);
  });
});
