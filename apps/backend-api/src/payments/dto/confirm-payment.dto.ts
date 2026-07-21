import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ConfirmPaymentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentId?: string;

  @ApiProperty({ example: true })
  @Type(() => Boolean)
  @IsBoolean()
  success!: boolean;

  @ApiPropertyOptional({ example: 'mock_txn_123' })
  @IsOptional()
  @IsString()
  transactionId?: string;
}
