import { ApiPropertyOptional } from '@nestjs/swagger';
import { BannerStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SupportPaginationDto } from '../../common/dto/pagination.dto';

export class BannerQueryDto extends SupportPaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: BannerStatus })
  @IsOptional()
  @IsEnum(BannerStatus)
  status?: BannerStatus;
}
