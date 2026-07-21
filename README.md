# SPORTWEAR

Monorepo for the Sportwear ecommerce platform.

The validated NestJS backend lives in `apps/backend-api`. The Next.js admin dashboard foundation lives in `apps/admin-dashboard`. The customer frontend and shared package folders are prepared as placeholders for future work.

## Structure

```text
SPORTWEAR/
├── apps/
│   ├── backend-api/
│   ├── admin-dashboard/
│   └── customer-frontend/
├── packages/
│   └── shared/
├── package.json
├── .gitignore
└── README.md
```

## Backend API

Backend app path:

```text
apps/backend-api
```

Backend docs:

- `apps/backend-api/README.md`
- `apps/backend-api/docs/api-summary.md`
- `apps/backend-api/docs/backend-checklist.md`

## Root Scripts

Run from the monorepo root:

```bash
npm run backend:dev
npm run backend:build
npm run backend:test
npm run backend:generate
npm run backend:migrate
npm run backend:seed
npm run backend:studio
npm run admin:dev
npm run admin:build
npm run admin:start
npm run admin:lint
```

## Backend Local Setup

```bash
cd apps/backend-api
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Swagger remains available at:

```text
http://localhost:3000/api/docs
```

## Future Apps

- `apps/admin-dashboard`: Next.js admin dashboard foundation.
- `apps/customer-frontend`: reserved for the customer storefront.
- `packages/shared`: reserved for shared TypeScript utilities, types, or schemas.
