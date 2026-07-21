import {
  CartStatus,
  CouponStatus,
  CouponType,
  ProductStatus,
  VariantStatus,
} from '@prisma/client';
import { CartService } from './cart.service';

const now = new Date('2026-01-01T00:00:00.000Z');

const product = {
  id: 'product_1',
  name: 'Fresh Foam X 1080',
  slug: 'fresh-foam-x-1080',
  subtitle: 'Daily trainer',
  status: ProductStatus.ACTIVE,
  gender: 'UNISEX',
  deletedAt: null,
  basePrice: 100,
  category: null,
  uploads: [],
};

const variant = {
  id: 'variant_1',
  productId: 'product_1',
  sku: 'NB-FFX1080-BLK-090-D',
  size: '9',
  width: 'D',
  color: 'Black/White',
  colorCode: '#111111',
  imageUrl: null,
  price: 100,
  salePrice: 80,
  stock: 5,
  status: VariantStatus.ACTIVE,
  deletedAt: null,
  product,
};

const cartItem = {
  id: 'cart_item_1',
  cartId: 'cart_1',
  productVariantId: 'variant_1',
  quantity: 1,
  productVariant: variant,
  createdAt: now,
  updatedAt: now,
};

const emptyCart = {
  id: 'cart_1',
  userId: 'customer_1',
  status: CartStatus.ACTIVE,
  coupon: null,
  items: [],
  createdAt: now,
  updatedAt: now,
};

const cartWithItem = {
  ...emptyCart,
  items: [cartItem],
};

const settings = [
  { key: 'currency', value: 'USD' },
  { key: 'default_shipping_fee', value: 5 },
  { key: 'free_shipping_threshold', value: 200 },
  { key: 'tax_rate', value: 0.1 },
];

const validCoupon = {
  id: 'coupon_1',
  code: 'WELCOME10',
  type: CouponType.PERCENTAGE,
  status: CouponStatus.ACTIVE,
  value: 10,
  minOrderAmount: 50,
  maxDiscountAmount: null,
  usageLimit: null,
  usageLimitPerUser: null,
  startsAt: null,
  endsAt: null,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
};

