import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminJwtGuard } from './common/guards/admin-jwt.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AuditLogsController } from './audit-logs/audit-logs.controller';
import { AdminBannersController } from './banners/admin-banners.controller';
import { AdminCouponsController } from './coupons/admin-coupons.controller';
import { AdminReviewsController } from './reviews/admin-reviews.controller';
import { UploadsController } from './uploads/uploads.controller';
import { ReportsController } from './reports/reports.controller';
import { WishlistController } from './wishlist/wishlist.controller';
import { NotificationsController } from './notifications/notifications.controller';
import { SettingsController } from './settings/settings.controller';

describe('Support module controller security', () => {
  it('admin support controllers require admin guard', () => {
    for (const controller of [
      AdminCouponsController,
      AdminBannersController,
      AdminReviewsController,
      UploadsController,
      ReportsController,
      AuditLogsController,
    ]) {
      expect(Reflect.getMetadata(GUARDS_METADATA, controller)).toContain(
        AdminJwtGuard,
      );
    }

    for (const methodName of ['adminSettings', 'update']) {
      const handler = Object.getOwnPropertyDescriptor(
        SettingsController.prototype,
        methodName,
      )?.value;
      expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toContain(
        AdminJwtGuard,
      );
    }

    for (const methodName of ['listAdmin', 'create']) {
      const handler = Object.getOwnPropertyDescriptor(
        NotificationsController.prototype,
        methodName,
      )?.value;
      expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toContain(
        AdminJwtGuard,
      );
    }
  });

  it('customer support controllers require customer guard where appropriate', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, WishlistController)).toContain(
      JwtAuthGuard,
    );
    const notificationList = Object.getOwnPropertyDescriptor(
      NotificationsController.prototype,
      'listCustomer',
    )?.value;
    expect(Reflect.getMetadata(GUARDS_METADATA, notificationList)).toContain(
      JwtAuthGuard,
    );
  });
});
