import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { AdminJwtGuard } from '../common/guards/admin-jwt.guard';
import { AuthenticatedAdmin } from '../common/types/auth.types';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { RefundOrderDto } from './dto/refund-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

@ApiTags('Admin Orders')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'List admin orders' })
  @ApiOkResponse({ description: 'Orders returned successfully' })
  async list(@Query() query: OrderQueryDto) {
    return {
      message: 'Orders returned successfully',
      data: await this.ordersService.listAdminOrders(query),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get admin order detail' })
  @ApiOkResponse({ description: 'Order returned successfully' })
  async detail(@Param('id') id: string) {
    return {
      message: 'Order returned successfully',
      data: await this.ordersService.getAdminOrder(id),
    };
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update order status' })
  @ApiOkResponse({ description: 'Order status updated successfully' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return {
      message: 'Order status updated successfully',
      data: await this.ordersService.updateOrderStatus(id, dto, admin.id),
    };
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel order' })
  @ApiOkResponse({ description: 'Order cancelled successfully' })
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return {
      message: 'Order cancelled successfully',
      data: await this.ordersService.cancelAdminOrder(id, dto, admin.id),
    };
  }

  @Post(':id/refund')
  @ApiOperation({ summary: 'Refund order' })
  @ApiOkResponse({ description: 'Order refunded successfully' })
  async refund(
    @Param('id') id: string,
    @Body() dto: RefundOrderDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return {
      message: 'Order refunded successfully',
      data: await this.ordersService.refundAdminOrder(id, dto, admin.id),
    };
  }
}
