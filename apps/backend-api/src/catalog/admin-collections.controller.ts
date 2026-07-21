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
import { AddCollectionProductDto } from './dto/add-collection-product.dto';
import { CollectionQueryDto } from './dto/collection-query.dto';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';

@ApiTags('Admin Collections')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, RolesGuard)
@Controller('admin/collections')
export class AdminCollectionsController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  @Permissions('collections:read')
  @ApiOperation({ summary: 'List admin collections' })
  @ApiOkResponse({ description: 'Collections returned successfully' })
  async list(@Query() query: CollectionQueryDto) {
    return {
      message: 'Collections returned successfully',
      data: await this.catalogService.listAdminCollections(query),
    };
  }

  @Post()
  @Permissions('collections:create')
  @ApiOperation({ summary: 'Create collection' })
  @ApiCreatedResponse({ description: 'Collection created successfully' })
  async create(
    @Body() dto: CreateCollectionDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return {
      message: 'Collection created successfully',
      data: await this.catalogService.createCollection(dto, admin.id),
    };
  }

  @Get(':id')
  @Permissions('collections:read')
  @ApiOperation({ summary: 'Get admin collection by id' })
  @ApiOkResponse({ description: 'Collection returned successfully' })
  async detail(@Param('id') id: string) {
    return {
      message: 'Collection returned successfully',
      data: await this.catalogService.getAdminCollectionById(id),
    };
  }

  @Patch(':id')
  @Permissions('collections:update')
  @ApiOperation({ summary: 'Update collection' })
  @ApiOkResponse({ description: 'Collection updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCollectionDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return {
      message: 'Collection updated successfully',
      data: await this.catalogService.updateCollection(id, dto, admin.id),
    };
  }

  @Delete(':id')
  @Permissions('collections:delete')
  @ApiOperation({ summary: 'Soft delete collection' })
  @ApiOkResponse({ description: 'Collection deleted successfully' })
  async delete(
    @Param('id') id: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return {
      message: 'Collection deleted successfully',
      data: await this.catalogService.deleteCollection(id, admin.id),
    };
  }

  @Post(':id/products')
  @Permissions('collections:update')
  @ApiOperation({ summary: 'Add product to collection' })
  @ApiOkResponse({ description: 'Product added to collection successfully' })
  async addProduct(
    @Param('id') id: string,
    @Body() dto: AddCollectionProductDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return {
      message: 'Product added to collection successfully',
      data: await this.catalogService.addProductToCollection(id, dto, admin.id),
    };
  }

  @Delete(':id/products/:productId')
  @Permissions('collections:update')
  @ApiOperation({ summary: 'Remove product from collection' })
  @ApiOkResponse({ description: 'Product removed from collection successfully' })
  async removeProduct(
    @Param('id') id: string,
    @Param('productId') productId: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return {
      message: 'Product removed from collection successfully',
      data: await this.catalogService.removeProductFromCollection(
        id,
        productId,
        admin.id,
      ),
    };
  }
}
