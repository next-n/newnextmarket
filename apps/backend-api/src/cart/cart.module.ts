import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

@Module({
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [CartController],
  providers: [CartService, JwtAuthGuard],
  exports: [CartService],
})
export class CartModule {}
