import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedCustomer } from '../common/types/auth.types';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto';

@ApiTags('Customer Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a customer account' })
  @ApiCreatedResponse({ description: 'Customer registered successfully' })
  async register(@Body() dto: RegisterDto) {
    return {
      message: 'Customer registered successfully',
      data: await this.authService.registerCustomer(dto),
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login as a customer' })
  @ApiOkResponse({ description: 'Customer logged in successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  async login(@Body() dto: LoginDto) {
    return {
      message: 'Customer logged in successfully',
      data: await this.authService.loginCustomer(dto),
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout the current customer' })
  @ApiOkResponse({ description: 'Customer logged out successfully' })
  async logout(@CurrentUser() user: AuthenticatedCustomer) {
    await this.authService.logoutCustomer(user.id);

    return {
      message: 'Customer logged out successfully',
      data: {},
    };
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate customer refresh token' })
  @ApiOkResponse({ description: 'Token refreshed successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid refresh token' })
  async refreshToken(@Body() dto: RefreshTokenDto) {
    return {
      message: 'Token refreshed successfully',
      data: await this.authService.refreshCustomerToken(dto),
    };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request customer password reset' })
  @ApiOkResponse({ description: 'Password reset request accepted' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto);

    return {
      message: 'If an account exists, password reset instructions will be sent',
      data: {},
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset customer password' })
  @ApiOkResponse({ description: 'Password reset request accepted' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);

    return {
      message: 'Password reset flow is ready for token verification',
      data: {},
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current customer profile' })
  @ApiOkResponse({ description: 'Customer profile returned successfully' })
  async me(@CurrentUser() user: AuthenticatedCustomer) {
    return {
      message: 'Customer profile returned successfully',
      data: await this.authService.getCustomerProfile(user.id),
    };
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update the current customer profile' })
  @ApiOkResponse({ description: 'Customer profile updated successfully' })
  async updateMe(@CurrentUser() user: AuthenticatedCustomer, @Body() dto: UpdateCustomerProfileDto) {
    return {
      message: 'Customer profile updated successfully',
      data: await this.authService.updateCustomerProfile(user.id, dto),
    };
  }
}
