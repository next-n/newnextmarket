import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class UpdateSettingsDto {
  @ApiProperty({ example: { store_name: 'Sportwear', currency: 'USD' } })
  @IsObject()
  settings!: Record<string, unknown>;
}
