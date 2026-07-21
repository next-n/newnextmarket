import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AdminJwtGuard } from '../common/guards/admin-jwt.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminReviewsController } from './admin-reviews.controller';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [PrismaModule, AuditLogsModule, JwtModule.register({})],
  controllers: [ReviewsController, AdminReviewsController],
  providers: [ReviewsService, JwtAuthGuard, AdminJwtGuard],
})
export class ReviewsModule {}
