import { ApiPropertyOptional } from '@nestjs/swagger';
import { CouponStatus, CouponType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SupportPaginationDto } from '../../common/dto/pagination.dto';

export class CouponQueryDto extends SupportPaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: CouponStatus })
  @IsOptional()
  @IsEnum(CouponStatus)
  status?: CouponStatus;

  @ApiPropertyOptional({ enum: CouponType })
  @IsOptional()
  @IsEnum(CouponType)
  type?: CouponType;
}
