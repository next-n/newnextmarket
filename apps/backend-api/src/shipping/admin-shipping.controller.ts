import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { AdminJwtGuard } from '../common/guards/admin-jwt.guard';
import { AuthenticatedAdmin } from '../common/types/auth.types';
import { ShipmentQueryDto } from './dto/shipment-query.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { ShippingService } from './shipping.service';

@ApiTags('Admin Shipments')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard)
@Controller('admin/shipments')
export class AdminShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Get()
  @ApiOperation({ summary: 'List shipments' })
  @ApiOkResponse({ description: 'Shipments returned successfully' })
  async list(@Query() query: ShipmentQueryDto) {
    return {
      message: 'Shipments returned successfully',
      data: await this.shippingService.listAdminShipments(query),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get shipment detail' })
  @ApiOkResponse({ description: 'Shipment returned successfully' })
  async detail(@Param('id') id: string) {
    return {
      message: 'Shipment returned successfully',
      data: await this.shippingService.getAdminShipment(id),
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update shipment' })
  @ApiOkResponse({ description: 'Shipment updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateShipmentDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return {
      message: 'Shipment updated successfully',
      data: await this.shippingService.updateShipment(id, dto, admin.id),
    };
  }
}
