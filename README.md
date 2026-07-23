# NewNextMarket

NewNextMarket is a production-ready single-store ecommerce MVP for managing a product catalog and selling products through a customer storefront. It is not a multi-vendor marketplace.

## Applications

- `apps/backend-api` — NestJS API for authentication, catalog, inventory, cart, checkout, orders, payments, banners, collections, and customer accounts.
- `apps/admin-dashboard` — Next.js admin interface for products, variants, images, collections, inventory, banners, orders, and customers.
- `apps/customer-frontend` — Next.js storefront for collections, products, customer accounts, cart, Cash on Delivery checkout, and order tracking.

## Architecture

```text
Customer storefront (Vercel) ─┐
                              ├─ HTTPS REST API (Nginx → NestJS)
Admin dashboard (Vercel) ────┘                         │
                                                      ├─ PostgreSQL / Supabase
                                                      ├─ Redis cache
                                                      └─ Supabase Storage
```

The frontends communicate with the backend through the REST API. PostgreSQL/Supabase is the source of truth for catalog, inventory, carts, and orders. Redis caches public catalog and homepage reads; inventory and checkout writes invalidate the relevant cache namespaces. Product and banner images use Supabase Storage when configured, with local storage available as a fallback.

Checkout is currently Cash on Delivery. Order creation decrements stock in a database transaction. Cancelling an eligible unpaid order restores stock atomically and records a uniquely keyed compensating inventory event. Collected orders must use the refund workflow instead of direct cancellation.

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

Backend end-to-end tests require a dedicated test database and Redis instance:

```bash
RUN_E2E=true npm run test:e2e -w apps/backend-api
```

Do not point E2E tests at the production database.

GitHub Actions runs the E2E suite on every push to `main` and every pull request using disposable PostgreSQL and Redis service containers. No shared database credentials are required.

## Deployment

- Customer storefront: `https://www.newnextmarket.asia`
- Admin dashboard: `https://admin.newnextmarket.asia`
- Backend API: `https://api.newnextmarket.asia/api`

The backend runs on the cloud server behind Nginx with HTTPS termination. Redis is private to the server and PostgreSQL is hosted by Supabase.

Production requires `DATABASE_URL`, `JWT_SECRET` (at least 32 characters), and an explicit `CORS_ORIGIN` list. The API refuses to start when these are missing or unsafe.

See `apps/backend-api/docs/api-summary.md` for the API reference and `deploy/README.md` for cloud deployment.
