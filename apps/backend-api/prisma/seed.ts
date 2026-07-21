import {
  AdminStatus,
  BannerStatus,
  CategoryStatus,
  CollectionStatus,
  CouponStatus,
  CouponType,
  Gender,
  InventoryLogType,
  Prisma,
  PrismaClient,
  ProductStatus,
  UploadType,
  VariantStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

const permissionMatrix: Record<string, string[]> = {
  products: ['read', 'create', 'update', 'delete'],
  categories: ['read', 'create', 'update', 'delete'],
  collections: ['read', 'create', 'update', 'delete'],
  inventory: ['read', 'update'],
  orders: ['read', 'create', 'update', 'delete'],
  customers: ['read', 'create', 'update', 'delete'],
  coupons: ['read', 'create', 'update', 'delete'],
  banners: ['read', 'create', 'update', 'delete'],
  reviews: ['read', 'update', 'delete'],
  uploads: ['read', 'create', 'delete'],
  reports: ['read', 'export'],
  settings: ['read', 'update'],
  notifications: ['read', 'create'],
  audit_logs: ['read'],
};

const categories = [
  { name: 'Men', slug: 'men' },
  { name: 'Women', slug: 'women' },
  { name: 'Kids', slug: 'kids' },
  { name: 'Shoes', slug: 'shoes' },
  { name: 'Clothing', slug: 'clothing' },
  { name: 'Accessories', slug: 'accessories' },
  { name: 'Running', slug: 'running', parentSlug: 'shoes' },
  { name: 'Lifestyle', slug: 'lifestyle', parentSlug: 'shoes' },
  { name: 'Training', slug: 'training', parentSlug: 'shoes' },
  { name: 'Sale', slug: 'sale' },
  { name: 'New Arrivals', slug: 'new-arrivals' },
];

const collections = [
  { name: 'New Arrivals', slug: 'new-arrivals' },
  { name: 'Best Sellers', slug: 'best-sellers' },
  { name: 'Running Shoes', slug: 'running-shoes' },
  { name: 'Limited Edition', slug: 'limited-edition' },
  { name: 'Sale', slug: 'sale' },
];

const products = [
  {
    name: 'Fresh Foam X 1080',
    slug: 'fresh-foam-x-1080',
    subtitle: 'Premium daily running shoe',
    description:
      'Soft cushioning and a smooth ride for everyday training miles.',
    categorySlug: 'running',
    gender: Gender.UNISEX,
    basePrice: '164.99',
    tags: ['running', 'fresh-foam', 'daily-trainer'],
    collectionSlugs: ['new-arrivals', 'best-sellers', 'running-shoes'],
    imageUrl:
      'https://cdn.example.com/products/fresh-foam-x-1080/hero.jpg',
    isFeatured: true,
    isNewArrival: true,
    variants: [
      {
        sku: 'NB-FFX1080-BLK-090-D',
        size: '9',
        width: 'D',
        color: 'Black/White',
        colorCode: '#111111',
        stock: 25,
        price: '164.99',
        salePrice: null,
        imageUrl:
          'https://cdn.example.com/products/fresh-foam-x-1080/black-white.jpg',
      },
      {
        sku: 'NB-FFX1080-BLK-100-D',
        size: '10',
        width: 'D',
        color: 'Black/White',
        colorCode: '#111111',
        stock: 20,
        price: '164.99',
        salePrice: null,
        imageUrl:
          'https://cdn.example.com/products/fresh-foam-x-1080/black-white.jpg',
      },
      {
        sku: 'NB-FFX1080-BLU-095-2E',
        size: '9.5',
        width: '2E',
        color: 'Blue/White',
        colorCode: '#2563eb',
        stock: 16,
        price: '164.99',
        salePrice: '149.99',
        imageUrl:
          'https://cdn.example.com/products/fresh-foam-x-1080/blue-white.jpg',
      },
    ],
  },
  {
    name: '990v6 Made in USA',
    slug: '990v6-made-in-usa',
    subtitle: 'Heritage lifestyle sneaker',
    description:
      'Classic craftsmanship with modern cushioning for everyday wear.',
    categorySlug: 'lifestyle',
    gender: Gender.UNISEX,
    basePrice: '199.99',
    tags: ['lifestyle', 'made-in-usa', 'heritage'],
    collectionSlugs: ['best-sellers', 'limited-edition'],
    imageUrl:
      'https://cdn.example.com/products/990v6-made-in-usa/hero.jpg',
    isFeatured: true,
    isNewArrival: false,
    variants: [
      {
        sku: 'NB-990V6-GRY-080-D',
        size: '8',
        width: 'D',
        color: 'Grey',
        colorCode: '#9ca3af',
        stock: 18,
        price: '199.99',
        salePrice: null,
        imageUrl:
          'https://cdn.example.com/products/990v6-made-in-usa/grey.jpg',
      },
      {
        sku: 'NB-990V6-GRY-090-D',
        size: '9',
        width: 'D',
        color: 'Grey',
        colorCode: '#9ca3af',
        stock: 22,
        price: '199.99',
        salePrice: null,
        imageUrl:
          'https://cdn.example.com/products/990v6-made-in-usa/grey.jpg',
      },
      {
        sku: 'NB-990V6-GRY-100-2E',
        size: '10',
        width: '2E',
        color: 'Grey',
        colorCode: '#9ca3af',
        stock: 12,
        price: '199.99',
        salePrice: null,
        imageUrl:
          'https://cdn.example.com/products/990v6-made-in-usa/grey.jpg',
      },
    ],
  },
  {
    name: 'FuelCell Rebel',
    slug: 'fuelcell-rebel',
    subtitle: 'Lightweight speed trainer',
    description:
      'Responsive cushioning and a light upper for tempo runs and workouts.',
    categorySlug: 'running',
    gender: Gender.UNISEX,
    basePrice: '139.99',
    tags: ['running', 'fuelcell', 'speed'],
    collectionSlugs: ['new-arrivals', 'running-shoes', 'sale'],
    imageUrl: 'https://cdn.example.com/products/fuelcell-rebel/hero.jpg',
    isFeatured: false,
    isNewArrival: true,
    variants: [
      {
        sku: 'NB-FCREBEL-WHT-085-D',
        size: '8.5',
        width: 'D',
        color: 'White/Blue',
        colorCode: '#f8fafc',
        stock: 30,
        price: '139.99',
        salePrice: '119.99',
        imageUrl:
          'https://cdn.example.com/products/fuelcell-rebel/white-blue.jpg',
      },
      {
        sku: 'NB-FCREBEL-WHT-095-D',
        size: '9.5',
        width: 'D',
        color: 'White/Blue',
        colorCode: '#f8fafc',
        stock: 28,
        price: '139.99',
        salePrice: '119.99',
        imageUrl:
          'https://cdn.example.com/products/fuelcell-rebel/white-blue.jpg',
      },
      {
        sku: 'NB-FCREBEL-BLK-100-2E',
        size: '10',
        width: '2E',
        color: 'Black/Lime',
        colorCode: '#111827',
        stock: 14,
        price: '139.99',
        salePrice: '124.99',
        imageUrl:
          'https://cdn.example.com/products/fuelcell-rebel/black-lime.jpg',
      },
    ],
  },
];

const banners = [
  {
    title: 'Run Your Way',
    slug: 'run-your-way',
    subtitle: 'Fresh Foam cushioning for daily miles.',
    imageUrl: 'https://cdn.example.com/banners/run-your-way.jpg',
    linkUrl: '/collections/running-shoes',
    position: 1,
  },
  {
    title: 'Made for Every Day',
    slug: 'made-for-every-day',
    subtitle: 'Heritage style, modern comfort.',
    imageUrl: 'https://cdn.example.com/banners/made-for-every-day.jpg',
    linkUrl: '/collections/best-sellers',
    position: 2,
  },
];

const settings = [
  {
    key: 'store_name',
    value: 'NB Style Store',
    dataType: 'string',
    group: 'store',
    description: 'Public store name.',
  },
  {
    key: 'currency',
    value: 'USD',
    dataType: 'string',
    group: 'store',
    description: 'Default transaction currency.',
  },
  {
    key: 'default_shipping_fee',
    value: 7.99,
    dataType: 'number',
    group: 'shipping',
    description: 'Default shipping fee for standard orders.',
  },
  {
    key: 'free_shipping_threshold',
    value: 100,
    dataType: 'number',
    group: 'shipping',
    description: 'Order total required for free shipping.',
  },
  {
    key: 'tax_rate',
    value: 0,
    dataType: 'number',
    group: 'tax',
    description: 'Default tax rate.',
  },
  {
    key: 'low_stock_threshold',
    value: 5,
    dataType: 'number',
    group: 'inventory',
    description: 'Default low stock alert threshold.',
  },
];

async function seedRolesAndPermissions() {
  const roleSeeds = [
    { name: 'super_admin', description: 'Full system access.' },
    { name: 'admin', description: 'General admin access.' },
    { name: 'manager', description: 'Catalog and operations manager.' },
    { name: 'support', description: 'Customer and order support.' },
  ];

  const roles = [];
  for (const role of roleSeeds) {
    roles.push(
      await prisma.role.upsert({
        where: { name: role.name },
        update: { description: role.description },
        create: role,
      }),
    );
  }

  const permissions = Object.entries(permissionMatrix).flatMap(
    ([resource, actions]) =>
      actions.map((action) => ({
        key: `${resource}:${action}`,
        resource,
        action,
        description: `Can ${action} ${resource}.`,
      })),
  );

  const createdPermissions = [];
  for (const permission of permissions) {
    createdPermissions.push(
      await prisma.permission.upsert({
        where: { key: permission.key },
        update: {
          resource: permission.resource,
          action: permission.action,
          description: permission.description,
        },
        create: permission,
      }),
    );
  }

  const rolesByName = new Map(roles.map((role) => [role.name, role]));
  const permissionsByKey = new Map(
    createdPermissions.map((permission) => [permission.key, permission]),
  );

  const allPermissionKeys = createdPermissions.map((permission) => permission.key);
  const managerPermissionKeys = [
    'products:read',
    'products:create',
    'products:update',
    'categories:read',
    'categories:create',
    'categories:update',
    'collections:read',
    'collections:create',
    'collections:update',
    'inventory:read',
    'inventory:update',
    'orders:read',
    'orders:update',
    'customers:read',
    'coupons:read',
    'coupons:create',
    'coupons:update',
    'banners:read',
    'banners:create',
    'banners:update',
    'reviews:read',
    'reviews:update',
    'uploads:read',
    'uploads:create',
    'notifications:read',
    'notifications:create',
    'reports:read',
    'reports:export',
  ];
  const supportPermissionKeys = [
    'orders:read',
    'orders:update',
    'customers:read',
    'customers:update',
  ];

  await assignPermissionsToRole('super_admin', allPermissionKeys, rolesByName, permissionsByKey);
  await assignPermissionsToRole('admin', allPermissionKeys, rolesByName, permissionsByKey);
  await assignPermissionsToRole(
    'manager',
    managerPermissionKeys,
    rolesByName,
    permissionsByKey,
  );
  await assignPermissionsToRole(
    'support',
    supportPermissionKeys,
    rolesByName,
    permissionsByKey,
  );

  return rolesByName;
}

async function assignPermissionsToRole(
  roleName: string,
  permissionKeys: string[],
  rolesByName: Map<string, { id: string; name: string }>,
  permissionsByKey: Map<string, { id: string; key: string }>,
): Promise<void> {
  const role = rolesByName.get(roleName);

  if (!role) {
    throw new Error(`Missing role: ${roleName}`);
  }

  const data = permissionKeys.map((key) => {
    const permission = permissionsByKey.get(key);

    if (!permission) {
      throw new Error(`Missing permission: ${key}`);
    }

    return {
      roleId: role.id,
      permissionId: permission.id,
    };
  });

  await prisma.rolePermission.createMany({
    data,
    skipDuplicates: true,
  });
}

async function seedSuperAdmin(
  rolesByName: Map<string, { id: string; name: string }>,
) {
  const hashedPassword = await bcrypt.hash('Admin123!', SALT_ROUNDS);
  const admin = await prisma.admin.upsert({
    where: { email: 'admin@example.com' },
    update: {
      password: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      status: AdminStatus.ACTIVE,
    },
    create: {
      email: 'admin@example.com',
      password: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      status: AdminStatus.ACTIVE,
    },
  });

  const superAdminRole = rolesByName.get('super_admin');

  if (!superAdminRole) {
    throw new Error('Missing super_admin role.');
  }

  await prisma.adminRole.createMany({
    data: [{ adminId: admin.id, roleId: superAdminRole.id }],
    skipDuplicates: true,
  });

  return admin;
}

async function seedCategories() {
  const categoriesBySlug = new Map<string, { id: string; slug: string }>();

  for (const categorySeed of categories) {
    const parent = categorySeed.parentSlug
      ? categoriesBySlug.get(categorySeed.parentSlug)
      : null;

    const category = await prisma.category.upsert({
      where: { slug: categorySeed.slug },
      update: {
        name: categorySeed.name,
        parentId: parent?.id ?? null,
        status: CategoryStatus.ACTIVE,
      },
      create: {
        name: categorySeed.name,
        slug: categorySeed.slug,
        parentId: parent?.id,
        status: CategoryStatus.ACTIVE,
      },
    });

    categoriesBySlug.set(category.slug, category);
  }

  return categoriesBySlug;
}

async function seedCollections() {
  const collectionsBySlug = new Map<string, { id: string; slug: string }>();

  for (const collectionSeed of collections) {
    const collection = await prisma.collection.upsert({
      where: { slug: collectionSeed.slug },
      update: {
        name: collectionSeed.name,
        description: `${collectionSeed.name} collection.`,
        status: CollectionStatus.ACTIVE,
      },
      create: {
        name: collectionSeed.name,
        slug: collectionSeed.slug,
        description: `${collectionSeed.name} collection.`,
        status: CollectionStatus.ACTIVE,
      },
    });

    collectionsBySlug.set(collection.slug, collection);
  }

  return collectionsBySlug;
}

async function seedProducts(
  categoriesBySlug: Map<string, { id: string; slug: string }>,
  collectionsBySlug: Map<string, { id: string; slug: string }>,
  adminId: string,
): Promise<void> {
  for (const productSeed of products) {
    const category = categoriesBySlug.get(productSeed.categorySlug);

    if (!category) {
      throw new Error(`Missing category: ${productSeed.categorySlug}`);
    }

    const product = await prisma.product.upsert({
      where: { slug: productSeed.slug },
      update: {
        name: productSeed.name,
        subtitle: productSeed.subtitle,
        description: productSeed.description,
        status: ProductStatus.ACTIVE,
        gender: productSeed.gender,
        categoryId: category.id,
        basePrice: productSeed.basePrice,
        isFeatured: productSeed.isFeatured,
        isNewArrival: productSeed.isNewArrival,
        tags: productSeed.tags,
        publishedAt: new Date(),
      },
      create: {
        name: productSeed.name,
        slug: productSeed.slug,
        subtitle: productSeed.subtitle,
        description: productSeed.description,
        status: ProductStatus.ACTIVE,
        gender: productSeed.gender,
        categoryId: category.id,
        basePrice: productSeed.basePrice,
        isFeatured: productSeed.isFeatured,
        isNewArrival: productSeed.isNewArrival,
        tags: productSeed.tags,
        publishedAt: new Date(),
      },
    });

    await prisma.upload.upsert({
      where: { url: productSeed.imageUrl },
      update: {
        type: UploadType.PRODUCT_IMAGE,
        filename: `${productSeed.slug}.jpg`,
        mimeType: 'image/jpeg',
        size: 240000,
        altText: productSeed.name,
        productId: product.id,
        adminId,
      },
      create: {
        type: UploadType.PRODUCT_IMAGE,
        url: productSeed.imageUrl,
        filename: `${productSeed.slug}.jpg`,
        mimeType: 'image/jpeg',
        size: 240000,
        altText: productSeed.name,
        productId: product.id,
        adminId,
      },
    });

    for (const collectionSlug of productSeed.collectionSlugs) {
      const collection = collectionsBySlug.get(collectionSlug);

      if (!collection) {
        throw new Error(`Missing collection: ${collectionSlug}`);
      }

      await prisma.collectionProduct.createMany({
        data: [
          {
            collectionId: collection.id,
            productId: product.id,
          },
        ],
        skipDuplicates: true,
      });
    }

    for (const variantSeed of productSeed.variants) {
      const variant = await prisma.productVariant.upsert({
        where: { sku: variantSeed.sku },
        update: {
          productId: product.id,
          size: variantSeed.size,
          width: variantSeed.width,
          color: variantSeed.color,
          colorCode: variantSeed.colorCode,
          imageUrl: variantSeed.imageUrl,
          stock: variantSeed.stock,
          price: variantSeed.price,
          salePrice: variantSeed.salePrice,
          lowStockThreshold: 5,
          status: VariantStatus.ACTIVE,
        },
        create: {
          productId: product.id,
          sku: variantSeed.sku,
          size: variantSeed.size,
          width: variantSeed.width,
          color: variantSeed.color,
          colorCode: variantSeed.colorCode,
          imageUrl: variantSeed.imageUrl,
          stock: variantSeed.stock,
          price: variantSeed.price,
          salePrice: variantSeed.salePrice,
          lowStockThreshold: 5,
          status: VariantStatus.ACTIVE,
        },
      });

      const existingInventoryLog = await prisma.inventoryLog.findFirst({
        where: {
          productVariantId: variant.id,
          type: InventoryLogType.STOCK_IN,
          note: 'Initial seed stock.',
        },
      });

      if (!existingInventoryLog) {
        await prisma.inventoryLog.create({
          data: {
            productVariantId: variant.id,
            adminId,
            type: InventoryLogType.STOCK_IN,
            quantity: variantSeed.stock,
            stockBefore: 0,
            stockAfter: variantSeed.stock,
            note: 'Initial seed stock.',
          },
        });
      }
    }
  }
}

async function seedCoupons(): Promise<void> {
  const now = new Date();
  const nextYear = new Date(now);
  nextYear.setFullYear(nextYear.getFullYear() + 1);

  const couponSeeds = [
    {
      code: 'WELCOME10',
      type: CouponType.PERCENTAGE,
      value: '10.00',
      minOrderAmount: '0.00',
      maxDiscountAmount: '50.00',
      usageLimit: 1000,
      usageLimitPerUser: 1,
    },
    {
      code: 'SALE20',
      type: CouponType.PERCENTAGE,
      value: '20.00',
      minOrderAmount: '75.00',
      maxDiscountAmount: '100.00',
      usageLimit: 500,
      usageLimitPerUser: 2,
    },
  ];

  for (const coupon of couponSeeds) {
    await prisma.coupon.upsert({
      where: { code: coupon.code },
      update: {
        type: coupon.type,
        status: CouponStatus.ACTIVE,
        value: coupon.value,
        minOrderAmount: coupon.minOrderAmount,
        maxDiscountAmount: coupon.maxDiscountAmount,
        usageLimit: coupon.usageLimit,
        usageLimitPerUser: coupon.usageLimitPerUser,
        startsAt: now,
        endsAt: nextYear,
      },
      create: {
        code: coupon.code,
        type: coupon.type,
        status: CouponStatus.ACTIVE,
        value: coupon.value,
        minOrderAmount: coupon.minOrderAmount,
        maxDiscountAmount: coupon.maxDiscountAmount,
        usageLimit: coupon.usageLimit,
        usageLimitPerUser: coupon.usageLimitPerUser,
        startsAt: now,
        endsAt: nextYear,
      },
    });
  }
}

async function seedBanners(adminId: string): Promise<void> {
  for (const bannerSeed of banners) {
    const banner = await prisma.banner.upsert({
      where: { slug: bannerSeed.slug },
      update: {
        title: bannerSeed.title,
        subtitle: bannerSeed.subtitle,
        imageUrl: bannerSeed.imageUrl,
        linkUrl: bannerSeed.linkUrl,
        position: bannerSeed.position,
        status: BannerStatus.ACTIVE,
      },
      create: {
        title: bannerSeed.title,
        slug: bannerSeed.slug,
        subtitle: bannerSeed.subtitle,
        imageUrl: bannerSeed.imageUrl,
        linkUrl: bannerSeed.linkUrl,
        position: bannerSeed.position,
        status: BannerStatus.ACTIVE,
      },
    });

    await prisma.upload.upsert({
      where: { url: bannerSeed.imageUrl },
      update: {
        type: UploadType.BANNER_IMAGE,
        filename: `${bannerSeed.slug}.jpg`,
        mimeType: 'image/jpeg',
        size: 300000,
        altText: bannerSeed.title,
        bannerId: banner.id,
        adminId,
      },
      create: {
        type: UploadType.BANNER_IMAGE,
        url: bannerSeed.imageUrl,
        filename: `${bannerSeed.slug}.jpg`,
        mimeType: 'image/jpeg',
        size: 300000,
        altText: bannerSeed.title,
        bannerId: banner.id,
        adminId,
      },
    });
  }
}

async function seedSettings(): Promise<void> {
  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {
        value: setting.value as Prisma.InputJsonValue,
        dataType: setting.dataType,
        group: setting.group,
        description: setting.description,
      },
      create: {
        key: setting.key,
        value: setting.value as Prisma.InputJsonValue,
        dataType: setting.dataType,
        group: setting.group,
        description: setting.description,
      },
    });
  }
}

async function main(): Promise<void> {
  const rolesByName = await seedRolesAndPermissions();
  const admin = await seedSuperAdmin(rolesByName);
  const categoriesBySlug = await seedCategories();
  const collectionsBySlug = await seedCollections();

  await seedProducts(categoriesBySlug, collectionsBySlug, admin.id);
  await seedCoupons();
  await seedBanners(admin.id);
  await seedSettings();

  console.log('Seed completed.');
  console.log('Admin login: admin@example.com / Admin123!');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
