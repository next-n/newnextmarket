import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryLogType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export class AdjustInventoryDto {
  @ApiProperty({
    description: 'Positive or negative quantity adjustment.',
    example: -2,
  })
  @Type(() => Number)
  @IsInt()
  quantity!: number;

  @ApiPropertyOptional({ enum: InventoryLogType })
  @IsOptional()
  @IsEnum(InventoryLogType)
  type?: InventoryLogType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
