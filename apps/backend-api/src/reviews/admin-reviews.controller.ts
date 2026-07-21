import { Body, Controller, Delete, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { AdminJwtGuard } from '../common/guards/admin-jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedAdmin } from '../common/types/auth.types';
import { ReviewQueryDto } from './dto/review-query.dto';
import { UpdateReviewStatusDto } from './dto/update-review-status.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('Admin Reviews')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, RolesGuard)
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}
  @Get()
  @ApiOperation({ summary: 'List reviews' })
  @Permissions('reviews:read')
  async list(@Query() query: ReviewQueryDto) {
    return { message: 'Reviews returned successfully', data: await this.reviewsService.adminList(query) };
  }
  @Get(':id')
  @ApiOperation({ summary: 'Get review' })
  @Permissions('reviews:read')
  async detail(@Param('id') id: string) {
    return { message: 'Review returned successfully', data: await this.reviewsService.adminGet(id) };
  }
  @Patch(':id/status')
  @ApiOperation({ summary: 'Update review status' })
  @Permissions('reviews:update')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateReviewStatusDto, @CurrentAdmin() admin: AuthenticatedAdmin) {
    return { message: 'Review status updated successfully', data: await this.reviewsService.updateStatus(id, dto, admin.id) };
  }
  @Delete(':id')
  @ApiOperation({ summary: 'Delete review' })
  @Permissions('reviews:delete')
  async delete(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin) {
    return { message: 'Review deleted successfully', data: await this.reviewsService.delete(id, admin.id) };
  }
}