describe('CartService', () => {
  let service: CartService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      cart: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      cartItem: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      productVariant: {
        findFirst: jest.fn(),
      },
      coupon: {
        findFirst: jest.fn(),
      },
      couponUsage: {
        count: jest.fn().mockResolvedValue(0),
      },
      setting: {
        findMany: jest.fn().mockResolvedValue(settings),
      },
    };
    service = new CartService(prisma);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates an active cart when the customer has none', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'customer_1',
      activeCart: null,
    });
    prisma.cart.findFirst.mockResolvedValue(null);
    prisma.cart.create.mockResolvedValue(emptyCart);

    const response = await service.getCart('customer_1');

    expect(response.id).toBe('cart_1');
    expect(response.items).toHaveLength(0);
    expect(prisma.cart.create).toHaveBeenCalledWith({
      data: { userId: 'customer_1' },
      include: expect.any(Object),
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'customer_1' },
      data: { activeCartId: 'cart_1' },
    });
  });

  it('increases quantity when adding the same variant again', async () => {
    jest
      .spyOn(service, 'getOrCreateActiveCart')
      .mockResolvedValueOnce(cartWithItem)
      .mockResolvedValueOnce({
        ...cartWithItem,
        items: [{ ...cartItem, quantity: 3 }],
      });
    prisma.productVariant.findFirst.mockResolvedValue(variant);

    const response = await service.addItem('customer_1', {
      productVariantId: 'variant_1',
      quantity: 2,
    });

    expect(response.items[0].quantity).toBe(3);
    expect(prisma.cartItem.update).toHaveBeenCalledWith({
      where: { id: 'cart_item_1' },
      data: { quantity: 3 },
    });
    expect(prisma.cartItem.create).not.toHaveBeenCalled();
  });

  it('rejects cart quantities above available stock', async () => {
    jest.spyOn(service, 'getOrCreateActiveCart').mockResolvedValue({
      ...cartWithItem,
      items: [{ ...cartItem, quantity: 4 }],
    });
    prisma.productVariant.findFirst.mockResolvedValue(variant);

    await expect(
      service.addItem('customer_1', {
        productVariantId: 'variant_1',
        quantity: 2,
      }),
    ).rejects.toThrow('Requested quantity exceeds available stock');
    expect(prisma.cartItem.update).not.toHaveBeenCalled();
  });

  it.each([
    [
      'inactive product',
      {
        ...variant,
        product: { ...product, status: ProductStatus.DRAFT },
      },
    ],
    [
      'deleted product',
      {
        ...variant,
        product: { ...product, deletedAt: now },
      },
    ],
    [
      'inactive variant',
      {
        ...variant,
        status: VariantStatus.INACTIVE,
      },
    ],
    [
      'deleted variant',
      null,
    ],
  ])('rejects adding an unavailable %s', async (_label, variantRecord) => {
    jest.spyOn(service, 'getOrCreateActiveCart').mockResolvedValue(emptyCart);
    prisma.productVariant.findFirst.mockResolvedValue(variantRecord);

    await expect(
      service.addItem('customer_1', {
        productVariantId: 'variant_1',
        quantity: 1,
      }),
    ).rejects.toThrow(
      variantRecord ? 'Product variant is not available' : 'Product variant not found',
    );
  });

  it('updates cart item quantity for the owning customer cart', async () => {
    prisma.cartItem.findFirst.mockResolvedValue(cartItem);
    prisma.productVariant.findFirst.mockResolvedValue(variant);
    jest.spyOn(service, 'getOrCreateActiveCart').mockResolvedValue({
      ...cartWithItem,
      items: [{ ...cartItem, quantity: 2 }],
    });

    const response = await service.updateItem('customer_1', 'cart_item_1', {
      quantity: 2,
    });

    expect(response.items[0].quantity).toBe(2);
    expect(prisma.cartItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'cart_item_1',
          cart: { userId: 'customer_1', status: CartStatus.ACTIVE },
        }),
      }),
    );
    expect(prisma.cartItem.update).toHaveBeenCalledWith({
      where: { id: 'cart_item_1' },
      data: { quantity: 2 },
    });
  });

  it('removes a cart item from the owning customer cart', async () => {
    prisma.cartItem.findFirst.mockResolvedValue({ id: 'cart_item_1' });
    jest.spyOn(service, 'getOrCreateActiveCart').mockResolvedValue(emptyCart);

    const response = await service.removeItem('customer_1', 'cart_item_1');

    expect(response.items).toHaveLength(0);
    expect(prisma.cartItem.delete).toHaveBeenCalledWith({
      where: { id: 'cart_item_1' },
    });
  });

  it('clears the active cart and removes its coupon', async () => {
    jest
      .spyOn(service, 'getOrCreateActiveCart')
      .mockResolvedValueOnce({ ...cartWithItem, coupon: validCoupon })
      .mockResolvedValueOnce(emptyCart);

    const response = await service.clearCart('customer_1');

    expect(response.items).toHaveLength(0);
    expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { cartId: 'cart_1' },
    });
    expect(prisma.cart.update).toHaveBeenCalledWith({
      where: { id: 'cart_1' },
      data: { couponId: null },
    });
  });

  it('applies a valid coupon and recalculates totals from backend prices', async () => {
    jest
      .spyOn(service, 'getOrCreateActiveCart')
      .mockResolvedValueOnce(cartWithItem)
      .mockResolvedValueOnce({ ...cartWithItem, coupon: validCoupon });
    prisma.coupon.findFirst.mockResolvedValue(validCoupon);

    const response: any = await service.applyCoupon('customer_1', {
      code: 'welcome10',
    });

    expect(response.subtotal).toBe(80);
    expect(response.discountAmount).toBe(8);
    expect(response.shippingEstimate.standard).toBe(5);
    expect(response.taxAmount).toBe(7.2);
    expect(response.totalAmount).toBe(84.2);
    expect(response.appliedCoupon.code).toBe('WELCOME10');
    expect(prisma.cart.update).toHaveBeenCalledWith({
      where: { id: 'cart_1' },
      data: { couponId: 'coupon_1' },
    });
  });

  it('rejects an unknown coupon code', async () => {
    jest.spyOn(service, 'getOrCreateActiveCart').mockResolvedValue(cartWithItem);
    prisma.coupon.findFirst.mockResolvedValue(null);

    await expect(
      service.applyCoupon('customer_1', { code: 'NOPE' }),
    ).rejects.toThrow('Coupon not found');
  });

  it.each([
    [
      'expired coupon',
      { ...validCoupon, endsAt: new Date('2025-01-01T00:00:00.000Z') },
      [0, 0],
      'Coupon is not valid for this cart',
    ],
    [
      'minimum-not-met coupon',
      { ...validCoupon, minOrderAmount: 1000 },
      [0, 0],
      'Coupon is not valid for this cart',
    ],
    [
      'overused coupon',
      { ...validCoupon, usageLimit: 1 },
      [1, 0],
      'Coupon usage limit has been reached',
    ],
    [
      'per-user overused coupon',
      { ...validCoupon, usageLimitPerUser: 1 },
      [0, 1],
      'Coupon user usage limit has been reached',
    ],
  ])('rejects an %s', async (_label, coupon, usageCounts, message) => {
    jest.spyOn(service, 'getOrCreateActiveCart').mockResolvedValue(cartWithItem);
    prisma.coupon.findFirst.mockResolvedValue(coupon);
    prisma.couponUsage.count
      .mockResolvedValueOnce(usageCounts[0])
      .mockResolvedValueOnce(usageCounts[1]);

    await expect(
      service.applyCoupon('customer_1', { code: coupon.code }),
    ).rejects.toThrow(message);
  });

  it('does not apply overused coupon discounts in cart totals', async () => {
    prisma.couponUsage.count.mockResolvedValue(1);

    const response: any = await service.toCartResponse(
      {
        ...cartWithItem,
        coupon: { ...validCoupon, usageLimit: 1 },
      },
      'standard',
      'customer_1',
    );

    expect(response.appliedCoupon.isCurrentlyValid).toBe(false);
    expect(response.discountAmount).toBe(0);
    expect(response.totalAmount).toBe(93);
  });
});
