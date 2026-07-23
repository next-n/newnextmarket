import { INestApplication, ValidationPipe } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { ApiResponseInterceptor } from '../../src/common/interceptors/api-response.interceptor';
import { RedisService } from '../../src/redis/redis.service';

const runE2e = process.env.RUN_E2E === 'true';
const runStorageE2e = process.env.RUN_STORAGE_E2E === 'true';
const runProductImageE2e = process.env.RUN_PRODUCT_IMAGE_E2E === 'true';

jest.setTimeout(60_000);

(runE2e ? describe : describe.skip)('MVP API integration', () => {
  let app: INestApplication;
  let redis: RedisService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    redis = app.get(RedisService);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('reads and writes through the real Redis instance', async () => {
    const key = `e2e:test:${Date.now()}`;
    const value = { ok: true, source: 'redis' };

    await redis.set(key, value, 30);

    await expect(redis.get<typeof value>(key)).resolves.toEqual(value);
  });

  it('rejects protected customer and admin routes without the correct token', async () => {
    await request(app.getHttpServer()).get('/api/cart').expect(401);
    await request(app.getHttpServer()).get('/api/admin/products').expect(401);
  });

  it('runs checkout and concurrency-safe cancellation rules end to end', async () => {
    const productsResponse = await request(app.getHttpServer())
      .get('/api/products?limit=20')
      .expect(200);
    const product = productsResponse.body.data.items.find((item: any) =>
      item.variants?.some(
        (variant: any) => variant.status === 'ACTIVE' && variant.stock > 0,
      ),
    );
    const variant = product?.variants?.find(
      (item: any) => item.status === 'ACTIVE' && item.stock > 0,
    );

    expect(product).toBeDefined();
    expect(variant).toBeDefined();
    const initialStock = variant.stock;

    const getCurrentStock = async () => {
      const response = await request(app.getHttpServer())
        .get('/api/products?limit=20')
        .expect(200);
      const currentProduct = response.body.data.items.find(
        (item: any) => item.id === product.id,
      );
      const currentVariant = currentProduct?.variants?.find(
        (item: any) => item.id === variant.id,
      );
      return currentVariant?.stock;
    };

    const email = `e2e-${Date.now()}@example.com`;
    const authResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        password: 'E2ePassword123!',
        firstName: 'E2E',
        lastName: 'Customer',
      })
      .expect(201);
    const accessToken = authResponse.body.data.accessToken;
    expect(accessToken).toEqual(expect.any(String));

    const cartResponse = await request(app.getHttpServer())
      .get('/api/cart')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(cartResponse.body.data.status).toBe('ACTIVE');

    await request(app.getHttpServer())
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ productVariantId: variant.id, quantity: 1 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/checkout/validate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(200);

    const shippingAddress = {
      firstName: 'E2E',
      lastName: 'Customer',
      addressLine1: '1 Test Street',
      city: 'Singapore',
      state: 'SG',
      postalCode: '018989',
      country: 'SG',
    };

    await request(app.getHttpServer())
      .post('/api/checkout/shipping-rate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ country: 'SG', city: 'Singapore' })
      .expect(200);

    const orderResponse = await request(app.getHttpServer())
      .post('/api/checkout/create-order')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ shippingMethod: 'standard', shippingAddress })
      .expect(201);
    const orderId = orderResponse.body.data.order.id;
    expect(orderId).toEqual(expect.any(String));
    expect(await getCurrentStock()).toBe(initialStock - 1);

    const cancellationResponse = await request(app.getHttpServer())
      .post(`/api/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ reason: 'E2E cancellation test' })
      .expect(201);
    expect(cancellationResponse.body.data.order.status).toBe('CANCELLED');
    expect(cancellationResponse.body.data.order.payment.status).toBe(
      'CANCELLED',
    );
    expect(await getCurrentStock()).toBe(initialStock);

    await request(app.getHttpServer())
      .post(`/api/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ reason: 'Repeated cancellation' })
      .expect(400);
    expect(await getCurrentStock()).toBe(initialStock);

    await request(app.getHttpServer())
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ productVariantId: variant.id, quantity: 1 })
      .expect(201);

    const paidOrderResponse = await request(app.getHttpServer())
      .post('/api/checkout/create-order')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ shippingMethod: 'standard', shippingAddress })
      .expect(201);
    const paidOrderId = paidOrderResponse.body.data.order.id;
    const paymentId = paidOrderResponse.body.data.payment.id;
    expect(await getCurrentStock()).toBe(initialStock - 1);

    const adminLoginResponse = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({ email: 'admin@example.com', password: 'Admin123!' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/admin/payments/${paymentId}/collect`)
      .set(
        'Authorization',
        `Bearer ${adminLoginResponse.body.data.accessToken}`,
      )
      .expect(201);

    const paidCancellationResponse = await request(app.getHttpServer())
      .post(`/api/orders/${paidOrderId}/cancel`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ reason: 'Paid order must not cancel directly' })
      .expect(400);
    expect(paidCancellationResponse.body.message).toContain(
      'Paid orders must be refunded',
    );
    expect(await getCurrentStock()).toBe(initialStock - 1);

    const ordersResponse = await request(app.getHttpServer())
      .get('/api/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(ordersResponse.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: orderId,
          status: 'CANCELLED',
        }),
        expect.objectContaining({
          id: paidOrderId,
          status: 'CONFIRMED',
        }),
      ]),
    );
  });

  it('authenticates the seeded admin and protects admin APIs', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({ email: 'admin@example.com', password: 'Admin123!' })
      .expect(200);
    const accessToken = loginResponse.body.data.accessToken;

    const response = await request(app.getHttpServer())
      .get('/api/admin/products')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
  });

  (runStorageE2e ? it : it.skip)('uploads a real product image to Supabase Storage and exposes it publicly', async () => {
    const imagePath = process.env.UPLOAD_TEST_IMAGE;
    expect(imagePath).toBeDefined();
    expect(existsSync(imagePath as string)).toBe(true);

    const loginResponse = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({ email: 'admin@example.com', password: 'Admin123!' })
      .expect(200);
    const accessToken = loginResponse.body.data.accessToken;

    const productsResponse = await request(app.getHttpServer())
      .get('/api/admin/products?limit=1')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const product = productsResponse.body.data.items[0];
    expect(product?.id).toEqual(expect.any(String));

    let uploadId: string | undefined;
    try {
      const uploadResponse = await request(app.getHttpServer())
        .post('/api/admin/uploads/product-image')
        .set('Authorization', `Bearer ${accessToken}`)
        .field('productId', product.id)
        .attach('file', imagePath as string)
        .expect(201);

      const upload = uploadResponse.body.data;
      uploadId = upload.id;
      expect(upload.id).toEqual(expect.any(String));
      expect(upload.productId).toBe(product.id);
      expect(upload.url).toMatch(/\.supabase\.co\/storage\/v1\/object\/public\/ProductImage\//);

      const storageResponse = await fetch(upload.url);
      expect(storageResponse.ok).toBe(true);

      const storefrontResponse = await request(app.getHttpServer())
        .get(`/api/products/${product.slug}`)
        .expect(200);
      expect(storefrontResponse.body.data.images).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: upload.id, url: upload.url })]),
      );
    } finally {
      if (uploadId) {
        await request(app.getHttpServer())
          .delete(`/api/admin/uploads/${uploadId}`)
          .set('Authorization', `Bearer ${accessToken}`);
      }
    }
  });

  (runProductImageE2e ? it : it.skip)('creates a product, uploads its image, and exposes the complete result to the storefront', async () => {
    const imagePath = process.env.UPLOAD_TEST_IMAGE;
    expect(imagePath).toBeDefined();
    expect(existsSync(imagePath as string)).toBe(true);

    const loginResponse = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({ email: 'admin@example.com', password: 'Admin123!' })
      .expect(200);
    const accessToken = loginResponse.body.data.accessToken;
    const slug = `e2e-image-product-${Date.now()}`;
    let productId: string | undefined;
    let uploadId: string | undefined;

    try {
      const productResponse = await request(app.getHttpServer())
        .post('/api/admin/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'E2E Image Product', slug, basePrice: 29.99, gender: 'UNISEX', status: 'ACTIVE' })
        .expect(201);
      productId = productResponse.body.data.id;

      const uploadResponse = await request(app.getHttpServer())
        .post('/api/admin/uploads/product-image')
        .set('Authorization', `Bearer ${accessToken}`)
        .field('productId', productId as string)
        .attach('file', imagePath as string)
        .expect(201);
      uploadId = uploadResponse.body.data.id;
      const imageUrl = uploadResponse.body.data.url;

      expect(uploadResponse.body.data.productId).toBe(productId);
      expect(imageUrl).toMatch(/\.supabase\.co\/storage\/v1\/object\/public\/ProductImage\//);
      expect((await fetch(imageUrl)).ok).toBe(true);

      const adminProduct = await request(app.getHttpServer())
        .get(`/api/admin/products/${productId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(adminProduct.body.data.images).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: uploadId, url: imageUrl })]),
      );

      const storefrontProduct = await request(app.getHttpServer())
        .get(`/api/products/${slug}`)
        .expect(200);
      expect(storefrontProduct.body.data.images).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: uploadId, url: imageUrl })]),
      );
    } finally {
      if (uploadId) {
        await request(app.getHttpServer())
          .delete(`/api/admin/uploads/${uploadId}`)
          .set('Authorization', `Bearer ${accessToken}`);
      }
      if (productId) {
        await request(app.getHttpServer())
          .delete(`/api/admin/products/${productId}`)
          .set('Authorization', `Bearer ${accessToken}`);
      }
    }
  });
});
