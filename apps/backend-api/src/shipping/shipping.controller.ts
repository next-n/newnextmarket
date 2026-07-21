import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ShippingCalculateDto } from './dto/shipping-calculate.dto';
import { ShippingService } from './shipping.service';

@ApiTags('Shipping')
@Controller('shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Get('methods')
  @ApiOperation({ summary: 'List shipping methods' })
  @ApiOkResponse({ description: 'Shipping methods returned successfully' })
  async methods() {
    return {
      message: 'Shipping methods returned successfully',
      data: await this.shippingService.methods(),
    };
  }

  @Post('calculate')
  @ApiOperation({ summary: 'Calculate shipping options' })
  @ApiOkResponse({ description: 'Shipping options calculated successfully' })
  async calculate(@Body() dto: ShippingCalculateDto) {
    return {
      message: 'Shipping options calculated successfully',
      data: await this.shippingService.calculate(dto),
    };
  }
}
