import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedCustomer } from '../common/types/auth.types';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { OrdersService } from './orders.service';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'List customer orders' })
  @ApiOkResponse({ description: 'Orders returned successfully' })
  async list(
    @CurrentUser() user: AuthenticatedCustomer,
    @Query() query: OrderQueryDto,
  ) {
    return {
      message: 'Orders returned successfully',
      data: await this.ordersService.listCustomerOrders(user.id, query),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get customer order detail' })
  @ApiOkResponse({ description: 'Order returned successfully' })
  async detail(
    @CurrentUser() user: AuthenticatedCustomer,
    @Param('id') id: string,
  ) {
    return {
      message: 'Order returned successfully',
      data: await this.ordersService.getCustomerOrder(user.id, id),
    };
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel customer order' })
  @ApiOkResponse({ description: 'Order cancelled successfully' })
  async cancel(
    @CurrentUser() user: AuthenticatedCustomer,
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
  ) {
    return {
      message: 'Order cancelled successfully',
      data: await this.ordersService.cancelCustomerOrder(user.id, id, dto),
    };
  }
}
