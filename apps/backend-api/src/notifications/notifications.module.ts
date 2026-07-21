import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AdminJwtGuard } from '../common/guards/admin-jwt.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [PrismaModule, AuditLogsModule, JwtModule.register({})],
  controllers: [NotificationsController],
  providers: [NotificationsService, JwtAuthGuard, AdminJwtGuard],
})
export class NotificationsModule {}
