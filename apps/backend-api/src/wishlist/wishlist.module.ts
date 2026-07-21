import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';

@Module({
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [WishlistController],
  providers: [WishlistService, JwtAuthGuard],
})
export class WishlistModule {}
