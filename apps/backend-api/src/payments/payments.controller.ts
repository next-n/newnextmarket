import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
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
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get customer payment detail' })
  @ApiOkResponse({ description: 'Payment returned successfully' })
  async detail(
    @CurrentUser() user: AuthenticatedCustomer,
    @Param('id') id: string,
  ) {
    return {
      message: 'Payment returned successfully',
      data: await this.paymentsService.getCustomerPayment(user.id, id),
    };
  }

  @Post('create')
  @ApiOperation({ summary: 'Create mock payment for an order' })
  @ApiCreatedResponse({ description: 'Payment created successfully' })
  async create(
    @CurrentUser() user: AuthenticatedCustomer,
    @Body() dto: CreatePaymentDto,
  ) {
    return {
      message: 'Payment created successfully',
      data: await this.paymentsService.createCustomerPayment(user.id, dto),
    };
  }

  @Post('confirm')
  @ApiOperation({ summary: 'Confirm mock payment' })
  @ApiOkResponse({ description: 'Payment confirmed successfully' })
  async confirm(
    @CurrentUser() user: AuthenticatedCustomer,
    @Body() dto: ConfirmPaymentDto,
  ) {
    return {
      message: 'Payment confirmed successfully',
      data: await this.paymentsService.confirmCustomerPayment(user.id, dto),
    };
  }
}
