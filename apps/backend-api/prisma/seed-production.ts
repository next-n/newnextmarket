import { AdminStatus, BannerStatus, CollectionStatus, Prisma, PrismaClient, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

const permissionMatrix: Record<string, string[]> = {
  products: ['read', 'create', 'update', 'delete'],
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

const collectionSeeds = [
  ['New Arrivals', 'new-arrivals', 1],
  ['Best Sellers', 'best-sellers', 2],
  ['Running Shoes', 'running-shoes', 3],
  ['Limited Edition', 'limited-edition', 4],
  ['Sale', 'sale', 5],
] as const;

const settingSeeds = [
  ['store_name', 'Storefront', 'string', 'store', 'Public store name.'],
  ['currency', 'USD', 'string', 'store', 'Default transaction currency.'],
  ['default_shipping_fee', 7.99, 'number', 'shipping', 'Default shipping fee for standard orders.'],
  ['free_shipping_threshold', 100, 'number', 'shipping', 'Order total required for free shipping.'],
  ['tax_rate', 0, 'number', 'tax', 'Default tax rate.'],
  ['low_stock_threshold', 5, 'number', 'inventory', 'Default low stock alert threshold.'],
] as const;

const bannerSeeds = [
  ['Run Your Way', 'run-your-way', 'Fresh Foam cushioning for daily miles.', 'PRODUCTION_BANNER_1_IMAGE_URL', 'running-shoes', 1],
  ['Made for Every Day', 'made-for-every-day', 'Heritage style, modern comfort.', 'PRODUCTION_BANNER_2_IMAGE_URL', 'new-arrivals', 2],
] as const;

async function seedRoles() {
  const roles = new Map<string, { id: string }>();
  for (const [name, description] of [
    ['super_admin', 'Full system access.'],
    ['admin', 'General admin access.'],
    ['manager', 'Catalog and operations manager.'],
    ['support', 'Customer and order support.'],
  ]) {
    const role = await prisma.role.upsert({ where: { name }, update: { description }, create: { name, description } });
    roles.set(name, role);
  }

  const permissionRecords = new Map<string, { id: string }>();
  for (const [resource, actions] of Object.entries(permissionMatrix)) {
    for (const action of actions) {
      const key = `${resource}:${action}`;
      const permission = await prisma.permission.upsert({
        where: { key },
        update: { resource, action, description: `Can ${action} ${resource}.` },
        create: { key, resource, action, description: `Can ${action} ${resource}.` },
      });
      permissionRecords.set(key, permission);
    }
  }

  const allKeys = [...permissionRecords.keys()];
  const managerKeys = ['products:read', 'products:create', 'products:update', 'collections:read', 'collections:create', 'collections:update', 'inventory:read', 'inventory:update', 'orders:read', 'orders:update', 'customers:read', 'banners:read', 'banners:create', 'banners:update', 'uploads:read', 'uploads:create', 'reports:read', 'reports:export'];
  const supportKeys = ['orders:read', 'orders:update', 'customers:read', 'customers:update'];
  for (const [roleName, keys] of [['super_admin', allKeys], ['admin', allKeys], ['manager', managerKeys], ['support', supportKeys] ] as const) {
    const role = roles.get(roleName);
    if (!role) throw new Error(`Missing role: ${roleName}`);
    await prisma.rolePermission.createMany({
      data: keys.map((key) => {
        const permission = permissionRecords.get(key);
        if (!permission) throw new Error(`Missing permission: ${key}`);
        return { roleId: role.id, permissionId: permission.id };
      }),
      skipDuplicates: true,
    });
  }
  return roles;
}

async function seedAdmin(roles: Map<string, { id: string }>) {
  const email = process.env.PRODUCTION_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.PRODUCTION_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('PRODUCTION_ADMIN_EMAIL and PRODUCTION_ADMIN_PASSWORD are required.');
  const admin = await prisma.admin.upsert({
    where: { email },
    update: { firstName: 'Admin', lastName: 'User', status: AdminStatus.ACTIVE },
    create: { email, password: await bcrypt.hash(password, SALT_ROUNDS), firstName: 'Admin', lastName: 'User', status: AdminStatus.ACTIVE },
  });
  const role = roles.get('super_admin');
  if (!role) throw new Error('Missing super_admin role.');
  await prisma.adminRole.createMany({ data: [{ adminId: admin.id, roleId: role.id }], skipDuplicates: true });
}

async function seedCustomer() {
  const email = process.env.PRODUCTION_CUSTOMER_EMAIL?.trim().toLowerCase();
  const password = process.env.PRODUCTION_CUSTOMER_PASSWORD;
  if (!email || !password) throw new Error('PRODUCTION_CUSTOMER_EMAIL and PRODUCTION_CUSTOMER_PASSWORD are required.');
  await prisma.user.upsert({
    where: { email },
    update: { firstName: 'Test', lastName: 'Customer', status: UserStatus.ACTIVE },
    create: { email, password: await bcrypt.hash(password, SALT_ROUNDS), firstName: 'Test', lastName: 'Customer', status: UserStatus.ACTIVE },
  });
}

async function seedSettings() {
  for (const [key, value, dataType, group, description] of settingSeeds) {
    await prisma.setting.upsert({
      where: { key },
      update: { value: value as Prisma.InputJsonValue, dataType, group, description },
      create: { key, value: value as Prisma.InputJsonValue, dataType, group, description },
    });
  }
}

async function seedCollections() {
  const collections = new Map<string, { id: string }>();
  for (const [name, slug, homepagePriority] of collectionSeeds) {
    const collection = await prisma.collection.upsert({
      where: { slug },
      update: { name, description: `${name} collection.`, status: CollectionStatus.ACTIVE, showOnHomepage: true, homepagePriority },
      create: { name, slug, description: `${name} collection.`, status: CollectionStatus.ACTIVE, showOnHomepage: true, homepagePriority },
    });
    collections.set(slug, collection);
  }
  return collections;
}

async function seedBanners(collections: Map<string, { id: string }>) {
  for (const [title, slug, subtitle, imageEnv, collectionSlug, position] of bannerSeeds) {
    const imageUrl = process.env[imageEnv]?.trim();
    const collection = collections.get(collectionSlug);
    if (!imageUrl) throw new Error(`${imageEnv} is required.`);
    if (!collection) throw new Error(`Missing collection: ${collectionSlug}`);
    await prisma.banner.upsert({
      where: { slug },
      update: { title, subtitle, imageUrl, linkUrl: `/collections/${collectionSlug}`, collectionId: collection.id, position, status: BannerStatus.ACTIVE },
      create: { title, slug, subtitle, imageUrl, linkUrl: `/collections/${collectionSlug}`, collectionId: collection.id, position, status: BannerStatus.ACTIVE },
    });
  }
}

async function main() {
  const roles = await seedRoles();
  await seedAdmin(roles);
  await seedCustomer();
  const collections = await seedCollections();
  await seedSettings();
  await seedBanners(collections);
  console.log('Production bootstrap completed with five empty collections, current banners, one customer, and no products, orders, or coupons.');
}

main().catch((error: unknown) => { console.error(error); process.exit(1); }).finally(async () => prisma.$disconnect());
