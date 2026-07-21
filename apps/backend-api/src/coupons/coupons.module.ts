import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AdminJwtGuard } from '../common/guards/admin-jwt.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminCouponsController } from './admin-coupons.controller';
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';

@Module({
  imports: [PrismaModule, AuditLogsModule, JwtModule.register({})],
  controllers: [CouponsController, AdminCouponsController],
  providers: [CouponsService, AdminJwtGuard],
})
export class CouponsModule {}
