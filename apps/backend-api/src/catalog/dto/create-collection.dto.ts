import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CollectionStatus } from '@prisma/client';
import {
  IsEnum,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateCollectionDto {
  @ApiProperty({ example: 'Best Sellers' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'best-sellers' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ enum: CollectionStatus })
  @IsOptional()
  @IsEnum(CollectionStatus)
  status?: CollectionStatus;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  showOnHomepage?: boolean;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  homepagePriority?: number;
}
