# NewNextMarket Backend API

NestJS backend API used by the NewNextMarket admin dashboard and customer storefront.

## Tech Stack

- NestJS and TypeScript
- PostgreSQL
- Prisma ORM
- Swagger/OpenAPI
- class-validator and class-transformer
- JWT authentication
- bcrypt password hashing
- Supabase Storage through the S3-compatible API, with local file storage fallback

## Setup

```bash
npm install
cp .env.example .env
```

Configure `.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/ecommerce_backend_api?schema=public"
JWT_SECRET="replace-with-a-secure-secret"
JWT_EXPIRES_IN="1d"
PORT=3000
NODE_ENV="development"
CORS_ORIGIN="http://localhost:3000"
REDIS_URL="redis://localhost:6379"
```

Use a comma-separated `CORS_ORIGIN` list for multiple local clients, or `*` for open local development.

Redis is optional for local development. When `REDIS_URL` is configured, the API caches public catalog, homepage, settings, and shipping-method reads. PostgreSQL remains the source of truth for inventory, carts, checkout, orders, and payments. If Redis is unavailable, the API falls back to PostgreSQL.

## Database

Create the PostgreSQL database referenced by `DATABASE_URL`, then run:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

The Prisma migration history lives in `prisma/migrations`. The initial migration includes the complete schema, including `Banner.buttonText`.

For a fresh database check:

```bash
npx prisma migrate reset
npm run prisma:seed
```

## Default Admin

After seeding:

```text
email: admin@example.com
password: Admin123!
```

## Development

```bash
npm run dev
```

The API is served under `/api`.

Swagger docs:

```text
http://localhost:3000/api/docs
```

## Tests And Build

```bash
npm run prisma:generate
npx prisma validate
npm run build
npm run test
```

## Prisma Commands

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio
npm run prisma:seed
```

Create a named migration during development:

```bash
npm run prisma:migrate -- --name your_migration_name
```

## Main API Modules

- Auth and admin auth
- Categories, collections, products, variants, and inventory
- Cart and checkout
- Orders, payments, shipping, returns, and refunds
- Coupons
- Banners and homepage CMS data
- Reviews
- Wishlist
- Uploads
- Reports
- Settings
- Notifications
- Audit logs

See [docs/api-summary.md](docs/api-summary.md) for endpoint coverage and [docs/backend-checklist.md](docs/backend-checklist.md) for the readiness checklist.

## Project Structure

```text
src/
├── auth/
├── audit-logs/
├── banners/
├── cart/
├── catalog/
├── checkout/
├── common/
├── config/
├── coupons/
├── notifications/
├── orders/
├── payments/
├── prisma/
├── reports/
├── returns/
├── reviews/
├── settings/
├── shipping/
├── uploads/
└── wishlist/
```

`common/` contains shared guards, decorators, filters, interceptors, response types, and utilities. `prisma/` contains the Nest Prisma service. The database schema and seed live in the root `prisma/` directory.

## Development Workflow

1. Pull latest code and run `npm install`.
2. Update `.env` if new variables are added.
3. Run `npm run prisma:generate`.
4. Apply migrations with `npm run prisma:migrate`.
5. Seed local data with `npm run prisma:seed`.
6. Run `npm run build` and `npm run test` before handing work to the dashboard team.
7. Check Swagger at `/api/docs` for request and response shapes.

## Deployment Notes

- Set strong production values for `JWT_SECRET` and `DATABASE_URL`.
- Run Prisma migrations before starting the app.
- Serve the `uploads/` directory behind your chosen static file strategy or replace local storage with external storage in a future infrastructure task.
- Use HTTPS and strict CORS for production clients.
- The MVP currently uses Cash on Delivery. External payment providers, email/SMS, and advanced merchandising can be added later.
