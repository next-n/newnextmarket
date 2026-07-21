import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CheckoutValidateDto {
  @ApiPropertyOptional({ description: 'Reserved for future validation modes.' })
  @IsOptional()
  @IsString()
  mode?: string;
}
