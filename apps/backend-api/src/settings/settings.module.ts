import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AdminJwtGuard } from '../common/guards/admin-jwt.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [PrismaModule, AuditLogsModule, JwtModule.register({})],
  controllers: [SettingsController],
  providers: [SettingsService, AdminJwtGuard],
})
export class SettingsModule {}
