import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminJwtGuard } from '../common/guards/admin-jwt.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminShippingController } from './admin-shipping.controller';
import { ShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';

@Module({
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [ShippingController, AdminShippingController],
  providers: [ShippingService, AdminJwtGuard],
})
export class ShippingModule {}
