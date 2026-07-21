import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AdminJwtGuard } from '../common/guards/admin-jwt.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [PrismaModule, AuditLogsModule, JwtModule.register({})],
  controllers: [UploadsController],
  providers: [UploadsService, AdminJwtGuard],
})
export class UploadsModule {}
