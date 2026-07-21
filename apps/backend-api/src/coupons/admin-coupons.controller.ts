import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { AdminJwtGuard } from '../common/guards/admin-jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedAdmin } from '../common/types/auth.types';
import { CouponsService } from './coupons.service';
import { CouponQueryDto } from './dto/coupon-query.dto';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

@ApiTags('Admin Coupons')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, RolesGuard)
@Controller('admin/coupons')
export class AdminCouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post()
  @ApiOperation({ summary: 'Create coupon' })
  @Permissions('coupons:create')
  @ApiCreatedResponse({ description: 'Coupon created successfully' })
  async create(@Body() dto: CreateCouponDto, @CurrentAdmin() admin: AuthenticatedAdmin) {
    return { message: 'Coupon created successfully', data: await this.couponsService.create(dto, admin.id) };
  }

  @Get()
  @ApiOperation({ summary: 'List coupons' })
  @Permissions('coupons:read')
  @ApiOkResponse({ description: 'Coupons returned successfully' })
  async list(@Query() query: CouponQueryDto) {
    return { message: 'Coupons returned successfully', data: await this.couponsService.list(query) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get coupon' })
  @Permissions('coupons:read')
  @ApiOkResponse({ description: 'Coupon returned successfully' })
  async detail(@Param('id') id: string) {
    return { message: 'Coupon returned successfully', data: await this.couponsService.get(id) };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update coupon' })
  @Permissions('coupons:update')
  @ApiOkResponse({ description: 'Coupon updated successfully' })
  async update(@Param('id') id: string, @Body() dto: UpdateCouponDto, @CurrentAdmin() admin: AuthenticatedAdmin) {
    return { message: 'Coupon updated successfully', data: await this.couponsService.update(id, dto, admin.id) };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete coupon' })
  @Permissions('coupons:delete')
  @ApiOkResponse({ description: 'Coupon deleted successfully' })
  async delete(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin) {
    return { message: 'Coupon deleted successfully', data: await this.couponsService.delete(id, admin.id) };
  }
}
