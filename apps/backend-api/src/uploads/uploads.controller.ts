import { Body, Controller, Delete, Get, Param, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UploadType } from '@prisma/client';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { AdminJwtGuard } from '../common/guards/admin-jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedAdmin } from '../common/types/auth.types';
import { UploadsService } from './uploads.service';

@ApiTags('Admin Uploads')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, RolesGuard)
@Controller('admin/uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  @Permissions('uploads:create')
  @ApiOperation({ summary: 'Upload general image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiCreatedResponse({ description: 'Image uploaded successfully' })
  async image(@UploadedFile() file: any, @CurrentAdmin() admin: AuthenticatedAdmin) {
    return { message: 'Image uploaded successfully', data: await this.uploadsService.uploadImage(file, UploadType.GENERAL_FILE, admin.id) };
  }

  @Post('product-image')
  @UseInterceptors(FileInterceptor('file'))
  @Permissions('uploads:create')
  @ApiOperation({ summary: 'Upload product image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  async productImage(@UploadedFile() file: any, @Body() body: { productId?: string }, @CurrentAdmin() admin: AuthenticatedAdmin) {
    const productId = body?.productId;
    return { message: 'Product image uploaded successfully', data: await this.uploadsService.uploadImage(file, UploadType.PRODUCT_IMAGE, admin.id, { productId }) };
  }

  @Post('banner-image')
  @UseInterceptors(FileInterceptor('file'))
  @Permissions('uploads:create')
  @ApiOperation({ summary: 'Upload banner image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  async bannerImage(@UploadedFile() file: any, @CurrentAdmin() admin: AuthenticatedAdmin) {
    return { message: 'Banner image uploaded successfully', data: await this.uploadsService.uploadImage(file, UploadType.BANNER_IMAGE, admin.id) };
  }

  @Get()
  @ApiOperation({ summary: 'List uploads' })
  @Permissions('uploads:read')
  @ApiOkResponse({ description: 'Uploads returned successfully' })
  async list() {
    return { message: 'Uploads returned successfully', data: await this.uploadsService.list() };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete upload' })
  @Permissions('uploads:delete')
  async delete(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin) {
    return { message: 'Upload deleted successfully', data: await this.uploadsService.delete(id, admin.id) };
  }
}
