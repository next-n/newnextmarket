import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AdminJwtGuard } from '../common/guards/admin-jwt.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminBannersController } from './admin-banners.controller';
import { BannersController } from './banners.controller';
import { BannersService } from './banners.service';

@Module({
  imports: [PrismaModule, AuditLogsModule, JwtModule.register({})],
  controllers: [BannersController, AdminBannersController],
  providers: [BannersService, AdminJwtGuard],
})
export class BannersModule {}
