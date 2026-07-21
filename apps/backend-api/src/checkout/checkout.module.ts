import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CartModule } from '../cart/cart.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';

@Module({
  imports: [PrismaModule, CartModule, JwtModule.register({})],
  controllers: [CheckoutController],
  providers: [CheckoutService, JwtAuthGuard],
  exports: [CheckoutService],
})
export class CheckoutModule {}
