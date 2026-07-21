import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminJwtGuard } from '../common/guards/admin-jwt.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminReturnsController } from './admin-returns.controller';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';

@Module({
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [ReturnsController, AdminReturnsController],
  providers: [ReturnsService, JwtAuthGuard, AdminJwtGuard],
})
export class ReturnsModule {}
