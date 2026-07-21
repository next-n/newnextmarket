# Sportwear Admin Dashboard

Next.js admin dashboard foundation for the Sportwear ecommerce platform. This app is a frontend shell only: it does not implement real admin login, product management, order management, or other business workflows yet.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui structure
- React Hook Form
- Zod
- TanStack Query
- Axios
- Lucide React
- ESLint

## Environment Setup

Create a local `.env` file from the example:

```bash
cp .env.example .env
```

Configure:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_APP_NAME=Sportwear Admin
```

`NEXT_PUBLIC_API_URL` should point to the NestJS backend API in `apps/backend-api`.

## Development

From the monorepo root:

```bash
npm run admin:dev
```

From this app folder:

```bash
npm run dev
```

## Build

From the monorepo root:

```bash
npm run admin:build
```

From this app folder:

```bash
npm run build
```

## Lint

```bash
npm run admin:lint
```

## Folder Structure

```text
app/
├── login/
└── dashboard/
components/
├── common/
├── layout/
└── ui/
hooks/
lib/
├── api/
└── auth/
providers/
types/
```

- `app/`: App Router layouts and placeholder pages.
- `components/layout/`: Dashboard sidebar, header, and shell.
- `components/ui/`: shadcn/ui-compatible components.
- `lib/api/`: Axios client, endpoint constants, and API response types.
- `lib/auth/`: Browser-safe token storage and auth helpers.
- `providers/`: TanStack Query provider.
- `hooks/`: Client hooks for future auth and data workflows.
