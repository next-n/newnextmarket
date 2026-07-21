import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VariantStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductVariantDto {
  @ApiPropertyOptional({ example: 'Small / Black' })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  identifier?: string;

  @ApiPropertyOptional({ deprecated: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  sku?: string;

  @ApiPropertyOptional({ example: '9' })
  @IsOptional()
  @IsString()
  size?: string;

  @ApiPropertyOptional({ example: 'D' })
  @IsOptional()
  @IsString()
  width?: string;

  @ApiPropertyOptional({ example: 'Black/White' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: '#111111' })
  @IsOptional()
  @IsString()
  colorCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salePrice?: number;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock!: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @ApiPropertyOptional({ enum: VariantStatus })
  @IsOptional()
  @IsEnum(VariantStatus)
  status?: VariantStatus;
}
