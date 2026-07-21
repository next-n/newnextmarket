import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { CategoryQueryDto } from './dto/category-query.dto';

@ApiTags('Categories')
@Controller('categories')
export class PublicCategoriesController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  @ApiOperation({ summary: 'List active public categories' })
  @ApiOkResponse({ description: 'Categories returned successfully' })
  async list(@Query() query: CategoryQueryDto) {
    return {
      message: 'Categories returned successfully',
      data: await this.catalogService.listPublicCategories(query),
    };
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get public category by slug' })
  @ApiOkResponse({ description: 'Category returned successfully' })
  async detail(@Param('slug') slug: string) {
    return {
      message: 'Category returned successfully',
      data: await this.catalogService.getPublicCategoryBySlug(slug),
    };
  }
}
