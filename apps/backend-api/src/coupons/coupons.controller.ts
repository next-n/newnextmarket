import { Body, Controller, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
import { CouponsService } from './coupons.service';

@ApiTags('Coupons')
@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post('validate')
  @ApiOperation({ summary: 'Validate coupon' })
  @ApiOkResponse({ description: 'Coupon validated successfully' })
  async validate(@Body() dto: ValidateCouponDto) {
    return {
      message: 'Coupon validated successfully',
      data: await this.couponsService.validate(dto),
    };
  }
}
