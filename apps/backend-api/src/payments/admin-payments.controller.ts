import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { AdminJwtGuard } from '../common/guards/admin-jwt.guard';
import { AuthenticatedAdmin } from '../common/types/auth.types';
import { PaymentQueryDto } from './dto/payment-query.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Admin Payments')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard)
@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @ApiOperation({ summary: 'List payments' })
  @ApiOkResponse({ description: 'Payments returned successfully' })
  async list(@Query() query: PaymentQueryDto) {
    return {
      message: 'Payments returned successfully',
      data: await this.paymentsService.listAdminPayments(query),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment detail' })
  @ApiOkResponse({ description: 'Payment returned successfully' })
  async detail(@Param('id') id: string) {
    return {
      message: 'Payment returned successfully',
      data: await this.paymentsService.getAdminPayment(id),
    };
  }

  @Post(':id/collect')
  @ApiOperation({ summary: 'Mark a cash-on-delivery payment as collected' })
  @ApiOkResponse({ description: 'Payment marked as collected successfully' })
  async collect(
    @Param('id') id: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return {
      message: 'Payment marked as collected successfully',
      data: await this.paymentsService.collectCashOnDelivery(id, admin.id),
    };
  }

  @Post(':id/refund')
  @ApiOperation({ summary: 'Refund payment' })
  @ApiOkResponse({ description: 'Payment refunded successfully' })
  async refund(
    @Param('id') id: string,
    @Body() dto: RefundPaymentDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return {
      message: 'Payment refunded successfully',
      data: await this.paymentsService.refundPayment(id, dto, admin.id),
    };
  }
}
