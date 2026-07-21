import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BannersService } from './banners.service';

@ApiTags('Banners')
@Controller()
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Get('banners')
  @ApiOperation({ summary: 'List active banners' })
  @ApiOkResponse({ description: 'Banners returned successfully' })
  async banners() {
    return { message: 'Banners returned successfully', data: await this.bannersService.publicBanners() };
  }

  @Get('homepage')
  @ApiOperation({ summary: 'Get homepage content' })
  @ApiOkResponse({ description: 'Homepage returned successfully' })
  async homepage() {
    return { message: 'Homepage returned successfully', data: await this.bannersService.homepage() };
  }
}
