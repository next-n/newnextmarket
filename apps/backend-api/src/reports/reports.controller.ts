import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../common/decorators/permissions.decorator';
import { AdminJwtGuard } from '../common/guards/admin-jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ReportsQueryDto } from './dto/reports-query.dto';
import { ReportsService } from './reports.service';

@ApiTags('Admin Reports')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, RolesGuard)
@Controller('admin/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get dashboard overview report' })
  @Permissions('reports:read')
  async overview(@Query() query: ReportsQueryDto) {
    return { message: 'Report returned successfully', data: await this.reportsService.overview(query) };
  }
  @Get('sales')
  @ApiOperation({ summary: 'Get sales report' })
  @Permissions('reports:read')
  async sales(@Query() query: ReportsQueryDto) {
    return { message: 'Report returned successfully', data: await this.reportsService.sales(query) };
  }
  @Get('orders')
  @ApiOperation({ summary: 'Get order report' })
  @Permissions('reports:read')
  async orders(@Query() query: ReportsQueryDto) {
    return { message: 'Report returned successfully', data: await this.reportsService.orders(query) };
  }
  @Get('products')
  @ApiOperation({ summary: 'Get product report' })
  @Permissions('reports:read')
  async products(@Query() query: ReportsQueryDto) {
    return { message: 'Report returned successfully', data: await this.reportsService.products(query) };
  }
  @Get('customers')
  @ApiOperation({ summary: 'Get customer report' })
  @Permissions('reports:read')
  async customers(@Query() query: ReportsQueryDto) {
    return { message: 'Report returned successfully', data: await this.reportsService.customers(query) };
  }
}
