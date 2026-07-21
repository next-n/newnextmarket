import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  CategoryStatus,
  CollectionStatus,
  InventoryLogType,
  Prisma,
  ProductStatus,
  VariantStatus,
} from '@prisma/client';
import { Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AddCollectionProductDto } from './dto/add-collection-product.dto';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { CategoryQueryDto } from './dto/category-query.dto';
import { CollectionQueryDto } from './dto/collection-query.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { InventoryQueryDto } from './dto/inventory-query.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import { UpdateProductDto } from './dto/update-product.dto';

type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type PaginatedResponse<T> = {
  items: T[];
  meta: PaginationMeta;
};

type ProductWithRelations = any;
type CategoryWithRelations = any;
type CollectionWithRelations = any;
type VariantWithProduct = any;

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  async listPublicCategories(query: CategoryQueryDto) {
    const cacheKey = await this.publicCacheKey('categories:list', query);
    const cached = await this.redis?.get<PaginatedResponse<any>>(cacheKey);

    if (cached) {
      return cached;
    }

    const { skip, take, page, limit } = this.getPagination(query);
    const where: Prisma.CategoryWhereInput = {
      status: CategoryStatus.ACTIVE,
      deletedAt: null,
      ...(query.parentId ? { parentId: query.parentId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
        include: {
          parent: true,
          children: {
            where: { status: CategoryStatus.ACTIVE, deletedAt: null },
            orderBy: { name: 'asc' },
          },
          _count: { select: { products: true } },
        },
      }),
      this.prisma.category.count({ where }),
    ]);

    const response = this.paginate(
      items.map((category) => this.toCategoryResponse(category)),
      total,
      page,
      limit,
    );
    await this.redis?.set(cacheKey, response, 600);
    return response;
  }

  async getPublicCategoryBySlug(slug: string) {
    const cacheKey = await this.publicCacheKey('category', slug);
    const cached = await this.redis?.get<any>(cacheKey);

    if (cached) {
      return cached;
    }

    const category = await this.prisma.category.findFirst({
      where: {
        slug,
        status: CategoryStatus.ACTIVE,
        deletedAt: null,
      },
      include: {
        parent: true,
        children: {
          where: { status: CategoryStatus.ACTIVE, deletedAt: null },
          orderBy: { name: 'asc' },
        },
        _count: { select: { products: true } },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const response = this.toCategoryResponse(category);
    await this.redis?.set(cacheKey, response, 600);
    return response;
  }

  async listAdminCategories(query: CategoryQueryDto) {
    const { skip, take, page, limit } = this.getPagination(query);
    const where: Prisma.CategoryWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.parentId ? { parentId: query.parentId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          parent: true,
          children: true,
          _count: { select: { products: true } },
        },
      }),
      this.prisma.category.count({ where }),
    ]);

    return this.paginate(
      items.map((category) => this.toCategoryResponse(category)),
      total,
      page,
      limit,
    );
  }

  async createCategory(dto: CreateCategoryDto, adminId?: string) {
    if (dto.parentId) {
      await this.ensureCategoryExists(dto.parentId);
    }

    try {
      const category = await this.prisma.category.create({
        data: {
          name: dto.name.trim(),
          slug: dto.slug.trim(),
          description: dto.description?.trim(),
          parentId: dto.parentId,
          status: dto.status ?? CategoryStatus.ACTIVE,
        },
        include: {
          parent: true,
          children: true,
          _count: { select: { products: true } },
        },
      });

      await this.audit(adminId, AuditAction.CREATE, 'Category', category.id, {
        slug: category.slug,
      });
      await this.invalidatePublicCatalog();

      return this.toCategoryResponse(category);
    } catch (error) {
      this.handleUniqueError(error, 'Category slug already exists');
      throw error;
    }
  }

  async getAdminCategoryById(id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, deletedAt: null },
      include: {
        parent: true,
        children: true,
        _count: { select: { products: true } },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return this.toCategoryResponse(category);
  }

  async updateCategory(id: string, dto: UpdateCategoryDto, adminId?: string) {
    await this.ensureCategoryExists(id);

    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new BadRequestException('Category cannot be its own parent');
      }

      await this.ensureCategoryExists(dto.parentId);
    }

    try {
      const category = await this.prisma.category.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.slug !== undefined ? { slug: dto.slug.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description?.trim() }
            : {}),
          ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
        include: {
          parent: true,
          children: true,
          _count: { select: { products: true } },
        },
      });

      await this.audit(adminId, AuditAction.UPDATE, 'Category', category.id, {
        slug: category.slug,
      });
      await this.invalidatePublicCatalog();

      return this.toCategoryResponse(category);
    } catch (error) {
      this.handleUniqueError(error, 'Category slug already exists');
      throw error;
    }
  }

  async deleteCategory(id: string, adminId?: string) {
    await this.ensureCategoryExists(id);
    const category = await this.prisma.category.update({
      where: { id },
      data: {
        status: CategoryStatus.INACTIVE,
        deletedAt: new Date(),
      },
    });

    await this.audit(adminId, AuditAction.DELETE, 'Category', category.id, {
      slug: category.slug,
    });
    await this.invalidatePublicCatalog();

    return {};
  }

  async listPublicCollections(query: CollectionQueryDto) {
    const cacheKey = await this.publicCacheKey('collections:list', query);
    const cached = await this.redis?.get<PaginatedResponse<any>>(cacheKey);

    if (cached) {
      return cached;
    }

    const { skip, take, page, limit } = this.getPagination(query);
    const where: Prisma.CollectionWhereInput = {
      status: CollectionStatus.ACTIVE,
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.collection.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
        include: {
          products: {
            where: {
              product: { status: ProductStatus.ACTIVE, deletedAt: null },
            },
            include: {
              product: {
                include: {
                  category: true,
                  collections: { include: { collection: true } },
                  variants: {
                    where: {
                      status: VariantStatus.ACTIVE,
                      deletedAt: null,
                    },
                  },
                  uploads: { where: { deletedAt: null } },
                  _count: { select: { reviews: true } },
                },
              },
            },
            orderBy: { sortOrder: 'asc' },
          },
          _count: { select: { products: true } },
        },
      }),
      this.prisma.collection.count({ where }),
    ]);

    const response = this.paginate(
      items.map((collection) => this.toCollectionResponse(collection, true)),
      total,
      page,
      limit,
    );
    await this.redis?.set(cacheKey, response, 600);
    return response;
  }

  async getPublicCollectionBySlug(slug: string) {
    const cacheKey = await this.publicCacheKey('collection', slug);
    const cached = await this.redis?.get<any>(cacheKey);

    if (cached) {
      return cached;
    }

    const collection = await this.prisma.collection.findFirst({
      where: {
        slug,
        status: CollectionStatus.ACTIVE,
        deletedAt: null,
      },
      include: {
        products: {
          where: {
            product: { status: ProductStatus.ACTIVE, deletedAt: null },
          },
          include: {
            product: {
              include: {
                category: true,
                collections: { include: { collection: true } },
                variants: {
                  where: { status: VariantStatus.ACTIVE, deletedAt: null },
                },
                uploads: { where: { deletedAt: null } },
                _count: { select: { reviews: true } },
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        _count: { select: { products: true } },
      },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found');
    }

    const response = this.toCollectionResponse(collection, true);
    await this.redis?.set(cacheKey, response, 600);
    return response;
  }

  async listAdminCollections(query: CollectionQueryDto) {
    const { skip, take, page, limit } = this.getPagination(query);
    const where: Prisma.CollectionWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.collection.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          products: {
            include: {
              product: {
                include: {
                  category: true,
                  collections: { include: { collection: true } },
                  variants: true,
                  uploads: { where: { deletedAt: null } },
                  _count: { select: { reviews: true } },
                },
              },
            },
            orderBy: { sortOrder: 'asc' },
          },
          _count: { select: { products: true } },
        },
      }),
      this.prisma.collection.count({ where }),
    ]);

    return this.paginate(
      items.map((collection) => this.toCollectionResponse(collection, true)),
      total,
      page,
      limit,
    );
  }

  async createCollection(dto: CreateCollectionDto, adminId?: string) {
    try {
      const collection = await this.prisma.collection.create({
        data: {
          name: dto.name.trim(),
          slug: dto.slug.trim(),
          description: dto.description?.trim(),
          status: dto.status ?? CollectionStatus.ACTIVE,
          showOnHomepage: dto.showOnHomepage ?? false,
          homepagePriority: dto.homepagePriority ?? 0,
        },
        include: {
          products: {
            include: {
              product: {
                include: {
                  category: true,
                  collections: { include: { collection: true } },
                  variants: true,
                  uploads: { where: { deletedAt: null } },
                  _count: { select: { reviews: true } },
                },
              },
            },
          },
          _count: { select: { products: true } },
        },
      });

      await this.audit(
        adminId,
        AuditAction.CREATE,
        'Collection',
        collection.id,
        { slug: collection.slug },
      );
      await this.invalidatePublicCatalog();

      return this.toCollectionResponse(collection, true);
    } catch (error) {
      this.handleUniqueError(error, 'Collection slug already exists');
      throw error;
    }
  }

  async getAdminCollectionById(id: string) {
    const collection = await this.prisma.collection.findFirst({
      where: { id, deletedAt: null },
      include: {
        products: {
          include: {
            product: {
              include: {
                category: true,
                collections: { include: { collection: true } },
                variants: true,
                uploads: { where: { deletedAt: null } },
                _count: { select: { reviews: true } },
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        _count: { select: { products: true } },
      },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found');
    }

    return this.toCollectionResponse(collection, true);
  }

  async updateCollection(id: string, dto: UpdateCollectionDto, adminId?: string) {
    await this.ensureCollectionExists(id);

    try {
      const collection = await this.prisma.collection.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.slug !== undefined ? { slug: dto.slug.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description?.trim() }
            : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.showOnHomepage !== undefined
            ? { showOnHomepage: dto.showOnHomepage }
            : {}),
          ...(dto.homepagePriority !== undefined
            ? { homepagePriority: dto.homepagePriority }
            : {}),
        },
        include: {
          products: {
            include: {
              product: {
                include: {
                  category: true,
                  collections: { include: { collection: true } },
                  variants: true,
                  uploads: { where: { deletedAt: null } },
                  _count: { select: { reviews: true } },
                },
              },
            },
          },
          _count: { select: { products: true } },
        },
      });

      await this.audit(
        adminId,
        AuditAction.UPDATE,
        'Collection',
        collection.id,
        { slug: collection.slug },
      );
      await this.invalidatePublicCatalog();

      return this.toCollectionResponse(collection, true);
    } catch (error) {
      this.handleUniqueError(error, 'Collection slug already exists');
      throw error;
    }
  }

  async deleteCollection(id: string, adminId?: string) {
    await this.ensureCollectionExists(id);
    const collection = await this.prisma.collection.update({
      where: { id },
      data: {
        status: CollectionStatus.INACTIVE,
        deletedAt: new Date(),
      },
    });

    await this.audit(
      adminId,
      AuditAction.DELETE,
      'Collection',
      collection.id,
      { slug: collection.slug },
    );
    await this.invalidatePublicCatalog();

    return {};
  }

  async addProductToCollection(
    collectionId: string,
    dto: AddCollectionProductDto,
    adminId?: string,
  ) {
    await this.ensureCollectionExists(collectionId);
    await this.ensureProductExists(dto.productId);

    try {
      const collectionProduct = await this.prisma.collectionProduct.create({
        data: {
          collectionId,
          productId: dto.productId,
          sortOrder: dto.sortOrder ?? 0,
        },
        include: {
          collection: true,
          product: {
            include: {
              category: true,
              collections: { include: { collection: true } },
              variants: true,
              uploads: { where: { deletedAt: null } },
              _count: { select: { reviews: true } },
            },
          },
        },
      });

      await this.audit(
        adminId,
        AuditAction.UPDATE,
        'Collection',
        collectionId,
        { productId: dto.productId, action: 'add_product' },
      );
      await this.invalidatePublicCatalog();

      return {
        id: collectionProduct.id,
        collectionId: collectionProduct.collectionId,
        productId: collectionProduct.productId,
        sortOrder: collectionProduct.sortOrder,
        product: this.toProductResponse(collectionProduct.product),
      };
    } catch (error) {
      this.handleUniqueError(error, 'Product already exists in collection');
      throw error;
    }
  }

  async removeProductFromCollection(
    collectionId: string,
    productId: string,
    adminId?: string,
  ) {
    const existing = await this.prisma.collectionProduct.findUnique({
      where: { collectionId_productId: { collectionId, productId } },
    });

    if (!existing) {
      throw new NotFoundException('Product is not in this collection');
    }

    await this.prisma.collectionProduct.delete({
      where: { collectionId_productId: { collectionId, productId } },
    });

    await this.audit(adminId, AuditAction.UPDATE, 'Collection', collectionId, {
      productId,
      action: 'remove_product',
    });
    await this.invalidatePublicCatalog();

    return {};
  }

  async listPublicProducts(query: ProductQueryDto) {
    return this.listProducts(query, true);
  }

  async searchPublicProducts(q: string, query: ProductQueryDto) {
    return this.listProducts({ ...query, search: q }, true);
  }

  async getPublicProductBySlug(slug: string) {
    const cacheKey = await this.publicCacheKey('product', slug);
    const cached = await this.redis?.get<any>(cacheKey);

    if (cached) {
      return cached;
    }

    const product = await this.prisma.product.findFirst({
      where: {
        slug,
        status: ProductStatus.ACTIVE,
        deletedAt: null,
      },
      include: {
        category: true,
        collections: { include: { collection: true } },
        variants: {
          where: { status: VariantStatus.ACTIVE, deletedAt: null },
          orderBy: [{ color: 'asc' }, { size: 'asc' }],
        },
        uploads: { where: { deletedAt: null } },
        _count: { select: { reviews: true } },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const response = this.toProductResponse(product);
    await this.redis?.set(cacheKey, response, 300);
    return response;
  }

  async listAdminProducts(query: ProductQueryDto) {
    return this.listProducts(query, false);
  }

  async createProduct(dto: CreateProductDto, adminId?: string) {
    if (dto.categoryId) {
      await this.ensureCategoryExists(dto.categoryId);
    }

    try {
      const product = await this.prisma.product.create({
        data: {
          name: dto.name.trim(),
          slug: dto.slug.trim(),
          subtitle: dto.subtitle?.trim(),
          description: dto.description?.trim(),
          status: dto.status ?? ProductStatus.DRAFT,
          gender: dto.gender,
          categoryId: dto.categoryId,
          basePrice: dto.basePrice,
          isFeatured: dto.isFeatured ?? false,
          isNewArrival: dto.isNewArrival ?? false,
          tags: dto.tags ?? [],
          publishedAt:
            dto.status === ProductStatus.ACTIVE ? new Date() : undefined,
        },
        include: this.productInclude(false),
      });

      await this.audit(adminId, AuditAction.CREATE, 'Product', product.id, {
        slug: product.slug,
      });
      await this.invalidatePublicCatalog();

      return this.toProductResponse(product);
    } catch (error) {
      this.handleUniqueError(error, 'Product slug already exists');
      throw error;
    }
  }

  async getAdminProductById(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: this.productInclude(false),
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.toProductResponse(product);
  }

  async updateProduct(id: string, dto: UpdateProductDto, adminId?: string) {
    await this.ensureProductExists(id);

    if (dto.categoryId) {
      await this.ensureCategoryExists(dto.categoryId);
    }

    try {
      const product = await this.prisma.product.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.slug !== undefined ? { slug: dto.slug.trim() } : {}),
          ...(dto.subtitle !== undefined
            ? { subtitle: dto.subtitle?.trim() }
            : {}),
          ...(dto.description !== undefined
            ? { description: dto.description?.trim() }
            : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
          ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
          ...(dto.basePrice !== undefined ? { basePrice: dto.basePrice } : {}),
          ...(dto.isFeatured !== undefined
            ? { isFeatured: dto.isFeatured }
            : {}),
          ...(dto.isNewArrival !== undefined
            ? { isNewArrival: dto.isNewArrival }
            : {}),
          ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
          ...(dto.status === ProductStatus.ACTIVE ? { publishedAt: new Date() } : {}),
        },
        include: this.productInclude(false),
      });

      await this.audit(adminId, AuditAction.UPDATE, 'Product', product.id, {
        slug: product.slug,
      });
      await this.invalidatePublicCatalog();

      return this.toProductResponse(product);
    } catch (error) {
      this.handleUniqueError(error, 'Product slug already exists');
      throw error;
    }
  }

  async deleteProduct(id: string, adminId?: string) {
    await this.ensureProductExists(id);
    const product = await this.prisma.product.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: ProductStatus.ARCHIVED,
      },
    });

    await this.audit(adminId, AuditAction.DELETE, 'Product', product.id, {
      slug: product.slug,
    });
    await this.invalidatePublicCatalog();

    return {};
  }

  async listProductVariants(productId: string) {
    await this.ensureProductExists(productId);
    const variants = await this.prisma.productVariant.findMany({
      where: { productId, deletedAt: null },
      orderBy: [{ color: 'asc' }, { size: 'asc' }],
    });

    return variants.map((variant) => this.toVariantResponse(variant));
  }

  async createProductVariant(
    productId: string,
    dto: CreateProductVariantDto,
    adminId?: string,
  ) {
    await this.ensureProductExists(productId);

    try {
      const variant = await this.prisma.productVariant.create({
        data: {
          productId,
          sku: dto.sku?.trim() || this.generateVariantSku(productId),
          identifier: dto.identifier?.trim(),
          size: dto.size?.trim(),
          width: dto.width?.trim(),
          color: dto.color?.trim(),
          colorCode: dto.colorCode?.trim(),
          imageUrl: dto.imageUrl?.trim(),
          price: dto.price,
          salePrice: dto.salePrice,
          stock: dto.stock,
          lowStockThreshold: dto.lowStockThreshold,
          status: dto.status ?? VariantStatus.ACTIVE,
        },
      });

      if (dto.stock > 0) {
        await this.prisma.inventoryLog.create({
          data: {
            productVariantId: variant.id,
            adminId,
            type: InventoryLogType.STOCK_IN,
            quantity: dto.stock,
            stockBefore: 0,
            stockAfter: dto.stock,
            note: 'Initial variant stock.',
          },
        });
      }

      await this.updateProductStockStatus(productId);
      await this.audit(adminId, AuditAction.CREATE, 'ProductVariant', variant.id, {
        sku: variant.sku,
        productId,
      });
      await this.invalidatePublicCatalog();

      return this.toVariantResponse(variant);
    } catch (error) {
      this.handleUniqueError(error, 'Variant SKU already exists');
      throw error;
    }
  }

  async updateProductVariant(
    id: string,
    dto: UpdateProductVariantDto,
    adminId?: string,
  ) {
    const existing = await this.getVariantOrThrow(id);

    try {
      const variant = await this.prisma.productVariant.update({
        where: { id },
        data: {
          ...(dto.sku !== undefined ? { sku: dto.sku.trim() } : {}),
          ...(dto.identifier !== undefined
            ? { identifier: dto.identifier?.trim() }
            : {}),
          ...(dto.size !== undefined ? { size: dto.size.trim() } : {}),
          ...(dto.width !== undefined ? { width: dto.width.trim() } : {}),
          ...(dto.color !== undefined ? { color: dto.color.trim() } : {}),
          ...(dto.colorCode !== undefined
            ? { colorCode: dto.colorCode?.trim() }
            : {}),
          ...(dto.imageUrl !== undefined
            ? { imageUrl: dto.imageUrl?.trim() }
            : {}),
          ...(dto.price !== undefined ? { price: dto.price } : {}),
          ...(dto.salePrice !== undefined ? { salePrice: dto.salePrice } : {}),
          ...(dto.stock !== undefined ? { stock: dto.stock } : {}),
          ...(dto.lowStockThreshold !== undefined
            ? { lowStockThreshold: dto.lowStockThreshold }
            : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
      });

      if (dto.stock !== undefined && dto.stock !== existing.stock) {
        await this.prisma.inventoryLog.create({
          data: {
            productVariantId: id,
            adminId,
            type: InventoryLogType.ADJUSTMENT,
            quantity: dto.stock - existing.stock,
            stockBefore: existing.stock,
            stockAfter: dto.stock,
            note: 'Variant stock updated.',
          },
        });
      }

      await this.updateProductStockStatus(variant.productId);
      await this.audit(adminId, AuditAction.UPDATE, 'ProductVariant', variant.id, {
        sku: variant.sku,
      });
      await this.invalidatePublicCatalog();

      return this.toVariantResponse(variant);
    } catch (error) {
      this.handleUniqueError(error, 'Variant SKU already exists');
      throw error;
    }
  }

  async deleteProductVariant(id: string, adminId?: string) {
    const variant = await this.getVariantOrThrow(id);
    const updated = await this.prisma.productVariant.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: VariantStatus.DISCONTINUED,
      },
    });

    await this.updateProductStockStatus(variant.productId);
    await this.audit(adminId, AuditAction.DELETE, 'ProductVariant', updated.id, {
      sku: updated.sku,
    });
    await this.invalidatePublicCatalog();

    return {};
  }

  async listInventory(query: InventoryQueryDto) {
    const { skip, take, page, limit } = this.getPagination(query);
    const baseWhere: Prisma.ProductVariantWhereInput = {
      deletedAt: null,
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { sku: { contains: query.search, mode: 'insensitive' } },
              { color: { contains: query.search, mode: 'insensitive' } },
              {
                product: {
                  name: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };

    if (query.lowStock) {
      const variants = await this.prisma.productVariant.findMany({
        where: baseWhere,
        include: {
          product: {
            select: { id: true, name: true, slug: true, status: true },
          },
          inventoryLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
        },
        orderBy: { stock: 'asc' },
      });
      const lowStockItems = variants.filter((variant) =>
        this.isLowStock(variant.stock, variant.lowStockThreshold),
      );

      return this.paginate(
        lowStockItems
          .slice(skip, skip + take)
          .map((variant) => this.toInventoryResponse(variant)),
        lowStockItems.length,
        page,
        limit,
      );
    }

    const [items, total] = await Promise.all([
      this.prisma.productVariant.findMany({
        where: baseWhere,
        skip,
        take,
        orderBy: { stock: 'asc' },
        include: {
          product: {
            select: { id: true, name: true, slug: true, status: true },
          },
          inventoryLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
        },
      }),
      this.prisma.productVariant.count({ where: baseWhere }),
    ]);

    return this.paginate(
      items.map((variant) => this.toInventoryResponse(variant)),
      total,
      page,
      limit,
    );
  }

  async getInventoryByVariantId(variantId: string) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, deletedAt: null },
      include: {
        product: {
          select: { id: true, name: true, slug: true, status: true },
        },
        inventoryLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    return this.toInventoryResponse(variant);
  }

  async updateInventory(
    variantId: string,
    dto: UpdateInventoryDto,
    adminId?: string,
  ) {
    const variant = await this.getVariantOrThrow(variantId);
    const data: Prisma.ProductVariantUpdateInput = {
      ...(dto.stock !== undefined ? { stock: dto.stock } : {}),
      ...(dto.lowStockThreshold !== undefined
        ? { lowStockThreshold: dto.lowStockThreshold }
        : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
    };
    const updated = await this.prisma.productVariant.update({
      where: { id: variantId },
      data,
    });

    if (dto.stock !== undefined && dto.stock !== variant.stock) {
      await this.prisma.inventoryLog.create({
        data: {
          productVariantId: variantId,
          adminId,
          type: InventoryLogType.ADJUSTMENT,
          quantity: dto.stock - variant.stock,
          stockBefore: variant.stock,
          stockAfter: dto.stock,
          note: 'Inventory stock set.',
        },
      });
    }

    await this.updateProductStockStatus(updated.productId);
    await this.audit(adminId, AuditAction.UPDATE, 'Inventory', variantId, {
      stockBefore: variant.stock,
      stockAfter: updated.stock,
    });
    await this.invalidatePublicCatalog();

    return this.getInventoryByVariantId(variantId);
  }

  async adjustInventory(
    variantId: string,
    dto: AdjustInventoryDto,
    adminId?: string,
  ) {
    if (dto.quantity === 0) {
      throw new BadRequestException('Adjustment quantity cannot be zero');
    }

    const variant = await this.getVariantOrThrow(variantId);
    const newStock = variant.stock + dto.quantity;

    if (newStock < 0) {
      throw new BadRequestException('Variant stock cannot go below zero');
    }

    const type =
      dto.type ??
      (dto.quantity > 0
        ? InventoryLogType.STOCK_IN
        : InventoryLogType.STOCK_OUT);

    await this.prisma.$transaction([
      this.prisma.productVariant.update({
        where: { id: variantId },
        data: {
          stock: newStock,
          status:
            newStock === 0 && variant.status === VariantStatus.ACTIVE
              ? VariantStatus.OUT_OF_STOCK
              : newStock > 0 && variant.status === VariantStatus.OUT_OF_STOCK
                ? VariantStatus.ACTIVE
                : variant.status,
        },
      }),
      this.prisma.inventoryLog.create({
        data: {
          productVariantId: variantId,
          adminId,
          type,
          quantity: dto.quantity,
          stockBefore: variant.stock,
          stockAfter: newStock,
          note: dto.reason?.trim(),
        },
      }),
    ]);

    await this.updateProductStockStatus(variant.productId);
    await this.audit(adminId, AuditAction.UPDATE, 'Inventory', variantId, {
      quantity: dto.quantity,
      previousStock: variant.stock,
      newStock,
      reason: dto.reason,
    });
    await this.invalidatePublicCatalog();

    return this.getInventoryByVariantId(variantId);
  }

  private async listProducts(query: ProductQueryDto, publicOnly: boolean) {
    const cacheKey = publicOnly
      ? await this.publicCacheKey('products:list', query)
      : undefined;
    const cached = cacheKey
      ? await this.redis?.get<PaginatedResponse<any>>(cacheKey)
      : null;

    if (cached) {
      return cached;
    }

    const { skip, take, page, limit } = this.getPagination(query);
    const where = await this.buildProductWhere(query, publicOnly);
    const orderBy = this.buildProductOrder(query);

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take,
        orderBy,
        include: this.productInclude(publicOnly),
      }),
      this.prisma.product.count({ where }),
    ]);

    const response = this.paginate(
      items.map((product) => this.toProductResponse(product)),
      total,
      page,
      limit,
    );
    if (cacheKey) {
      await this.redis?.set(cacheKey, response, 300);
    }
    return response;
  }

  private async publicCacheKey(resource: string, value: unknown): Promise<string> {
    const version = (await this.redis?.getVersion('catalog')) ?? 1;
    return `catalog:public:${version}:${resource}:${this.stableSerialize(value)}`;
  }

  private stableSerialize(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableSerialize(item)).join(',')}]`;
    }
    if (value && typeof value === 'object') {
      return `{${Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => `${JSON.stringify(key)}:${this.stableSerialize(item)}`)
        .join(',')}}`;
    }
    return JSON.stringify(value) ?? 'null';
  }

  private async invalidatePublicCatalog(): Promise<void> {
    await Promise.all([
      this.redis?.invalidate('catalog'),
      this.redis?.invalidate('homepage'),
    ]);
  }

  private async buildProductWhere(
    query: ProductQueryDto,
    publicOnly: boolean,
  ): Promise<Prisma.ProductWhereInput> {
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(publicOnly
        ? { status: ProductStatus.ACTIVE }
        : query.status
          ? { status: query.status }
          : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
              { tags: { has: query.search } },
              {
                category: {
                  OR: [
                    { name: { contains: query.search, mode: 'insensitive' } },
                    { slug: { contains: query.search, mode: 'insensitive' } },
                  ],
                },
              },
              {
                collections: {
                  some: {
                    collection: {
                      OR: [
                        {
                          name: {
                            contains: query.search,
                            mode: 'insensitive',
                          },
                        },
                        {
                          slug: {
                            contains: query.search,
                            mode: 'insensitive',
                          },
                        },
                      ],
                    },
                  },
                },
              },
            ],
          }
        : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.categorySlug ? { category: { slug: query.categorySlug } } : {}),
      ...(query.gender ? { gender: query.gender } : {}),
      ...(query.isFeatured !== undefined
        ? { isFeatured: query.isFeatured }
        : {}),
      ...(query.isNewArrival !== undefined
        ? { isNewArrival: query.isNewArrival }
        : {}),
      ...(query.collectionId || query.collectionSlug
        ? {
            collections: {
              some: {
                ...(query.collectionId
                  ? { collectionId: query.collectionId }
                  : {}),
                ...(query.collectionSlug
                  ? { collection: { slug: query.collectionSlug } }
                  : {}),
              },
            },
          }
        : {}),
    };

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.variants = {
        some: {
          deletedAt: null,
          ...(publicOnly ? { status: VariantStatus.ACTIVE } : {}),
          price: {
            ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
            ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
          },
        },
      };
    }

    return where;
  }

  private buildProductOrder(query: ProductQueryDto): Prisma.ProductOrderByWithRelationInput[] {
    const sortOrder = query.sortOrder ?? 'desc';

    if (query.sortBy === 'name') {
      return [{ name: sortOrder }];
    }

    if (query.sortBy === 'updatedAt') {
      return [{ updatedAt: sortOrder }];
    }

    if (query.sortBy === 'price') {
      return [{ basePrice: sortOrder }, { createdAt: 'desc' }];
    }

    return [{ createdAt: sortOrder }];
  }

  private productInclude(publicOnly: boolean): Prisma.ProductInclude {
    return {
      category: true,
      collections: {
        include: {
          collection: true,
        },
      },
      variants: {
        where: {
          deletedAt: null,
          ...(publicOnly ? { status: VariantStatus.ACTIVE } : {}),
        },
        orderBy: [{ color: 'asc' }, { size: 'asc' }],
      },
      uploads: {
        where: { deletedAt: null },
      },
      _count: {
        select: { reviews: true },
      },
    };
  }

  private getPagination(query: { page?: number; limit?: number }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    return {
      page,
      limit,
      skip: (page - 1) * limit,
      take: limit,
    };
  }

  private paginate<T>(
    items: T[],
    total: number,
    page: number,
    limit: number,
  ): PaginatedResponse<T> {
    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private toCategoryResponse(category: CategoryWithRelations) {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      status: category.status,
      parentId: category.parentId,
      parent: category.parent
        ? {
            id: category.parent.id,
            name: category.parent.name,
            slug: category.parent.slug,
          }
        : null,
      children: category.children.map((child: any) => ({
        id: child.id,
        name: child.name,
        slug: child.slug,
        status: child.status,
      })),
      productCount: category._count.products,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  private toCollectionResponse(
    collection: CollectionWithRelations,
    includeProducts: boolean,
  ) {
    return {
      id: collection.id,
      name: collection.name,
      slug: collection.slug,
      description: collection.description,
      status: collection.status,
      showOnHomepage: collection.showOnHomepage,
      homepagePriority: collection.homepagePriority,
      productCount: collection._count.products,
      products: includeProducts
        ? collection.products.map((item: any) => ({
            sortOrder: item.sortOrder,
            product: this.toProductResponse(item.product),
          }))
        : undefined,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
    };
  }

  private toProductResponse(product: ProductWithRelations) {
    const variants = product.variants.map((variant: any) =>
      this.toVariantResponse(variant),
    );

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      subtitle: product.subtitle,
      description: product.description,
      status: product.status,
      gender: product.gender,
      categoryId: product.categoryId,
      category: product.category
        ? {
            id: product.category.id,
            name: product.category.name,
            slug: product.category.slug,
          }
        : null,
      basePrice: product.basePrice,
      isFeatured: product.isFeatured,
      isNewArrival: product.isNewArrival,
      tags: product.tags,
      collections: product.collections.map((item: any) => ({
        id: item.collection.id,
        name: item.collection.name,
        slug: item.collection.slug,
      })),
      variants,
      images: product.uploads.map((upload: any) => ({
        id: upload.id,
        url: upload.url,
        altText: upload.altText,
        type: upload.type,
      })),
      priceRange: this.getPriceRange(product.variants),
      stockSummary: this.getStockSummary(product.variants),
      reviewCount: product._count.reviews,
      publishedAt: product.publishedAt,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  private toVariantResponse(
    variant: any,
  ) {
    return {
      id: variant.id,
      productId: variant.productId,
      sku: variant.sku,
      identifier: variant.identifier,
      size: variant.size,
      width: variant.width,
      color: variant.color,
      colorCode: variant.colorCode,
      imageUrl: variant.imageUrl,
      price: variant.price,
      salePrice: variant.salePrice,
      stock: variant.stock,
      lowStockThreshold: variant.lowStockThreshold,
      status: variant.status,
      createdAt: variant.createdAt,
      updatedAt: variant.updatedAt,
    };
  }

  private toInventoryResponse(variant: VariantWithProduct) {
    return {
      variant: this.toVariantResponse(variant),
      product: variant.product,
      isLowStock: this.isLowStock(variant.stock, variant.lowStockThreshold),
      logs: variant.inventoryLogs.map((log: any) => ({
        id: log.id,
        variantId: log.productVariantId,
        type: log.type,
        quantity: log.quantity,
        previousStock: log.stockBefore,
        newStock: log.stockAfter,
        reason: log.note,
        adminId: log.adminId,
        createdAt: log.createdAt,
      })),
    };
  }

  private getPriceRange(
    variants: any[],
  ) {
    if (!variants.length) {
      return {
        minPrice: null,
        maxPrice: null,
        minSalePrice: null,
        maxSalePrice: null,
      };
    }

    const prices = variants.map((variant) => Number(variant.price));
    const salePrices = variants
      .map((variant) =>
        variant.salePrice === null ? null : Number(variant.salePrice),
      )
      .filter((price): price is number => price !== null);

    return {
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      minSalePrice: salePrices.length ? Math.min(...salePrices) : null,
      maxSalePrice: salePrices.length ? Math.max(...salePrices) : null,
    };
  }

  private getStockSummary(
    variants: any[],
  ) {
    const totalStock = variants.reduce((sum, variant) => sum + variant.stock, 0);

    return {
      totalStock,
      inStock: totalStock > 0,
      variantCount: variants.length,
      lowStockVariantCount: variants.filter((variant) =>
        this.isLowStock(variant.stock, variant.lowStockThreshold),
      ).length,
    };
  }

  private isLowStock(stock: number, threshold: number | null): boolean {
    return stock > 0 && stock <= (threshold ?? 5);
  }

  private async ensureCategoryExists(id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }
  }

  private async ensureCollectionExists(id: string) {
    const collection = await this.prisma.collection.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found');
    }
  }

  private async ensureProductExists(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }
  }

  private generateVariantSku(productId: string) {
    return `variant-${productId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private async getVariantOrThrow(id: string) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id, deletedAt: null },
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    return variant;
  }

  private async updateProductStockStatus(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { status: true },
    });

    if (
      !product ||
      product.status === ProductStatus.DRAFT ||
      product.status === ProductStatus.ARCHIVED
    ) {
      return;
    }

    const stock = await this.prisma.productVariant.aggregate({
      where: {
        productId,
        deletedAt: null,
        status: { not: VariantStatus.DISCONTINUED },
      },
      _sum: { stock: true },
    });
    const totalStock = stock._sum.stock ?? 0;

    if (totalStock === 0 && product.status === ProductStatus.ACTIVE) {
      await this.prisma.product.update({
        where: { id: productId },
        data: { status: ProductStatus.OUT_OF_STOCK },
      });
    }

    if (totalStock > 0 && product.status === ProductStatus.OUT_OF_STOCK) {
      await this.prisma.product.update({
        where: { id: productId },
        data: { status: ProductStatus.ACTIVE },
      });
    }
  }

  private async audit(
    adminId: string | undefined,
    action: AuditAction,
    entity: string,
    entityId: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    // Lightweight audit helper for catalog writes; a dedicated audit service can replace this later.
    if (!adminId) {
      return;
    }

    await this.prisma.auditLog.create({
      data: {
        adminId,
        action,
        entity,
        entityId,
        metadata,
      },
    });
  }

  private handleUniqueError(error: unknown, message: string): never | void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }
  }
}
