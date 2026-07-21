# Backend Checklist

Use this checklist before starting admin dashboard work or handing the API to another client app.

## Local Setup

- [ ] Run `npm install`.
- [ ] Copy `.env.example` to `.env`.
- [ ] Set `DATABASE_URL`.
- [ ] Set a non-default `JWT_SECRET`.
- [ ] Set `JWT_EXPIRES_IN`, `PORT`, `NODE_ENV`, and `CORS_ORIGIN`.

## Database Setup

- [ ] Confirm PostgreSQL is running.
- [ ] Confirm the database in `DATABASE_URL` exists.
- [ ] Run `npm run prisma:generate`.
- [ ] Run `npx prisma validate`.
- [ ] Run `npm run prisma:migrate`.
- [ ] Run `npm run prisma:seed`.
- [ ] Confirm the default admin login works: `admin@example.com` / `Admin123!`.

## Migration

- [ ] Create schema changes in `prisma/schema.prisma`.
- [ ] Generate a named migration with `npm run prisma:migrate -- --name your_migration_name`.
- [ ] Review `prisma/migrations/*/migration.sql`.
- [ ] Run migrations against a clean local database.
- [ ] Rerun seed after migrations.

## Tests

- [ ] Run `npm run build`.
- [ ] Run `npm run test`.
- [ ] Confirm cart, checkout, payment, refund, stock, and return tests remain green.
- [ ] Confirm support-module tests cover coupons, banners, reviews, wishlist, uploads, reports, settings, notifications, and audit logs.

## Swagger Verification

- [ ] Start the API with `npm run dev`.
- [ ] Open `http://localhost:3000/api/docs`.
- [ ] Confirm controller tags are grouped clearly.
- [ ] Confirm protected routes show bearer auth.
- [ ] Confirm DTOs and query params are visible.
- [ ] Confirm upload endpoints show `multipart/form-data` file input.

## Security Verification

- [ ] Customer routes reject missing or admin tokens.
- [ ] Admin routes reject missing or customer tokens.
- [ ] `password` and `refreshTokenHash` are not returned in API responses.
- [ ] Customers can access only their own cart, orders, payments, returns, wishlist, and notifications.
- [ ] Admin endpoints use `AdminJwtGuard`.
- [ ] Customer endpoints use `JwtAuthGuard`.
- [ ] Uploaded files reject invalid MIME types and oversized files.
- [ ] Cart and checkout totals are calculated from backend product and variant data.
- [ ] Checkout/payment confirmation is idempotent.
- [ ] Stock cannot go below zero.
- [ ] Refund amount cannot exceed paid amount minus prior refunds.

## MVP Handoff Readiness

- [ ] `docs/api-summary.md` matches the current controllers.
- [ ] README setup, migration, seed, and Swagger instructions are current.
- [ ] Default seed permissions include all admin resources used by dashboard routes.
- [ ] Admin support endpoints have permission metadata where applicable.
- [ ] Admin dashboard and customer storefront can authenticate against the API.
- [ ] Cash on Delivery checkout, stock deduction, order tracking, and admin order status updates work.
- [ ] Supabase Storage settings are configured for production image uploads.
- [ ] Real Stripe/PayPal, email/SMS, and advanced merchandising remain future enhancements.
