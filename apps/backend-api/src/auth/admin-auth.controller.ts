import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { AdminJwtGuard } from '../common/guards/admin-jwt.guard';
import { AuthenticatedAdmin } from '../common/types/auth.types';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('Admin Auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login as an admin' })
  @ApiOkResponse({ description: 'Admin logged in successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  async login(@Body() dto: LoginDto) {
    return {
      message: 'Admin logged in successfully',
      data: await this.authService.loginAdmin(dto),
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout the current admin' })
  @ApiOkResponse({ description: 'Admin logged out successfully' })
  async logout(@CurrentAdmin() admin: AuthenticatedAdmin) {
    await this.authService.logoutAdmin(admin.id);

    return {
      message: 'Admin logged out successfully',
      data: {},
    };
  }

  @Get('me')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current admin profile' })
  @ApiOkResponse({ description: 'Admin profile returned successfully' })
  async me(@CurrentAdmin() admin: AuthenticatedAdmin) {
    return {
      message: 'Admin profile returned successfully',
      data: await this.authService.getAdminProfile(admin.id),
    };
  }
}
