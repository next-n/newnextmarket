# NewNextMarket Admin Dashboard

Next.js admin dashboard for managing the ecommerce MVP.

## Current features

- Admin authentication
- Product creation and product-name editing
- Product image upload and replacement
- Variant creation and editing
- Inventory and stock adjustments
- Collections and homepage visibility/order controls
- Banner management and collection linking
- Order status management
- Customer list and dashboard metrics

Coupons, reviews, reports, and settings are currently not exposed in the admin navigation for the MVP.

## Tech stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Axios
- Lucide React

## Environment

Create `.env` from `.env.example`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_APP_NAME=NewNextMarket Admin
```

## Development and build

```bash
npm run dev
npm run build
```
