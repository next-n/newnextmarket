import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminJwtGuard } from '../common/guards/admin-jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminCategoriesController } from './admin-categories.controller';
import { AdminCollectionsController } from './admin-collections.controller';
import { AdminInventoryController } from './admin-inventory.controller';
import { AdminProductsController } from './admin-products.controller';
import { AdminVariantsController } from './admin-variants.controller';
import { CatalogService } from './catalog.service';
import { PublicCategoriesController } from './public-categories.controller';
import { PublicCollectionsController } from './public-collections.controller';
import { PublicProductsController } from './public-products.controller';

@Module({
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [
    PublicCategoriesController,
    PublicCollectionsController,
    PublicProductsController,
    AdminCategoriesController,
    AdminCollectionsController,
    AdminProductsController,
    AdminVariantsController,
    AdminInventoryController,
  ],
  providers: [CatalogService, AdminJwtGuard, RolesGuard],
  exports: [CatalogService],
})
export class CatalogModule {}
