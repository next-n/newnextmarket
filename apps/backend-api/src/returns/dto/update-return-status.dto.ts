import { ApiProperty } from '@nestjs/swagger';
import { ReturnStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateReturnStatusDto {
  @ApiProperty({ enum: ReturnStatus })
  @IsEnum(ReturnStatus)
  status!: ReturnStatus;
}
