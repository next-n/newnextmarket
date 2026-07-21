import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { AdminJwtGuard } from '../common/guards/admin-jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ApiResponseInterceptor } from '../common/interceptors/api-response.interceptor';
import { AdminCategoriesController } from './admin-categories.controller';
import { AdminCollectionsController } from './admin-collections.controller';
import { AdminInventoryController } from './admin-inventory.controller';
import { AdminProductsController } from './admin-products.controller';
import { AdminVariantsController } from './admin-variants.controller';
import { CatalogService } from './catalog.service';
import { PublicCategoriesController } from './public-categories.controller';
import { PublicCollectionsController } from './public-collections.controller';
import { PublicProductsController } from './public-products.controller';

const product = {
  id: 'product_1',
  name: 'Fresh Foam X 1080',
  slug: 'fresh-foam-x-1080',
  status: 'ACTIVE',
  variants: [],
  priceRange: { minPrice: 164.99, maxPrice: 164.99 },
  stockSummary: { totalStock: 10, inStock: true },
};

const paginatedProducts = {
  items: [product],
  meta: {
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1,
  },
};

describe('Catalog controllers', () => {
  let app: INestApplication;
  const catalogService = {
    listPublicProducts: jest.fn(),
    getPublicProductBySlug: jest.fn(),
    createProduct: jest.fn(),
    updateProduct: jest.fn(),
    createProductVariant: jest.fn(),
    adjustInventory: jest.fn(),
    createCategory: jest.fn(),
    updateCategory: jest.fn(),
    addProductToCollection: jest.fn(),
    removeProductFromCollection: jest.fn(),
    listPublicCategories: jest.fn(),
    getPublicCategoryBySlug: jest.fn(),
    listPublicCollections: jest.fn(),
    getPublicCollectionBySlug: jest.fn(),
    listAdminCategories: jest.fn(),
    getAdminCategoryById: jest.fn(),
    deleteCategory: jest.fn(),
    listAdminCollections: jest.fn(),
    createCollection: jest.fn(),
    getAdminCollectionById: jest.fn(),
    updateCollection: jest.fn(),
    deleteCollection: jest.fn(),
    listAdminProducts: jest.fn(),
    getAdminProductById: jest.fn(),
    deleteProduct: jest.fn(),
    listProductVariants: jest.fn(),
    updateProductVariant: jest.fn(),
    deleteProductVariant: jest.fn(),
    listInventory: jest.fn(),
    getInventoryByVariantId: jest.fn(),
    updateInventory: jest.fn(),
    searchPublicProducts: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
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
      providers: [
        {
          provide: CatalogService,
          useValue: catalogService,
        },
      ],
    })
      .overrideGuard(AdminJwtGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => {
            getRequest: () => {
              admin?: {
                id: string;
                email: string;
                type: 'admin';
                roles: string[];
                permissions: string[];
              };
            };
          };
        }) => {
          const req = context.switchToHttp().getRequest();
          req.admin = {
            id: 'admin_1',
            email: 'admin@example.com',
            type: 'admin',
            roles: ['super_admin'],
            permissions: [
              'products:read',
              'products:create',
              'products:update',
              'products:delete',
              'categories:read',
              'categories:create',
              'categories:update',
              'categories:delete',
              'collections:read',
              'collections:create',
              'collections:update',
              'collections:delete',
              'inventory:read',
              'inventory:update',
            ],
          };

          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists public products', async () => {
    catalogService.listPublicProducts.mockResolvedValue(paginatedProducts);

    const response = await request(app.getHttpServer())
      .get('/api/products?page=1&limit=20&search=running')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.items[0].slug).toBe('fresh-foam-x-1080');
    expect(response.body.data.meta.total).toBe(1);
  });

  it('returns public product detail by slug', async () => {
    catalogService.getPublicProductBySlug.mockResolvedValue(product);

    const response = await request(app.getHttpServer())
      .get('/api/products/fresh-foam-x-1080')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.slug).toBe('fresh-foam-x-1080');
    expect(catalogService.getPublicProductBySlug).toHaveBeenCalledWith(
      'fresh-foam-x-1080',
    );
  });

  it('searches public products with q query', async () => {
    catalogService.searchPublicProducts.mockResolvedValue(paginatedProducts);

    const response = await request(app.getHttpServer())
      .get('/api/products/search?q=running')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.items[0].slug).toBe('fresh-foam-x-1080');
    expect(catalogService.searchPublicProducts).toHaveBeenCalledWith(
      'running',
      expect.objectContaining({ q: 'running' }),
    );
  });

  it('creates an admin product', async () => {
    catalogService.createProduct.mockResolvedValue(product);

    const response = await request(app.getHttpServer())
      .post('/api/admin/products')
      .set('Authorization', 'Bearer admin-token')
      .send({
        name: 'Fresh Foam X 1080',
        slug: 'fresh-foam-x-1080',
        status: 'ACTIVE',
        gender: 'UNISEX',
        basePrice: 164.99,
        tags: ['running'],
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe('product_1');
    expect(catalogService.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'fresh-foam-x-1080' }),
      'admin_1',
    );
  });

  it('updates an admin product', async () => {
    catalogService.updateProduct.mockResolvedValue({
      ...product,
      name: 'Fresh Foam X 1080 Updated',
    });

    const response = await request(app.getHttpServer())
      .patch('/api/admin/products/product_1')
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'Fresh Foam X 1080 Updated' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe('Fresh Foam X 1080 Updated');
    expect(catalogService.updateProduct).toHaveBeenCalledWith(
      'product_1',
      { name: 'Fresh Foam X 1080 Updated' },
      'admin_1',
    );
  });

  it('creates a product variant', async () => {
    catalogService.createProductVariant.mockResolvedValue({
      id: 'variant_1',
      productId: 'product_1',
      sku: 'NB-FFX1080-BLK-090-D',
      stock: 10,
    });

    const response = await request(app.getHttpServer())
      .post('/api/admin/products/product_1/variants')
      .set('Authorization', 'Bearer admin-token')
      .send({
        sku: 'NB-FFX1080-BLK-090-D',
        size: '9',
        width: 'D',
        color: 'Black/White',
        price: 164.99,
        stock: 10,
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.sku).toBe('NB-FFX1080-BLK-090-D');
    expect(catalogService.createProductVariant).toHaveBeenCalledWith(
      'product_1',
      expect.objectContaining({ sku: 'NB-FFX1080-BLK-090-D' }),
      'admin_1',
    );
  });

  it('adjusts inventory', async () => {
    catalogService.adjustInventory.mockResolvedValue({
      variant: { id: 'variant_1', stock: 8 },
      logs: [{ previousStock: 10, newStock: 8, quantity: -2 }],
    });

    const response = await request(app.getHttpServer())
      .post('/api/admin/inventory/variant_1/adjust')
      .set('Authorization', 'Bearer admin-token')
      .send({ quantity: -2, reason: 'Manual correction' })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.variant.stock).toBe(8);
    expect(catalogService.adjustInventory).toHaveBeenCalledWith(
      'variant_1',
      { quantity: -2, reason: 'Manual correction' },
      'admin_1',
    );
  });

  it('creates and updates categories', async () => {
    catalogService.createCategory.mockResolvedValue({
      id: 'category_1',
      name: 'Running',
      slug: 'running',
    });
    catalogService.updateCategory.mockResolvedValue({
      id: 'category_1',
      name: 'Performance Running',
      slug: 'running',
    });

    const createResponse = await request(app.getHttpServer())
      .post('/api/admin/categories')
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'Running', slug: 'running' })
      .expect(201);

    const updateResponse = await request(app.getHttpServer())
      .patch('/api/admin/categories/category_1')
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'Performance Running' })
      .expect(200);

    expect(createResponse.body.data.slug).toBe('running');
    expect(updateResponse.body.data.name).toBe('Performance Running');
    expect(catalogService.createCategory).toHaveBeenCalled();
    expect(catalogService.updateCategory).toHaveBeenCalledWith(
      'category_1',
      { name: 'Performance Running' },
      'admin_1',
    );
  });

  it('adds and removes a collection product', async () => {
    catalogService.addProductToCollection.mockResolvedValue({
      id: 'collection_product_1',
      collectionId: 'collection_1',
      productId: 'product_1',
      sortOrder: 0,
    });
    catalogService.removeProductFromCollection.mockResolvedValue({});

    const addResponse = await request(app.getHttpServer())
      .post('/api/admin/collections/collection_1/products')
      .set('Authorization', 'Bearer admin-token')
      .send({ productId: 'product_1', sortOrder: 0 })
      .expect(201);

    const removeResponse = await request(app.getHttpServer())
      .delete('/api/admin/collections/collection_1/products/product_1')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(addResponse.body.data.productId).toBe('product_1');
    expect(removeResponse.body.data).toEqual({});
    expect(catalogService.addProductToCollection).toHaveBeenCalledWith(
      'collection_1',
      { productId: 'product_1', sortOrder: 0 },
      'admin_1',
    );
    expect(catalogService.removeProductFromCollection).toHaveBeenCalledWith(
      'collection_1',
      'product_1',
      'admin_1',
    );
  });
});
