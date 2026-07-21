import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { AdminJwtGuard } from '../common/guards/admin-jwt.guard';
import { AuthenticatedAdmin } from '../common/types/auth.types';
import { ReturnQueryDto } from './dto/return-query.dto';
import { UpdateReturnStatusDto } from './dto/update-return-status.dto';
import { ReturnsService } from './returns.service';

@ApiTags('Admin Returns')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard)
@Controller('admin/returns')
export class AdminReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Get()
  @ApiOperation({ summary: 'List returns' })
  @ApiOkResponse({ description: 'Return requests returned successfully' })
  async list(@Query() query: ReturnQueryDto) {
    return {
      message: 'Return requests returned successfully',
      data: await this.returnsService.listAdminReturns(query),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get return detail' })
  @ApiOkResponse({ description: 'Return request returned successfully' })
  async detail(@Param('id') id: string) {
    return {
      message: 'Return request returned successfully',
      data: await this.returnsService.getAdminReturn(id),
    };
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update return status' })
  @ApiOkResponse({ description: 'Return status updated successfully' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateReturnStatusDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return {
      message: 'Return status updated successfully',
      data: await this.returnsService.updateReturnStatus(id, dto, admin.id),
    };
  }
}
