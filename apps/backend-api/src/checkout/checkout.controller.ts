import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedCustomer } from '../common/types/auth.types';
import { CheckoutValidateDto } from './dto/checkout-validate.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { ShippingRateDto } from './dto/shipping-rate.dto';
import { CheckoutService } from './checkout.service';

@ApiTags('Checkout')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate active cart for checkout' })
  @ApiOkResponse({ description: 'Checkout validation returned successfully' })
  async validate(
    @CurrentUser() user: AuthenticatedCustomer,
    @Body() _dto: CheckoutValidateDto,
  ) {
    return {
      message: 'Checkout validation returned successfully',
      data: await this.checkoutService.validate(user.id),
    };
  }

  @Post('shipping-rate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Return available shipping rates' })
  @ApiOkResponse({ description: 'Shipping rates returned successfully' })
  async shippingRate(
    @CurrentUser() user: AuthenticatedCustomer,
    @Body() dto: ShippingRateDto,
  ) {
    return {
      message: 'Shipping rates returned successfully',
      data: await this.checkoutService.shippingRate(user.id, dto),
    };
  }

  @Post('create-order')
  @ApiOperation({ summary: 'Create order from active cart' })
  @ApiCreatedResponse({ description: 'Order created successfully' })
  async createOrder(
    @CurrentUser() user: AuthenticatedCustomer,
    @Body() dto: CreateOrderDto,
  ) {
    return {
      message: 'Order created successfully',
      data: await this.checkoutService.createOrder(user.id, dto),
    };
  }

  @Post('confirm-payment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm mock payment for an order' })
  @ApiOkResponse({ description: 'Payment confirmation processed successfully' })
  async confirmPayment(
    @CurrentUser() user: AuthenticatedCustomer,
    @Body() dto: ConfirmPaymentDto,
  ) {
    return {
      message: 'Payment confirmation processed successfully',
      data: await this.checkoutService.confirmPayment(user.id, dto),
    };
  }
}
