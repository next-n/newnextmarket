jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  BannerStatus,
  CouponStatus,
  CouponType,
  NotificationType,
  ProductStatus,
  ReviewStatus,
  UploadType,
} from '@prisma/client';
import { AuditLogsService } from './audit-logs/audit-logs.service';
import { BannersService } from './banners/banners.service';
import { CouponsService } from './coupons/coupons.service';
import { NotificationsService } from './notifications/notifications.service';
import { ReportsService } from './reports/reports.service';
import { ReviewsService } from './reviews/reviews.service';
import { SettingsService } from './settings/settings.service';
import { UploadsService } from './uploads/uploads.service';
import { WishlistService } from './wishlist/wishlist.service';

const now = new Date('2026-01-01T00:00:00.000Z');

describe('Support modules services', () => {
  let prisma: any;
  let auditLogs: AuditLogsService;

  beforeEach(() => {
    prisma = {
      auditLog: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
      coupon: { create: jest.fn(), findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      couponUsage: { count: jest.fn() },
      banner: { findMany: jest.fn(), count: jest.fn(), create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      product: { findMany: jest.fn(), findFirst: jest.fn() },
      collection: { findMany: jest.fn() },
      review: { findMany: jest.fn(), count: jest.fn(), create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      orderItem: { findFirst: jest.fn(), groupBy: jest.fn() },
      wishlist: { findUnique: jest.fn(), create: jest.fn() },
      wishlistItem: { create: jest.fn(), delete: jest.fn() },
      upload: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      payment: { aggregate: jest.fn(), findMany: jest.fn() },
      order: { count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
      user: { count: jest.fn(), findMany: jest.fn() },
      productVariant: { count: jest.fn(), aggregate: jest.fn() },
      setting: { findMany: jest.fn(), upsert: jest.fn() },
      notification: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn(), update: jest.fn(), create: jest.fn(), createMany: jest.fn() },
    };
    auditLogs = new AuditLogsService(prisma);
  });

  it('admin can create, update, list, and delete coupons with audit logs', async () => {
    const service = new CouponsService(prisma, auditLogs);
    const coupon = { id: 'coupon_1', code: 'WELCOME10', type: CouponType.PERCENTAGE, status: CouponStatus.ACTIVE, value: 10, minOrderAmount: null, maxDiscountAmount: null, usageLimit: null, usageLimitPerUser: null, startsAt: null, endsAt: null, createdAt: now, updatedAt: now, deletedAt: null };
    prisma.coupon.create.mockResolvedValue(coupon);
    prisma.coupon.findMany.mockResolvedValue([{ ...coupon, _count: { usages: 0 } }]);
    prisma.coupon.count.mockResolvedValue(1);
    prisma.coupon.findFirst.mockResolvedValue(coupon);
    prisma.coupon.update.mockResolvedValue({ ...coupon, status: CouponStatus.INACTIVE });
    prisma.auditLog.create.mockResolvedValue({});

    await expect(service.create({ code: 'welcome10', type: CouponType.PERCENTAGE, value: 10 }, 'admin_1')).resolves.toMatchObject({ code: 'WELCOME10' });
    await expect(service.list({})).resolves.toMatchObject({ meta: { total: 1 } });
    await expect(service.update('coupon_1', { status: CouponStatus.INACTIVE }, 'admin_1')).resolves.toMatchObject({ status: CouponStatus.INACTIVE });
    await expect(service.delete('coupon_1', 'admin_1')).resolves.toMatchObject({ status: CouponStatus.INACTIVE });
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it.each([
    ['expired', { endsAt: new Date('2025-01-01') }, [0, 0]],
    ['disabled', { status: CouponStatus.INACTIVE }, [0, 0]],
    ['overused', { usageLimit: 1 }, [1, 0]],
    ['minimum-not-met', { minOrderAmount: 1000 }, [0, 0]],
  ])('coupon validation rejects %s coupons', async (_label, patch, counts) => {
    const service = new CouponsService(prisma, auditLogs);
    prisma.coupon.findFirst.mockResolvedValue({ id: 'coupon_1', code: 'X', type: CouponType.PERCENTAGE, status: CouponStatus.ACTIVE, value: 10, minOrderAmount: null, maxDiscountAmount: null, usageLimit: null, usageLimitPerUser: null, startsAt: null, endsAt: null, deletedAt: null, ...patch });
    prisma.couponUsage.count.mockResolvedValueOnce(counts[0]).mockResolvedValueOnce(counts[1]);

    await expect(service.validate({ code: 'X', subtotal: 100 })).rejects.toThrow();
  });

  it('public coupon validation calculates discount for valid coupons', async () => {
    const service = new CouponsService(prisma, auditLogs);
    prisma.coupon.findFirst.mockResolvedValue({
      id: 'coupon_1',
      code: 'WELCOME10',
      type: CouponType.PERCENTAGE,
      status: CouponStatus.ACTIVE,
      value: 10,
      minOrderAmount: null,
      maxDiscountAmount: null,
      usageLimit: null,
      usageLimitPerUser: null,
      startsAt: null,
      endsAt: null,
      deletedAt: null,
    });
    prisma.couponUsage.count.mockResolvedValue(0);

    await expect(service.validate({ code: 'welcome10', subtotal: 200 })).resolves.toMatchObject({
      valid: true,
      code: 'WELCOME10',
      discountAmount: 20,
      totalAfterDiscount: 180,
    });
  });

  it('public banners return active banners only and homepage has the expected sections', async () => {
    const service = new BannersService(prisma, auditLogs);
    prisma.banner.findMany.mockResolvedValue([{ id: 'banner_1', title: 'Hero', slug: 'hero', subtitle: null, imageUrl: '/hero.jpg', buttonText: 'Shop', linkUrl: '/', position: 1, status: BannerStatus.ACTIVE, startsAt: null, endsAt: null, createdAt: now, updatedAt: now }]);
    prisma.product.findMany.mockResolvedValue([{ id: 'product_1', name: 'Shoe', slug: 'shoe', basePrice: 100, variants: [{ price: 100, salePrice: null, imageUrl: null }], uploads: [] }]);
    prisma.collection.findMany.mockResolvedValue([{ id: 'collection_1', name: 'New', slug: 'new', description: null }]);

    await expect(service.publicBanners()).resolves.toHaveLength(1);
    expect(prisma.banner.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: BannerStatus.ACTIVE, deletedAt: null }) }));
    const homepage = await service.homepage();
    expect(homepage).toEqual(expect.objectContaining({ banners: expect.any(Array), collections: expect.any(Array) }));
  });

  it('admin can create, update, list, view, and delete banners with button text', async () => {
    const service = new BannersService(prisma, auditLogs);
    const banner = { id: 'banner_1', title: 'Hero', slug: 'hero', subtitle: null, imageUrl: '/hero.jpg', buttonText: 'Shop now', linkUrl: '/', position: 1, status: BannerStatus.ACTIVE, startsAt: null, endsAt: null, createdAt: now, updatedAt: now };
    prisma.banner.create.mockResolvedValue(banner);
    prisma.banner.findMany.mockResolvedValue([banner]);
    prisma.banner.count.mockResolvedValue(1);
    prisma.banner.findFirst.mockResolvedValue(banner);
    prisma.banner.update.mockResolvedValue({ ...banner, status: BannerStatus.INACTIVE });
    prisma.auditLog.create.mockResolvedValue({});

    await expect(service.create({ title: 'Hero', imageUrl: '/hero.jpg', buttonText: 'Shop now', buttonLink: '/', status: BannerStatus.ACTIVE }, 'admin_1')).resolves.toMatchObject({ buttonText: 'Shop now' });
    await expect(service.list({})).resolves.toMatchObject({ meta: { total: 1 } });
    await expect(service.get('banner_1')).resolves.toMatchObject({ id: 'banner_1' });
    await expect(service.update('banner_1', { status: BannerStatus.INACTIVE }, 'admin_1')).resolves.toMatchObject({ status: BannerStatus.INACTIVE });
    await expect(service.delete('banner_1', 'admin_1')).resolves.toMatchObject({ status: BannerStatus.INACTIVE });
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('customer can create review and public reviews return approved reviews only', async () => {
    const service = new ReviewsService(prisma, auditLogs);
    prisma.product.findFirst.mockResolvedValue({ id: 'product_1' });
    prisma.orderItem.findFirst.mockResolvedValue({ id: 'order_item_1' });
    prisma.review.create.mockResolvedValue({ id: 'review_1', productId: 'product_1', userId: 'customer_1', rating: 5, title: null, comment: null, status: ReviewStatus.PENDING, isVerifiedPurchase: true, user: null, createdAt: now, updatedAt: now });
    prisma.review.findMany.mockResolvedValue([{ id: 'review_2', productId: 'product_1', userId: 'customer_2', rating: 4, status: ReviewStatus.APPROVED, isVerifiedPurchase: false, user: null, createdAt: now, updatedAt: now }]);
    prisma.review.count.mockResolvedValue(1);

    await expect(service.create('product_1', 'customer_1', { rating: 5 })).resolves.toMatchObject({ isVerifiedPurchase: true });
    await service.publicProductReviews('product_1', {});
    expect(prisma.review.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: ReviewStatus.APPROVED }) }));
  });

  it('admin can approve, reject, and hide review via status update/delete audit path', async () => {
    const service = new ReviewsService(prisma, auditLogs);
    const review = { id: 'review_1', productId: 'product_1', userId: 'customer_1', rating: 5, status: ReviewStatus.PENDING, isVerifiedPurchase: false, user: null, product: null, createdAt: now, updatedAt: now };
    prisma.review.findFirst.mockResolvedValue(review);
    prisma.review.update.mockResolvedValue({ ...review, status: ReviewStatus.APPROVED });
    prisma.auditLog.create.mockResolvedValue({});

    await expect(service.updateStatus('review_1', { status: ReviewStatus.APPROVED }, 'admin_1')).resolves.toMatchObject({ status: ReviewStatus.APPROVED });
    await expect(service.delete('review_1', 'admin_1')).resolves.toBeDefined();
  });

  it('customer can add and remove wishlist product and duplicate is prevented', async () => {
    const service = new WishlistService(prisma);
    const product = { id: 'product_1', name: 'Shoe', slug: 'shoe', status: ProductStatus.ACTIVE, variants: [], uploads: [] };
    prisma.product.findFirst.mockResolvedValue({ id: 'product_1' });
    prisma.wishlist.findUnique
      .mockResolvedValueOnce({ id: 'wishlist_1', userId: 'customer_1', items: [], createdAt: now, updatedAt: now })
      .mockResolvedValueOnce({ id: 'wishlist_1', userId: 'customer_1', items: [{ id: 'item_1', productId: 'product_1', product, createdAt: now }], createdAt: now, updatedAt: now })
      .mockResolvedValue({ id: 'wishlist_1', userId: 'customer_1', items: [{ id: 'item_1', productId: 'product_1', product, createdAt: now }], createdAt: now, updatedAt: now });

    await expect(service.add('customer_1', 'product_1')).resolves.toBeDefined();
    prisma.wishlistItem.create.mockRejectedValueOnce({ code: 'P2002' });
    await expect(service.add('customer_1', 'product_1')).rejects.toBeInstanceOf(ConflictException);
    await expect(service.remove('customer_1', 'product_1')).resolves.toBeDefined();
  });

  it('wishlist rejects inactive or deleted products', async () => {
    const service = new WishlistService(prisma);
    prisma.product.findFirst.mockResolvedValue(null);

    await expect(service.add('customer_1', 'product_1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.product.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'product_1', status: ProductStatus.ACTIVE, deletedAt: null }),
    }));
  });

  it('upload image validates file type and size', async () => {
    const service = new UploadsService(prisma, auditLogs);
    await expect(service.uploadImage({ mimetype: 'text/plain', size: 10 }, UploadType.GENERAL_FILE)).rejects.toThrow('Invalid image type');
    await expect(service.uploadImage({ mimetype: 'image/png', size: 6 * 1024 * 1024 }, UploadType.GENERAL_FILE)).rejects.toThrow('Image file is too large');
  });

  it('admin can upload, list, and delete upload records', async () => {
    const service = new UploadsService(prisma, auditLogs);
    const upload = { id: 'upload_1', type: UploadType.GENERAL_FILE, url: '/uploads/test.png', filename: 'test.png', mimeType: 'image/png', size: 10, altText: null, metadata: {}, productId: null, bannerId: null, adminId: 'admin_1', createdAt: now, updatedAt: now, deletedAt: null };
    prisma.upload.create.mockResolvedValue(upload);
    prisma.upload.findMany.mockResolvedValue([upload]);
    prisma.upload.findFirst.mockResolvedValue(upload);
    prisma.upload.update.mockResolvedValue({ ...upload, deletedAt: now });
    prisma.auditLog.create.mockResolvedValue({});

    await expect(service.uploadImage({ mimetype: 'image/png', size: 10, originalname: 'test.png', buffer: Buffer.from('ok') }, UploadType.GENERAL_FILE, 'admin_1')).resolves.toMatchObject({ id: 'upload_1', url: '/uploads/test.png' });
    await expect(service.list()).resolves.toHaveLength(1);
    await expect(service.delete('upload_1', 'admin_1')).resolves.toMatchObject({ id: 'upload_1' });
    expect(prisma.upload.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: UploadType.GENERAL_FILE, mimeType: 'image/png', adminId: 'admin_1' }) }));
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('admin reports overview returns expected metrics', async () => {
    const service = new ReportsService(prisma);
    prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 250 } });
    prisma.payment.findMany.mockResolvedValue([
      { id: 'payment_1', amount: 100, createdAt: new Date('2026-01-01T00:00:00.000Z') },
      { id: 'payment_2', amount: 150, createdAt: new Date('2026-01-01T12:00:00.000Z') },
    ]);
    prisma.order.count.mockResolvedValueOnce(4).mockResolvedValueOnce(1);
    prisma.user.count.mockResolvedValue(3);
    prisma.productVariant.count.mockResolvedValue(2);
    prisma.order.findMany.mockResolvedValue([]);
    prisma.order.groupBy.mockResolvedValue([{ status: 'PENDING', _count: { id: 1 } }]);
    prisma.orderItem.groupBy.mockResolvedValue([{ productId: 'product_1', _sum: { quantity: 3 } }]);

    await expect(service.overview({})).resolves.toMatchObject({
      totalRevenue: 250,
      totalOrders: 4,
      totalCustomers: 3,
      pendingOrders: 1,
      lowStockProducts: 2,
      topSellingProducts: [{ productId: 'product_1', quantity: 3 }],
      revenueByDate: [{ date: '2026-01-01', total: 250 }],
    });
  });

  it('public settings do not expose sensitive values and admin can update settings', async () => {
    const service = new SettingsService(prisma, auditLogs);
    prisma.setting.findMany.mockResolvedValue([{ key: 'store_name', value: 'Sportwear' }]);
    await expect(service.publicSettings()).resolves.toEqual({ store_name: 'Sportwear' });
    expect(prisma.setting.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { key: { in: expect.arrayContaining(['store_name', 'currency']) } } }));
    await service.update({ settings: { currency: 'USD', tax_rate: 0.1 } }, 'admin_1');
    expect(prisma.setting.upsert).toHaveBeenCalledTimes(2);
    await expect(service.update({ settings: { tax_rate: 'bad' as any } }, 'admin_1')).rejects.toThrow('tax_rate must be numeric');
  });

  it('customer can list and mark own notification as read and admin can create notification', async () => {
    const service = new NotificationsService(prisma, auditLogs);
    prisma.notification.findMany.mockResolvedValue([]);
    prisma.notification.count.mockResolvedValue(0);
    prisma.notification.findFirst.mockResolvedValue({ id: 'notification_1', userId: 'customer_1' });
    prisma.notification.update.mockResolvedValue({ id: 'notification_1', userId: 'customer_1', type: NotificationType.INFO, title: 'Hi', message: 'Hello', data: null, readAt: now, createdAt: now, updatedAt: now });
    prisma.notification.create.mockResolvedValue({ id: 'notification_2', userId: 'customer_1', type: NotificationType.INFO, title: 'Hi', message: 'Hello', data: null, readAt: null, createdAt: now, updatedAt: now });

    await expect(service.listCustomer('customer_1', {})).resolves.toMatchObject({ meta: { total: 0 } });
    await expect(service.markRead('customer_1', 'notification_1')).resolves.toMatchObject({ readAt: now });
    await expect(service.create({ userId: 'customer_1', type: NotificationType.INFO, title: 'Hi', message: 'Hello' }, 'admin_1')).resolves.toMatchObject({ userId: 'customer_1' });
  });

  it('customer cannot mark another customer notification as read', async () => {
    const service = new NotificationsService(prisma, auditLogs);
    prisma.notification.findFirst.mockResolvedValue(null);

    await expect(service.markRead('customer_1', 'notification_2')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.notification.findFirst).toHaveBeenCalledWith({ where: { id: 'notification_2', userId: 'customer_1' } });
  });

  it('audit log list supports filters and never returns password hashes', async () => {
    prisma.auditLog.findMany.mockResolvedValue([{ id: 'audit_1', adminId: 'admin_1', userId: null, action: AuditAction.UPDATE, entity: 'Coupon', entityId: 'coupon_1', description: null, metadata: {}, admin: { id: 'admin_1', email: 'admin@example.com', password: 'x', refreshTokenHash: 'y' }, createdAt: now }]);
    prisma.auditLog.count.mockResolvedValue(1);
    const result = await auditLogs.list({ adminId: 'admin_1', action: AuditAction.UPDATE, entityType: 'Coupon' });
    expect(result.meta.total).toBe(1);
    expect((result.items[0].admin as any).password).toBeUndefined();
    expect((result.items[0].admin as any).refreshTokenHash).toBeUndefined();
  });
});
