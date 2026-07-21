import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AdminJwtGuard } from './common/guards/admin-jwt.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor';
import { AdminOrdersController } from './orders/admin-orders.controller';
import { OrdersController } from './orders/orders.controller';
import { AdminPaymentsController } from './payments/admin-payments.controller';
import { PaymentsController } from './payments/payments.controller';
import { AdminReturnsController } from './returns/admin-returns.controller';
import { ReturnsController } from './returns/returns.controller';
import { AdminShippingController } from './shipping/admin-shipping.controller';
import { ShippingController } from './shipping/shipping.controller';
import { ShippingService } from './shipping/shipping.service';

describe('Post-checkout controllers', () => {
  it('requires customer tokens for customer order, payment, and return endpoints', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, OrdersController)).toContain(
      JwtAuthGuard,
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, PaymentsController)).toContain(
      JwtAuthGuard,
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, ReturnsController)).toContain(
      JwtAuthGuard,
    );
  });

  it('requires admin tokens for admin order, payment, shipment, and return endpoints', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminOrdersController)).toContain(
      AdminJwtGuard,
    );
    expect(
      Reflect.getMetadata(GUARDS_METADATA, AdminPaymentsController),
    ).toContain(AdminJwtGuard);
    expect(
      Reflect.getMetadata(GUARDS_METADATA, AdminShippingController),
    ).toContain(AdminJwtGuard);
    expect(
      Reflect.getMetadata(GUARDS_METADATA, AdminReturnsController),
    ).toContain(AdminJwtGuard);
  });

  it('admin guard rejects customer tokens', async () => {
    const jwtService = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: 'customer_1',
        email: 'customer@example.com',
        type: 'customer',
      }),
    };
    const configService = {
      get: jest.fn().mockReturnValue('secret'),
    };
    const prisma = {
      admin: {
        findUnique: jest.fn(),
      },
    };
    const guard = new AdminJwtGuard(
      jwtService as any,
      configService as any,
      prisma as any,
    );
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization: 'Bearer customer-token' },
        }),
      }),
    };

    await expect(guard.canActivate(context as any)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('preserves the standard API response format', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ShippingController],
      providers: [
        {
          provide: ShippingService,
          useValue: {
            methods: jest.fn().mockResolvedValue({
              methods: [{ id: 'standard' }, { id: 'express' }],
            }),
          },
        },
      ],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();

    const response = await request(app.getHttpServer())
      .get('/api/shipping/methods')
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      message: 'Shipping methods returned successfully',
      data: {
        methods: [{ id: 'standard' }, { id: 'express' }],
      },
    });

    await app.close();
  });
});
