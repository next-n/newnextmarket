import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'customer@example.com' })
  @IsEmail({}, { message: 'Email must be valid' })
  email!: string;

  @ApiProperty({ minLength: 8, example: 'Password123!' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password!: string;

  @ApiProperty({ example: 'Alex' })
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  @MaxLength(80)
  firstName!: string;

  @ApiProperty({ example: 'Runner' })
  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  @MaxLength(80)
  lastName!: string;
}
