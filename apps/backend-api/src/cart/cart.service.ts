import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CartStatus,
  Coupon,
  CouponStatus,
  CouponType,
  ProductStatus,
  VariantStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { ApplyCouponDto } from './dto/apply-coupon.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

export type ShippingMethod = 'standard' | 'express';

export type CartTotals = {
  currency: string;
  subtotal: number;
  discountAmount: number;
  shippingFee: number;
  taxAmount: number;
  totalAmount: number;
  shippingEstimate: {
    selectedMethod: ShippingMethod;
    standard: number;
    express: number;
    amount: number;
    isFreeShipping: boolean;
  };
};

export type ValidatedCheckoutCart = {
  cart: any;
  response: any;
  totals: CartTotals;
};

type CheckoutSettings = {
  currency: string;
  defaultShippingFee: number;
  freeShippingThreshold: number;
  taxRate: number;
};

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(userId: string) {
    const cart = await this.getOrCreateActiveCart(userId);

    return this.toCartResponse(cart, 'standard', userId);
  }

  async addItem(userId: string, dto: AddCartItemDto) {
    const cart = await this.getOrCreateActiveCart(userId);
    const variant = await this.ensureVariantCanBePurchased(
      dto.productVariantId,
    );
    const existingItem = cart.items.find(
      (item: any) => item.productVariantId === variant.id,
    );
    const nextQuantity = (existingItem?.quantity ?? 0) + dto.quantity;

    if (nextQuantity > variant.stock) {
      throw new BadRequestException('Requested quantity exceeds available stock');
    }

    if (existingItem) {
      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: nextQuantity },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productVariantId: variant.id,
          quantity: dto.quantity,
        },
      });
    }

    return this.toCartResponse(
      await this.getOrCreateActiveCart(userId, true),
      'standard',
      userId,
    );
  }

  async updateItem(userId: string, itemId: string, dto: UpdateCartItemDto) {
    const item = await this.prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cart: {
          userId,
          status: CartStatus.ACTIVE,
        },
      },
      include: {
        productVariant: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    await this.ensureVariantCanBePurchased(item.productVariantId, dto.quantity);

    await this.prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity: dto.quantity },
    });

    return this.toCartResponse(
      await this.getOrCreateActiveCart(userId, true),
      'standard',
      userId,
    );
  }

  async removeItem(userId: string, itemId: string) {
    const item = await this.prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cart: {
          userId,
          status: CartStatus.ACTIVE,
        },
      },
      select: { id: true },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    await this.prisma.cartItem.delete({ where: { id: item.id } });

    return this.toCartResponse(
      await this.getOrCreateActiveCart(userId, true),
      'standard',
      userId,
    );
  }

  async clearCart(userId: string) {
    const cart = await this.getOrCreateActiveCart(userId);

    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { couponId: null },
    });

    return this.toCartResponse(
      await this.getOrCreateActiveCart(userId, true),
      'standard',
      userId,
    );
  }

  async applyCoupon(userId: string, dto: ApplyCouponDto) {
    const cart = await this.getOrCreateActiveCart(userId);
    const cartResponse = await this.toCartResponse(cart, 'standard', userId);

    if (cartResponse.items.length === 0) {
      throw new BadRequestException('Cannot apply coupon to an empty cart');
    }

    const coupon = await this.prisma.coupon.findFirst({
      where: {
        code: dto.code.trim().toUpperCase(),
        deletedAt: null,
      },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    await this.assertCouponValid(coupon, userId, cartResponse.subtotal);

    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { couponId: coupon.id },
    });

    return this.toCartResponse(
      await this.getOrCreateActiveCart(userId, true),
      'standard',
      userId,
    );
  }

  async removeCoupon(userId: string) {
    const cart = await this.getOrCreateActiveCart(userId);

    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { couponId: null },
    });

    return this.toCartResponse(
      await this.getOrCreateActiveCart(userId, true),
      'standard',
      userId,
    );
  }

  async validateCartForCheckout(
    userId: string,
    shippingMethod: ShippingMethod = 'standard',
  ): Promise<ValidatedCheckoutCart> {
    const cart = await this.getOrCreateActiveCart(userId, true);

    if (cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    for (const item of cart.items) {
      await this.ensureVariantCanBePurchased(
        item.productVariantId,
        item.quantity,
      );
    }

    const response = await this.toCartResponse(cart, shippingMethod, userId);

    if (cart.coupon) {
      await this.assertCouponValid(cart.coupon, userId, response.subtotal);
    }

    return {
      cart,
      response,
      totals: {
        currency: response.currency,
        subtotal: response.subtotal,
        discountAmount: response.discountAmount,
        shippingFee: response.shippingEstimate.amount,
        taxAmount: response.taxAmount,
        totalAmount: response.totalAmount,
        shippingEstimate: response.shippingEstimate,
      },
    };
  }

  async getShippingRates(userId: string) {
    const cart = await this.getOrCreateActiveCart(userId, true);
    const response = await this.toCartResponse(cart, 'standard', userId);

    return response.shippingEstimate;
  }

  async getOrCreateActiveCart(
    userId: string,
    forceLookup = false,
  ): Promise<any> {
    const include = this.cartInclude();

    if (!forceLookup) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          activeCart: {
            include,
          },
        },
      });

      if (!user) {
        throw new NotFoundException('Customer not found');
      }

      if (user.activeCart?.status === CartStatus.ACTIVE) {
        return user.activeCart;
      }
    }

    const existingCart = await this.prisma.cart.findFirst({
      where: {
        userId,
        status: CartStatus.ACTIVE,
      },
      orderBy: { updatedAt: 'desc' },
      include,
    });

    if (existingCart) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { activeCartId: existingCart.id },
      });

      return existingCart;
    }

    const cart = await this.prisma.cart.create({
      data: { userId },
      include,
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { activeCartId: cart.id },
    });

    return cart;
  }

  async toCartResponse(
    cart: any,
    selectedShippingMethod: ShippingMethod = 'standard',
    userId?: string,
  ) {
    const settings = await this.getCheckoutSettings();
    const subtotal = this.sumCartSubtotal(cart);
    const couponUsable =
      cart.coupon &&
      (userId
        ? await this.isCouponUsableByCustomer(cart.coupon, userId, subtotal)
        : this.isCouponCurrentlyUsable(cart.coupon, subtotal));
    const discountAmount =
      couponUsable && cart.coupon
        ? this.calculateCouponDiscount(cart.coupon, subtotal)
        : 0;
    const shippingEstimate = this.calculateShippingEstimate(
      subtotal,
      settings,
      selectedShippingMethod,
      couponUsable && cart.coupon?.type === CouponType.FREE_SHIPPING,
    );
    const taxableAmount = Math.max(subtotal - discountAmount, 0);
    const taxAmount = this.money(taxableAmount * settings.taxRate);
    const totalAmount = this.money(
      taxableAmount + shippingEstimate.amount + taxAmount,
    );

    return {
      id: cart.id,
      status: cart.status,
      currency: settings.currency,
      items: cart.items.map((item: any) => this.toCartItemResponse(item)),
      subtotal: this.money(subtotal),
      discountAmount: this.money(discountAmount),
      shippingEstimate,
      taxAmount,
      totalAmount,
      appliedCoupon: cart.coupon
        ? {
            id: cart.coupon.id,
            code: cart.coupon.code,
            type: cart.coupon.type,
            value: Number(cart.coupon.value),
            isCurrentlyValid: Boolean(couponUsable),
          }
        : null,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };
  }

  private cartInclude(): any {
    return {
      coupon: true,
      items: {
        orderBy: { createdAt: 'asc' },
        include: {
          productVariant: {
            include: {
              product: {
                include: {
                  category: true,
                  uploads: {
                    where: { deletedAt: null },
                    orderBy: { createdAt: 'asc' },
                  },
                },
              },
            },
          },
        },
      },
    };
  }

  private async ensureVariantCanBePurchased(
    productVariantId: string,
    quantity?: number,
  ) {
    const variant = await this.prisma.productVariant.findFirst({
      where: {
        id: productVariantId,
        deletedAt: null,
      },
      include: {
        product: true,
      },
    });

    if (!variant) {
      throw new NotFoundException('Product variant not found');
    }

    if (
      variant.status !== VariantStatus.ACTIVE ||
      variant.product.status !== ProductStatus.ACTIVE ||
      variant.product.deletedAt !== null
    ) {
      throw new BadRequestException('Product variant is not available');
    }

    if (variant.stock <= 0) {
      throw new BadRequestException('Product variant is out of stock');
    }

    if (quantity !== undefined && quantity > variant.stock) {
      throw new BadRequestException('Requested quantity exceeds available stock');
    }

    return variant;
  }

  private async assertCouponValid(
    coupon: Coupon,
    userId: string,
    subtotal: number,
  ) {
    if (!this.isCouponCurrentlyUsable(coupon, subtotal)) {
      throw new BadRequestException('Coupon is not valid for this cart');
    }

    const [totalUsage, userUsage] = await Promise.all([
      this.prisma.couponUsage.count({
        where: { couponId: coupon.id },
      }),
      this.prisma.couponUsage.count({
        where: { couponId: coupon.id, userId },
      }),
    ]);

    if (coupon.usageLimit !== null && totalUsage >= coupon.usageLimit) {
      throw new BadRequestException('Coupon usage limit has been reached');
    }

    if (
      coupon.usageLimitPerUser !== null &&
      userUsage >= coupon.usageLimitPerUser
    ) {
      throw new BadRequestException('Coupon user usage limit has been reached');
    }
  }

  private async isCouponUsableByCustomer(
    coupon: Coupon,
    userId: string,
    subtotal: number,
  ) {
    if (!this.isCouponCurrentlyUsable(coupon, subtotal)) {
      return false;
    }

    const [totalUsage, userUsage] = await Promise.all([
      this.prisma.couponUsage.count({
        where: { couponId: coupon.id },
      }),
      this.prisma.couponUsage.count({
        where: { couponId: coupon.id, userId },
      }),
    ]);

    return !(
      (coupon.usageLimit !== null && totalUsage >= coupon.usageLimit) ||
      (coupon.usageLimitPerUser !== null &&
        userUsage >= coupon.usageLimitPerUser)
    );
  }

  private isCouponCurrentlyUsable(coupon: Coupon, subtotal: number) {
    const now = new Date();
    const minOrderAmount =
      coupon.minOrderAmount === null ? null : Number(coupon.minOrderAmount);

    return (
      coupon.status === CouponStatus.ACTIVE &&
      coupon.deletedAt === null &&
      (coupon.startsAt === null || coupon.startsAt <= now) &&
      (coupon.endsAt === null || coupon.endsAt >= now) &&
      (minOrderAmount === null || subtotal >= minOrderAmount)
    );
  }

  private calculateCouponDiscount(coupon: Coupon, subtotal: number) {
    if (coupon.type === CouponType.FREE_SHIPPING) {
      return 0;
    }

    const value = Number(coupon.value);
    const rawDiscount =
      coupon.type === CouponType.PERCENTAGE ? subtotal * (value / 100) : value;
    const cappedDiscount =
      coupon.maxDiscountAmount === null
        ? rawDiscount
        : Math.min(rawDiscount, Number(coupon.maxDiscountAmount));

    return this.money(Math.min(cappedDiscount, subtotal));
  }

  private sumCartSubtotal(cart: any) {
    return cart.items.reduce((total: number, item: any) => {
      return total + this.getUnitPrice(item.productVariant) * item.quantity;
    }, 0);
  }

  private toCartItemResponse(item: any) {
    const variant = item.productVariant;
    const product = variant.product;
    const unitPrice = this.getUnitPrice(variant);
    const lineTotal = this.money(unitPrice * item.quantity);

    return {
      id: item.id,
      productVariantId: variant.id,
      productId: product.id,
      quantity: item.quantity,
      unitPrice: this.money(unitPrice),
      lineTotal,
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        subtitle: product.subtitle,
        status: product.status,
        gender: product.gender,
        basePrice:
          product.basePrice === null ? null : this.money(Number(product.basePrice)),
        category: product.category
          ? {
              id: product.category.id,
              name: product.category.name,
              slug: product.category.slug,
            }
          : null,
        images: (product.uploads ?? []).map((upload: any) => ({
          id: upload.id,
          url: upload.url,
          altText: upload.altText,
          type: upload.type,
        })),
      },
      variant: {
        id: variant.id,
        sku: variant.sku,
        size: variant.size,
        width: variant.width,
        color: variant.color,
        colorCode: variant.colorCode,
        imageUrl: variant.imageUrl,
        price: this.money(Number(variant.price)),
        salePrice:
          variant.salePrice === null ? null : this.money(Number(variant.salePrice)),
        stock: variant.stock,
        status: variant.status,
      },
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private getUnitPrice(variant: any) {
    return variant.salePrice === null
      ? Number(variant.price)
      : Number(variant.salePrice);
  }

  private calculateShippingEstimate(
    subtotal: number,
    settings: CheckoutSettings,
    selectedMethod: ShippingMethod,
    hasFreeShippingCoupon: boolean,
  ) {
    const qualifiesForFreeStandard =
      subtotal > 0 &&
      settings.freeShippingThreshold > 0 &&
      subtotal >= settings.freeShippingThreshold;
    const standard = this.money(
      qualifiesForFreeStandard || hasFreeShippingCoupon
        ? 0
        : settings.defaultShippingFee,
    );
    const express = this.money(Math.max(settings.defaultShippingFee * 2, 0));
    const amount = selectedMethod === 'express' ? express : standard;

    return {
      selectedMethod,
      standard,
      express,
      amount,
      isFreeShipping:
        selectedMethod === 'standard' && standard === 0 && subtotal > 0,
    };
  }

  private async getCheckoutSettings(): Promise<CheckoutSettings> {
    const settings = await this.prisma.setting.findMany({
      where: {
        key: {
          in: [
            'currency',
            'default_shipping_fee',
            'free_shipping_threshold',
            'tax_rate',
          ],
        },
      },
    });
    const settingValue = (key: string) =>
      settings.find((setting) => setting.key === key)?.value;

    return {
      currency: this.readString(settingValue('currency'), 'USD'),
      defaultShippingFee: this.readNumber(
        settingValue('default_shipping_fee'),
        0,
      ),
      freeShippingThreshold: this.readNumber(
        settingValue('free_shipping_threshold'),
        0,
      ),
      taxRate: this.normalizeTaxRate(this.readNumber(settingValue('tax_rate'), 0)),
    };
  }

  private readString(value: unknown, fallback: string) {
    return typeof value === 'string' && value.trim().length > 0
      ? value
      : fallback;
  }

  private readNumber(value: unknown, fallback: number) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    }

    return fallback;
  }

  private normalizeTaxRate(value: number) {
    if (value > 1) {
      return value / 100;
    }

    return Math.max(value, 0);
  }

  private money(value: number) {
    return Number((Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2));
  }
}
