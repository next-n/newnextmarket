import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ShippingAddressDto {
  @ApiProperty({ example: 'Alex' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  firstName!: string;

  @ApiProperty({ example: 'Runner' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  lastName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiProperty({ example: '123 Test Street' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  addressLine1!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  addressLine2?: string;

  @ApiProperty({ example: 'Boston' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city!: string;

  @ApiPropertyOptional({ example: 'MA' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiProperty({ example: '02108' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  postalCode!: string;

  @ApiProperty({ example: 'US' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  country!: string;
}
