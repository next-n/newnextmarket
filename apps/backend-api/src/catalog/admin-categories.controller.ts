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
import { CategoryQueryDto } from './dto/category-query.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('Admin Categories')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, RolesGuard)
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  @Permissions('categories:read')
  @ApiOperation({ summary: 'List admin categories' })
  @ApiOkResponse({ description: 'Categories returned successfully' })
  async list(@Query() query: CategoryQueryDto) {
    return {
      message: 'Categories returned successfully',
      data: await this.catalogService.listAdminCategories(query),
    };
  }

  @Post()
  @Permissions('categories:create')
  @ApiOperation({ summary: 'Create category' })
  @ApiCreatedResponse({ description: 'Category created successfully' })
  async create(
    @Body() dto: CreateCategoryDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return {
      message: 'Category created successfully',
      data: await this.catalogService.createCategory(dto, admin.id),
    };
  }

  @Get(':id')
  @Permissions('categories:read')
  @ApiOperation({ summary: 'Get admin category by id' })
  @ApiOkResponse({ description: 'Category returned successfully' })
  async detail(@Param('id') id: string) {
    return {
      message: 'Category returned successfully',
      data: await this.catalogService.getAdminCategoryById(id),
    };
  }

  @Patch(':id')
  @Permissions('categories:update')
  @ApiOperation({ summary: 'Update category' })
  @ApiOkResponse({ description: 'Category updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return {
      message: 'Category updated successfully',
      data: await this.catalogService.updateCategory(id, dto, admin.id),
    };
  }

  @Delete(':id')
  @Permissions('categories:delete')
  @ApiOperation({ summary: 'Soft delete category' })
  @ApiOkResponse({ description: 'Category deleted successfully' })
  async delete(
    @Param('id') id: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return {
      message: 'Category deleted successfully',
      data: await this.catalogService.deleteCategory(id, admin.id),
    };
  }
}
