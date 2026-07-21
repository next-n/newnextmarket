import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { AdminJwtGuard } from '../common/guards/admin-jwt.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedAdmin, AuthenticatedCustomer } from '../common/types/auth.types';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('notifications')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List current customer notifications' })
  async listCustomer(@CurrentUser() user: AuthenticatedCustomer, @Query() query: NotificationQueryDto) {
    return { message: 'Notifications returned successfully', data: await this.notificationsService.listCustomer(user.id, query) };
  }

  @Patch('notifications/:id/read')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Mark current customer notification as read' })
  async markRead(@CurrentUser() user: AuthenticatedCustomer, @Param('id') id: string) {
    return { message: 'Notification marked as read', data: await this.notificationsService.markRead(user.id, id) };
  }

  @Get('admin/notifications')
  @ApiBearerAuth()
  @UseGuards(AdminJwtGuard, RolesGuard)
  @ApiOperation({ summary: 'List notifications' })
  @Permissions('notifications:read')
  async listAdmin(@Query() query: NotificationQueryDto) {
    return { message: 'Notifications returned successfully', data: await this.notificationsService.list(query) };
  }

  @Post('admin/notifications')
  @ApiBearerAuth()
  @UseGuards(AdminJwtGuard, RolesGuard)
  @ApiOperation({ summary: 'Create notification' })
  @Permissions('notifications:create')
  @ApiCreatedResponse({ description: 'Notification created successfully' })
  async create(@Body() dto: CreateNotificationDto, @CurrentAdmin() admin: AuthenticatedAdmin) {
    return { message: 'Notification created successfully', data: await this.notificationsService.create(dto, admin.id) };
  }
}
