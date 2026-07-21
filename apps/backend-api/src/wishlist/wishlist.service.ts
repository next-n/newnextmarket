import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    const wishlist = await this.getOrCreate(userId);
    return this.toWishlistResponse(wishlist);
  }

  async add(userId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, status: ProductStatus.ACTIVE, deletedAt: null },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    const wishlist = await this.getOrCreate(userId);
    try {
      await this.prisma.wishlistItem.create({
        data: { wishlistId: wishlist.id, productId },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException('Product already exists in wishlist');
      throw error;
    }
    return this.toWishlistResponse(await this.getOrCreate(userId, true));
  }

  async remove(userId: string, productId: string) {
    const wishlist = await this.getOrCreate(userId);
    const item = wishlist.items.find((candidate: any) => candidate.productId === productId);
    if (!item) throw new NotFoundException('Wishlist item not found');
    await this.prisma.wishlistItem.delete({ where: { id: item.id } });
    return this.toWishlistResponse(await this.getOrCreate(userId, true));
  }

  private async getOrCreate(userId: string, forceLookup = false): Promise<any> {
    const include: any = {
      items: {
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            include: {
              variants: true,
              uploads: { where: { deletedAt: null } },
            },
          },
        },
      },
    };
    const existing =
      forceLookup
        ? null
        : await this.prisma.wishlist.findUnique({ where: { userId }, include });
    if (existing) return existing;
    const found = await this.prisma.wishlist.findUnique({ where: { userId }, include });
    if (found) return found;
    return this.prisma.wishlist.create({ data: { userId }, include });
  }

  private toWishlistResponse(wishlist: any) {
    return {
      id: wishlist.id,
      userId: wishlist.userId,
      items: wishlist.items.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        createdAt: item.createdAt,
        product: {
          id: item.product.id,
          name: item.product.name,
          slug: item.product.slug,
          status: item.product.status,
          price: item.product.variants?.[0]
            ? Number(item.product.variants[0].salePrice ?? item.product.variants[0].price)
            : null,
          imageUrl: item.product.uploads?.[0]?.url ?? item.product.variants?.[0]?.imageUrl ?? null,
        },
      })),
      createdAt: wishlist.createdAt,
      updatedAt: wishlist.updatedAt,
    };
  }
}
