import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { ProductQueryDto } from './dto/product-query.dto';

@ApiTags('Products')
@Controller('products')
export class PublicProductsController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  @ApiOperation({ summary: 'List active public products' })
  @ApiOkResponse({ description: 'Products returned successfully' })
  async list(@Query() query: ProductQueryDto) {
    return {
      message: 'Products returned successfully',
      data: await this.catalogService.listPublicProducts(query),
    };
  }

  @Get('search')
  @ApiOperation({ summary: 'Search active public products' })
  @ApiQuery({ name: 'q', required: true, example: 'running' })
  @ApiOkResponse({ description: 'Product search returned successfully' })
  async search(@Query('q') q: string, @Query() query: ProductQueryDto) {
    return {
      message: 'Product search returned successfully',
      data: await this.catalogService.searchPublicProducts(q, query),
    };
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get public product by slug' })
  @ApiOkResponse({ description: 'Product returned successfully' })
  async detail(@Param('slug') slug: string) {
    return {
      message: 'Product returned successfully',
      data: await this.catalogService.getPublicProductBySlug(slug),
    };
  }
}
