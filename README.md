# NewNextMarket

NewNextMarket is an MVP ecommerce platform for managing a product catalog and selling products through a customer storefront.

## Applications

- `apps/backend-api` — NestJS API for authentication, catalog, inventory, cart, checkout, orders, payments, banners, collections, and customer accounts.
- `apps/admin-dashboard` — Next.js admin interface for products, variants, images, collections, inventory, banners, orders, and customers.
- `apps/customer-frontend` — Next.js storefront for collections, products, customer accounts, cart, Cash on Delivery checkout, and order tracking.

## Architecture

The frontends communicate with the backend through the REST API. PostgreSQL/Supabase is the source of truth for catalog, inventory, carts, and orders. Redis is an optional cache for public catalog and homepage data. Product and banner images use Supabase Storage when configured, with local storage available as a fallback.

## Local setup

```bash
npm install
cd apps/backend-api
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Run the frontends from the repository root:

```bash
npm run admin:dev
npm run dev -w apps/customer-frontend
```

The local API runs at `http://localhost:3000`, with Swagger at `http://localhost:3000/api/docs`.

## Verification

```bash
npm run backend:build
npm run backend:test
npm run admin:build
npm run build -w apps/customer-frontend
```

See `apps/backend-api/docs/api-summary.md` for the API reference and `deploy/README.md` for cloud deployment.
