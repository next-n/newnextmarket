import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ConfirmPaymentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @ApiProperty({ example: true })
  @Type(() => Boolean)
  @IsBoolean()
  success!: boolean;

  @ApiPropertyOptional({ example: 'mock_txn_123' })
  @IsOptional()
  @IsString()
  transactionId?: string;
}
