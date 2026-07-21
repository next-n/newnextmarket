import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'path';
import { AuthModule } from './auth/auth.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { BannersModule } from './banners/banners.module';
import { CartModule } from './cart/cart.module';
import { CatalogModule } from './catalog/catalog.module';
import { CheckoutModule } from './checkout/checkout.module';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';
import { CouponsModule } from './coupons/coupons.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { ReportsModule } from './reports/reports.module';
import { ReturnsModule } from './returns/returns.module';
import { ReviewsModule } from './reviews/reviews.module';
import { SettingsModule } from './settings/settings.module';
import { ShippingModule } from './shipping/shipping.module';
import { UploadsModule } from './uploads/uploads.module';
import { WishlistModule } from './wishlist/wishlist.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // The monorepo starts the backend from the workspace root, while its
      // secrets live beside the backend package.
      envFilePath: [resolve(__dirname, '../.env'), resolve(process.cwd(), '.env')],
      load: [appConfig, databaseConfig, jwtConfig, redisConfig],
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    CatalogModule,
    CartModule,
    CheckoutModule,
    OrdersModule,
    PaymentsModule,
    ShippingModule,
    ReturnsModule,
    AuditLogsModule,
    CouponsModule,
    BannersModule,
    ReviewsModule,
    WishlistModule,
    UploadsModule,
    ReportsModule,
    SettingsModule,
    NotificationsModule,
  ],
})
export class AppModule {}
