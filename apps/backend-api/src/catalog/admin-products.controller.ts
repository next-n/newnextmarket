import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
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
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@ApiTags('Admin Products')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, RolesGuard)
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  @Permissions('products:read')
  @ApiOperation({ summary: 'List admin products' })
  @ApiOkResponse({ description: 'Products returned successfully' })
  async list(@Query() query: ProductQueryDto) {
    return {
      message: 'Products returned successfully',
      data: await this.catalogService.listAdminProducts(query),
    };
  }

  @Post()
  @Permissions('products:create')
  @ApiOperation({ summary: 'Create product' })
  @ApiCreatedResponse({ description: 'Product created successfully' })
  async create(
    @Body() dto: CreateProductDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return {
      message: 'Product created successfully',
      data: await this.catalogService.createProduct(dto, admin.id),
    };
  }

  @Get(':id')
  @Permissions('products:read')
  @ApiOperation({ summary: 'Get admin product by id' })
  @ApiOkResponse({ description: 'Product returned successfully' })
  async detail(@Param('id') id: string) {
    return {
      message: 'Product returned successfully',
      data: await this.catalogService.getAdminProductById(id),
    };
  }

  @Patch('variant/:variantId')
  @Permissions('products:update')
  @ApiOperation({ summary: 'Update product variant' })
  @ApiOkResponse({ description: 'Variant updated successfully' })
  async updateVariant(
    @Param('variantId') variantId: string,
    @Body() dto: any,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return {
      message: 'Variant updated successfully',
      data: await this.catalogService.updateProductVariant(variantId, dto, admin.id),
    };
  }

  @Delete('variant/:variantId')
  @Permissions('products:delete')
  @ApiOperation({ summary: 'Discontinue product variant' })
  @ApiOkResponse({ description: 'Variant discontinued successfully' })
  async deleteVariant(
    @Param('variantId') variantId: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return {
      message: 'Variant discontinued successfully',
      data: await this.catalogService.deleteProductVariant(variantId, admin.id),
    };
  }

  @Patch(':id')
  @Permissions('products:update')
  @ApiOperation({ summary: 'Update product' })
  @ApiOkResponse({ description: 'Product updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return {
      message: 'Product updated successfully',
      data: await this.catalogService.updateProduct(id, dto, admin.id),
    };
  }

  @Delete(':id')
  @Permissions('products:delete')
  @ApiOperation({ summary: 'Soft delete product' })
  @ApiOkResponse({ description: 'Product deleted successfully' })
  async delete(
    @Param('id') id: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return {
      message: 'Product deleted successfully',
      data: await this.catalogService.deleteProduct(id, admin.id),
    };
  }

  @Get(':productId/variants')
  @Permissions('products:read')
  @ApiOperation({ summary: 'List product variants' })
  @ApiOkResponse({ description: 'Variants returned successfully' })
  async listVariants(@Param('productId') productId: string) {
    return {
      message: 'Variants returned successfully',
      data: await this.catalogService.listProductVariants(productId),
    };
  }

  @Post(':productId/variants')
  @Permissions('products:create')
  @ApiOperation({ summary: 'Create product variant' })
  @ApiCreatedResponse({ description: 'Variant created successfully' })
  async createVariant(
    @Param('productId') productId: string,
    @Body() dto: CreateProductVariantDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return {
      message: 'Variant created successfully',
      data: await this.catalogService.createProductVariant(
        productId,
        dto,
        admin.id,
      ),
    };
  }

}
