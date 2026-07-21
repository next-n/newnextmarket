import { ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { AuditAction, BannerStatus, CollectionStatus, ProductStatus } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { BannerQueryDto } from './dto/banner-query.dto';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';

@Injectable()
export class BannersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  async publicBanners() {
    const version = (await this.redis?.getVersion('banners')) ?? 1;
    const cacheKey = `banners:public:${version}`;
    const cached = await this.redis?.get<any[]>(cacheKey);

    if (cached) {
      return cached;
    }

    const now = new Date();
    const banners = await this.prisma.banner.findMany({
      where: {
        status: BannerStatus.ACTIVE,
        deletedAt: null,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
      include: { collection: true },
    });
    const response = banners.map((banner) => this.toBannerResponse(banner));
    await this.redis?.set(cacheKey, response, 120);
    return response;
  }

  async homepage() {
    const version = (await this.redis?.getVersion('homepage')) ?? 1;
    const cacheKey = `homepage:public:v2:${version}`;
    if (this.redis) {
      return this.redis.remember(cacheKey, 120, () => this.buildHomepage());
    }

    return this.buildHomepage();
  }

  private async buildHomepage() {
    const [banners, collections] = await Promise.all([
      this.publicBanners(),
      this.prisma.collection.findMany({
        where: {
          status: CollectionStatus.ACTIVE,
          deletedAt: null,
          showOnHomepage: true,
        },
        take: 8,
        orderBy: [{ homepagePriority: 'asc' }, { createdAt: 'asc' }],
        include: {
          products: {
            where: { product: { status: ProductStatus.ACTIVE, deletedAt: null } },
            take: 8,
            orderBy: { sortOrder: 'asc' },
            include: {
              product: {
                include: {
                  variants: { where: { status: 'ACTIVE', deletedAt: null } },
                  uploads: { where: { deletedAt: null } },
                },
              },
            },
          },
        },
      }),
    ]);
    const response = {
      banners,
      collections: collections.map((collection) => ({
        id: collection.id,
        name: collection.name,
        slug: collection.slug,
        description: collection.description,
        homepagePriority: collection.homepagePriority,
        products: (collection.products ?? []).map((item) => this.toProductSummary(item.product)),
      })),
    };
    return response;
  }

  async list(query: BannerQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: any = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { title: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.banner.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
        include: { collection: true },
      }),
      this.prisma.banner.count({ where }),
    ]);
    return { items: items.map((banner) => this.toBannerResponse(banner)), meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
  }

  async create(dto: CreateBannerDto, adminId?: string) {
    try {
      if (dto.collectionId) await this.ensureCollectionExists(dto.collectionId);
      const banner = await this.prisma.banner.create({ data: this.toBannerData(dto) as any, include: { collection: true } });
      await this.auditLogs.log({ adminId, action: AuditAction.CREATE, entityType: 'Banner', entityId: banner.id });
      await this.invalidatePublicContent();
      return this.toBannerResponse(banner);
    } catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException('Banner slug already exists');
      throw error;
    }
  }

  async get(id: string) {
    const banner = await this.prisma.banner.findFirst({ where: { id, deletedAt: null }, include: { collection: true } });
    if (!banner) throw new NotFoundException('Banner not found');
    return this.toBannerResponse(banner);
  }

  async update(id: string, dto: UpdateBannerDto, adminId?: string) {
    await this.get(id);
    if (dto.collectionId) await this.ensureCollectionExists(dto.collectionId);
    const banner = await this.prisma.banner.update({ where: { id }, data: this.toBannerData(dto), include: { collection: true } });
    await this.auditLogs.log({ adminId, action: AuditAction.UPDATE, entityType: 'Banner', entityId: banner.id });
    await this.invalidatePublicContent();
    return this.toBannerResponse(banner);
  }

  async delete(id: string, adminId?: string) {
    await this.get(id);
    const banner = await this.prisma.banner.update({
      where: { id },
      data: { status: BannerStatus.INACTIVE, deletedAt: new Date() },
    });
    await this.auditLogs.log({ adminId, action: AuditAction.DELETE, entityType: 'Banner', entityId: banner.id });
    await this.invalidatePublicContent();
    return this.toBannerResponse(banner);
  }

  private async invalidatePublicContent(): Promise<void> {
    await Promise.all([
      this.redis?.invalidate('banners'),
      this.redis?.invalidate('homepage'),
    ]);
  }

  private toBannerData(dto: Partial<CreateBannerDto>) {
    const slugBase = dto.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return {
      ...(dto.title !== undefined ? { title: dto.title.trim(), slug: `${slugBase}-${Date.now()}` } : {}),
      ...(dto.subtitle !== undefined ? { subtitle: dto.subtitle } : {}),
      ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
      ...(dto.buttonText !== undefined ? { buttonText: dto.buttonText } : {}),
      ...(dto.buttonLink !== undefined ? { linkUrl: dto.buttonLink } : {}),
      ...(dto.collectionId !== undefined ? { collectionId: dto.collectionId || null } : {}),
      ...(dto.sortOrder !== undefined ? { position: dto.sortOrder } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.startsAt !== undefined ? { startsAt: new Date(dto.startsAt) } : {}),
      ...(dto.endsAt !== undefined ? { endsAt: new Date(dto.endsAt) } : {}),
    };
  }

  private toBannerResponse(banner: any) {
    return {
      id: banner.id,
      title: banner.title,
      slug: banner.slug,
      subtitle: banner.subtitle,
      imageUrl: banner.imageUrl,
      buttonText: banner.buttonText,
      buttonLink: banner.linkUrl,
      collectionId: banner.collectionId,
      collection: banner.collection ? { id: banner.collection.id, name: banner.collection.name, slug: banner.collection.slug } : null,
      sortOrder: banner.position,
      status: banner.status,
      startsAt: banner.startsAt,
      endsAt: banner.endsAt,
      createdAt: banner.createdAt,
      updatedAt: banner.updatedAt,
    };
  }

  private async ensureCollectionExists(id: string) {
    const collection = await this.prisma.collection.findFirst({ where: { id, deletedAt: null } });
    if (!collection) throw new NotFoundException('Collection not found');
  }

  private toProductSummary(product: any) {
    const prices = (product.variants ?? []).map((variant: any) => Number(variant.salePrice ?? variant.price));
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      basePrice: product.basePrice === null ? null : Number(product.basePrice),
      minPrice: prices.length ? Math.min(...prices) : null,
      imageUrl: product.uploads?.[0]?.url ?? product.variants?.[0]?.imageUrl ?? null,
    };
  }
}
