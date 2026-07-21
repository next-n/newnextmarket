import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CheckoutModule } from '../checkout/checkout.module';
import { AdminJwtGuard } from '../common/guards/admin-jwt.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminPaymentsController } from './admin-payments.controller';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [PrismaModule, CheckoutModule, JwtModule.register({})],
  controllers: [PaymentsController, AdminPaymentsController],
  providers: [PaymentsService, JwtAuthGuard, AdminJwtGuard],
  exports: [PaymentsService],
})
export class PaymentsModule {}
