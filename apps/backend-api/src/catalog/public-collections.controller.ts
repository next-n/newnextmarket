import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { CollectionQueryDto } from './dto/collection-query.dto';

@ApiTags('Collections')
@Controller('collections')
export class PublicCollectionsController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  @ApiOperation({ summary: 'List active public collections' })
  @ApiOkResponse({ description: 'Collections returned successfully' })
  async list(@Query() query: CollectionQueryDto) {
    return {
      message: 'Collections returned successfully',
      data: await this.catalogService.listPublicCollections(query),
    };
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get public collection by slug' })
  @ApiOkResponse({ description: 'Collection returned successfully' })
  async detail(@Param('slug') slug: string) {
    return {
      message: 'Collection returned successfully',
      data: await this.catalogService.getPublicCollectionBySlug(slug),
    };
  }
}
