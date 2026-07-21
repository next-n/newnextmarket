import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { AdminJwtGuard } from '../common/guards/admin-jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedAdmin } from '../common/types/auth.types';
import { BannersService } from './banners.service';
import { BannerQueryDto } from './dto/banner-query.dto';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';

@ApiTags('Admin Banners')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, RolesGuard)
@Controller('admin/banners')
export class AdminBannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Get()
  @ApiOperation({ summary: 'List banners' })
  @Permissions('banners:read')
  async list(@Query() query: BannerQueryDto) {
    return { message: 'Banners returned successfully', data: await this.bannersService.list(query) };
  }
  @Post()
  @ApiOperation({ summary: 'Create banner' })
  @Permissions('banners:create')
  @ApiCreatedResponse({ description: 'Banner created successfully' })
  async create(@Body() dto: CreateBannerDto, @CurrentAdmin() admin: AuthenticatedAdmin) {
    return { message: 'Banner created successfully', data: await this.bannersService.create(dto, admin.id) };
  }
  @Get(':id')
  @ApiOperation({ summary: 'Get banner' })
  @Permissions('banners:read')
  async detail(@Param('id') id: string) {
    return { message: 'Banner returned successfully', data: await this.bannersService.get(id) };
  }
  @Patch(':id')
  @ApiOperation({ summary: 'Update banner' })
  @Permissions('banners:update')
  async update(@Param('id') id: string, @Body() dto: UpdateBannerDto, @CurrentAdmin() admin: AuthenticatedAdmin) {
    return { message: 'Banner updated successfully', data: await this.bannersService.update(id, dto, admin.id) };
  }
  @Delete(':id')
  @ApiOperation({ summary: 'Delete banner' })
  @Permissions('banners:delete')
  async delete(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin) {
    return { message: 'Banner deleted successfully', data: await this.bannersService.delete(id, admin.id) };
  }
}
