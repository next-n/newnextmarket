import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminJwtGuard } from '../common/guards/admin-jwt.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminAuthController } from './admin-auth.controller';
import { AdminCustomersController } from './admin-customers.controller';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [JwtModule.register({}), PrismaModule],
  controllers: [AuthController, AdminAuthController, AdminCustomersController],
  providers: [AuthService, JwtAuthGuard, AdminJwtGuard, RolesGuard],
  exports: [AuthService, JwtAuthGuard, AdminJwtGuard, RolesGuard],
})
export class AuthModule {}
