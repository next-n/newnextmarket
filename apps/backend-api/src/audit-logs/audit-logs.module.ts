import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminJwtGuard } from '../common/guards/admin-jwt.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';

@Module({
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [AuditLogsController],
  providers: [AuditLogsService, AdminJwtGuard],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}
