import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { AdminJwtGuard } from '../common/guards/admin-jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedAdmin } from '../common/types/auth.types';
import { CatalogService } from './catalog.service';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { InventoryQueryDto } from './dto/inventory-query.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';

@ApiTags('Admin Inventory')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, RolesGuard)
@Controller('admin/inventory')
export class AdminInventoryController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  @Permissions('inventory:read')
  @ApiOperation({ summary: 'List inventory by variant' })
  @ApiOkResponse({ description: 'Inventory returned successfully' })
  async list(@Query() query: InventoryQueryDto) {
    return {
      message: 'Inventory returned successfully',
      data: await this.catalogService.listInventory(query),
    };
  }

  @Get(':variantId')
  @Permissions('inventory:read')
  @ApiOperation({ summary: 'Get inventory for a variant' })
  @ApiOkResponse({ description: 'Inventory returned successfully' })
  async detail(@Param('variantId') variantId: string) {
    return {
      message: 'Inventory returned successfully',
      data: await this.catalogService.getInventoryByVariantId(variantId),
    };
  }

  @Patch(':variantId')
  @Permissions('inventory:update')
  @ApiOperation({ summary: 'Update inventory settings or stock' })
  @ApiOkResponse({ description: 'Inventory updated successfully' })
  async update(
    @Param('variantId') variantId: string,
    @Body() dto: UpdateInventoryDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return {
      message: 'Inventory updated successfully',
      data: await this.catalogService.updateInventory(
        variantId,
        dto,
        admin.id,
      ),
    };
  }

  @Post(':variantId/adjust')
  @Permissions('inventory:update')
  @ApiOperation({ summary: 'Adjust variant inventory' })
  @ApiOkResponse({ description: 'Inventory adjusted successfully' })
  async adjust(
    @Param('variantId') variantId: string,
    @Body() dto: AdjustInventoryDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return {
      message: 'Inventory adjusted successfully',
      data: await this.catalogService.adjustInventory(
        variantId,
        dto,
        admin.id,
      ),
    };
  }
}
