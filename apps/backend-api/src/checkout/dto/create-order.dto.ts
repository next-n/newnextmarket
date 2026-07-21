import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ShippingAddressDto } from './shipping-address.dto';

export class CreateOrderDto {
  @ApiProperty({ enum: [PaymentMethod.CASH_ON_DELIVERY], default: PaymentMethod.CASH_ON_DELIVERY })
  @IsIn([PaymentMethod.CASH_ON_DELIVERY])
  paymentMethod?: PaymentMethod = PaymentMethod.CASH_ON_DELIVERY;

  @ApiProperty({ enum: ['standard', 'express'], example: 'standard' })
  @IsIn(['standard', 'express'])
  shippingMethod!: 'standard' | 'express';

  @ApiProperty({ type: ShippingAddressDto })
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress!: ShippingAddressDto;

  @ApiPropertyOptional({ type: ShippingAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  billingAddress?: ShippingAddressDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
