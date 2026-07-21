import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
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
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';

@ApiTags('Admin Product Variants')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, RolesGuard)
@Controller('admin/variants')
export class AdminVariantsController {
  constructor(private readonly catalogService: CatalogService) {}

  @Patch(':id')
  @Permissions('products:update')
  @ApiOperation({ summary: 'Update product variant' })
  @ApiOkResponse({ description: 'Variant updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductVariantDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return {
      message: 'Variant updated successfully',
      data: await this.catalogService.updateProductVariant(id, dto, admin.id),
    };
  }

  @Delete(':id')
  @Permissions('products:delete')
  @ApiOperation({ summary: 'Soft delete product variant' })
  @ApiOkResponse({ description: 'Variant deleted successfully' })
  async delete(
    @Param('id') id: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return {
      message: 'Variant deleted successfully',
      data: await this.catalogService.deleteProductVariant(id, admin.id),
    };
  }
}
