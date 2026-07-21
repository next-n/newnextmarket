import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AdminAuthController } from './admin-auth.controller';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AdminJwtGuard } from '../common/guards/admin-jwt.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ApiResponseInterceptor } from '../common/interceptors/api-response.interceptor';

const customerProfile = {
  id: 'customer_1',
  email: 'customer@example.com',
  firstName: 'Alex',
  lastName: 'Runner',
  phone: null,
  status: 'ACTIVE',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const adminProfile = {
  id: 'admin_1',
  email: 'admin@example.com',
  firstName: 'Super',
  lastName: 'Admin',
  status: 'ACTIVE',
  roles: ['super_admin'],
  permissions: ['products:read', 'orders:read'],
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('Auth controllers', () => {
  let app: INestApplication;
  const authService = {
    registerCustomer: jest.fn(),
    loginCustomer: jest.fn(),
    loginAdmin: jest.fn(),
    getCustomerProfile: jest.fn(),
    getAdminProfile: jest.fn(),
    logoutCustomer: jest.fn(),
    logoutAdmin: jest.fn(),
    refreshCustomerToken: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController, AdminAuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
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
            id: customerProfile.id,
            email: customerProfile.email,
            type: 'customer',
          };

          return true;
        },
      })
      .overrideGuard(AdminJwtGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => {
            getRequest: () => {
              admin?: {
                id: string;
                email: string;
                type: 'admin';
                roles: string[];
                permissions: string[];
              };
            };
          };
        }) => {
          const request = context.switchToHttp().getRequest();
          request.admin = {
            id: adminProfile.id,
            email: adminProfile.email,
            type: 'admin',
            roles: adminProfile.roles,
            permissions: adminProfile.permissions,
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
    app.useGlobalInterceptors(new ApiResponseInterceptor());

    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a customer', async () => {
    authService.registerCustomer.mockResolvedValue({
      accessToken: 'customer-access-token',
      refreshToken: 'customer-refresh-token',
      user: customerProfile,
    });

    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'customer@example.com',
        password: 'Password123!',
        firstName: 'Alex',
        lastName: 'Runner',
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.accessToken).toBe('customer-access-token');
    expect(response.body.data.user.email).toBe('customer@example.com');
    expect(response.body.data.user.password).toBeUndefined();
    expect(authService.registerCustomer).toHaveBeenCalledWith({
      email: 'customer@example.com',
      password: 'Password123!',
      firstName: 'Alex',
      lastName: 'Runner',
    });
  });

  it('logs in a customer', async () => {
    authService.loginCustomer.mockResolvedValue({
      accessToken: 'customer-access-token',
      refreshToken: 'customer-refresh-token',
      user: customerProfile,
    });

    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'customer@example.com',
        password: 'Password123!',
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.refreshToken).toBe('customer-refresh-token');
    expect(response.body.data.user.password).toBeUndefined();
  });

  it('logs in an admin', async () => {
    authService.loginAdmin.mockResolvedValue({
      accessToken: 'admin-access-token',
      refreshToken: 'admin-refresh-token',
      admin: adminProfile,
    });

    const response = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'Admin123!',
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.accessToken).toBe('admin-access-token');
    expect(response.body.data.admin.roles).toEqual(['super_admin']);
    expect(response.body.data.admin.password).toBeUndefined();
  });

  it('returns customer profile with token', async () => {
    authService.getCustomerProfile.mockResolvedValue(customerProfile);

    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer customer-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.email).toBe('customer@example.com');
    expect(authService.getCustomerProfile).toHaveBeenCalledWith('customer_1');
  });

  it('returns admin profile with token', async () => {
    authService.getAdminProfile.mockResolvedValue(adminProfile);

    const response = await request(app.getHttpServer())
      .get('/api/admin/auth/me')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.email).toBe('admin@example.com');
    expect(response.body.data.permissions).toEqual([
      'products:read',
      'orders:read',
    ]);
    expect(authService.getAdminProfile).toHaveBeenCalledWith('admin_1');
  });
});
