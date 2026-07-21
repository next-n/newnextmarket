import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { AdminJwtGuard } from '../common/guards/admin-jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedAdmin } from '../common/types/auth.types';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('Settings')
@Controller()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('settings')
  @ApiOperation({ summary: 'Get public settings' })
  async publicSettings() {
    return { message: 'Settings returned successfully', data: await this.settingsService.publicSettings() };
  }

  @Get('admin/settings')
  @ApiBearerAuth()
  @UseGuards(AdminJwtGuard, RolesGuard)
  @ApiOperation({ summary: 'List admin settings' })
  @Permissions('settings:read')
  async adminSettings() {
    return { message: 'Settings returned successfully', data: await this.settingsService.adminSettings() };
  }

  @Patch('admin/settings')
  @ApiBearerAuth()
  @UseGuards(AdminJwtGuard, RolesGuard)
  @ApiOperation({ summary: 'Update settings' })
  @Permissions('settings:update')
  @ApiOkResponse({ description: 'Settings updated successfully' })
  async update(@Body() dto: UpdateSettingsDto, @CurrentAdmin() admin: AuthenticatedAdmin) {
    return { message: 'Settings updated successfully', data: await this.settingsService.update(dto, admin.id) };
  }
}
