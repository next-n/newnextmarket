# API Summary

All paths are mounted under `/api`. Public routes do not require a token. Customer routes require a customer bearer token. Admin routes require an admin bearer token.

## Auth

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/register` | Public | Register a customer account. |
| POST | `/auth/login` | Public | Login a customer and return tokens. |
| POST | `/auth/logout` | Customer | Clear the customer refresh token. |
| POST | `/auth/refresh-token` | Public | Rotate a customer refresh token. |
| POST | `/auth/forgot-password` | Public | Start the MVP password reset flow. |
| POST | `/auth/reset-password` | Public | Complete the MVP password reset flow. |
| GET | `/auth/me` | Customer | Return the current customer profile. |

## Admin Auth

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/admin/auth/login` | Public | Login an admin and return roles, permissions, and tokens. |
| POST | `/admin/auth/logout` | Admin | Clear the admin refresh token. |
| GET | `/admin/auth/me` | Admin | Return the current admin profile. |

## Catalog

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/categories` | Public | List active categories. |
| GET | `/categories/:slug` | Public | Get an active category by slug. |
| GET | `/collections` | Public | List active collections. |
| GET | `/collections/:slug` | Public | Get an active collection by slug. |
| GET | `/products` | Public | List active products with pagination and filters. |
| GET | `/products/search?q=running` | Public | Search active products. |
| GET | `/products/:slug` | Public | Get active product detail. |
| GET | `/admin/categories` | Admin | List categories. |
| POST | `/admin/categories` | Admin | Create category. |
| GET | `/admin/categories/:id` | Admin | Get category. |
| PATCH | `/admin/categories/:id` | Admin | Update category. |
| DELETE | `/admin/categories/:id` | Admin | Soft-delete category. |
| GET | `/admin/collections` | Admin | List collections. |
| POST | `/admin/collections` | Admin | Create collection. |
| GET | `/admin/collections/:id` | Admin | Get collection. |
| PATCH | `/admin/collections/:id` | Admin | Update collection. |
| DELETE | `/admin/collections/:id` | Admin | Soft-delete collection. |
| POST | `/admin/collections/:id/products` | Admin | Add product to collection. |
| DELETE | `/admin/collections/:id/products/:productId` | Admin | Remove product from collection. |
| GET | `/admin/products` | Admin | List products. |
| POST | `/admin/products` | Admin | Create product. |
| GET | `/admin/products/:id` | Admin | Get product. |
| PATCH | `/admin/products/:id` | Admin | Update product. |
| DELETE | `/admin/products/:id` | Admin | Soft-delete product. |
| GET | `/admin/products/:productId/variants` | Admin | List variants for a product. |
| POST | `/admin/products/:productId/variants` | Admin | Create product variant. |
| PATCH | `/admin/variants/:id` | Admin | Update product variant. |
| DELETE | `/admin/variants/:id` | Admin | Soft-disable product variant. |
| GET | `/admin/inventory` | Admin | List inventory. |
| GET | `/admin/inventory/:variantId` | Admin | Get variant inventory. |
| PATCH | `/admin/inventory/:variantId` | Admin | Update inventory fields. |
| POST | `/admin/inventory/:variantId/adjust` | Admin | Adjust stock and create inventory log. |

## Cart

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/cart` | Customer | Get or create active cart. |
| POST | `/cart/items` | Customer | Add item to cart. |
| PATCH | `/cart/items/:id` | Customer | Update cart item quantity. |
| DELETE | `/cart/items/:id` | Customer | Remove cart item. |
| DELETE | `/cart` | Customer | Clear active cart. |
| POST | `/cart/apply-coupon` | Customer | Apply a coupon to the active cart. |
| DELETE | `/cart/remove-coupon` | Customer | Remove the active cart coupon. |

## Checkout

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/checkout/validate` | Customer | Validate cart, stock, coupon, and totals. |
| POST | `/checkout/shipping-rate` | Customer | Return standard and express shipping options. |
| POST | `/checkout/create-order` | Customer | Create order, order items, payment, and shipment. |
| POST | `/checkout/confirm-payment` | Customer | Confirm mock payment and reduce stock idempotently. |

## Orders

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/orders` | Customer | List current customer's orders. |
| GET | `/orders/:id` | Customer | Get current customer's order detail. |
| POST | `/orders/:id/cancel` | Customer | Cancel an eligible customer order. |
| GET | `/admin/orders` | Admin | List and filter all orders. |
| GET | `/admin/orders/:id` | Admin | Get order detail. |
| PATCH | `/admin/orders/:id/status` | Admin | Update order status. |
| POST | `/admin/orders/:id/cancel` | Admin | Cancel eligible order. |
| POST | `/admin/orders/:id/refund` | Admin | Refund paid order. |

## Payments

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/payments/:id` | Customer | Get customer's payment detail. |
| POST | `/payments/create` | Customer | Create mock payment for an order. |
| POST | `/payments/confirm` | Customer | Confirm mock payment. |
| GET | `/admin/payments` | Admin | List payments. |
| GET | `/admin/payments/:id` | Admin | Get payment detail. |
| POST | `/admin/payments/:id/refund` | Admin | Create full or partial refund. |

## Shipping

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/shipping/methods` | Public | List standard and express methods. |
| POST | `/shipping/calculate` | Public | Calculate shipping rates. |
| GET | `/admin/shipments` | Admin | List shipments. |
| GET | `/admin/shipments/:id` | Admin | Get shipment detail. |
| PATCH | `/admin/shipments/:id` | Admin | Update tracking, method, carrier, or status. |

## Returns

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/returns` | Customer | Create return request for a delivered order. |
| GET | `/returns` | Customer | List current customer's returns. |
| GET | `/returns/:id` | Customer | Get current customer's return detail. |
| GET | `/admin/returns` | Admin | List returns. |
| GET | `/admin/returns/:id` | Admin | Get return detail. |
| PATCH | `/admin/returns/:id/status` | Admin | Update return status. |

## Coupons

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/coupons/validate` | Public | Validate a coupon against a subtotal. |
| GET | `/admin/coupons` | Admin | List coupons. |
| POST | `/admin/coupons` | Admin | Create coupon. |
| GET | `/admin/coupons/:id` | Admin | Get coupon. |
| PATCH | `/admin/coupons/:id` | Admin | Update coupon. |
| DELETE | `/admin/coupons/:id` | Admin | Soft-disable coupon. |

## Banners And Homepage

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/banners` | Public | List active banners. |
| GET | `/homepage` | Public | Return banners, featured products, new arrivals, and collections. |
| GET | `/admin/banners` | Admin | List banners. |
| POST | `/admin/banners` | Admin | Create banner. |
| GET | `/admin/banners/:id` | Admin | Get banner. |
| PATCH | `/admin/banners/:id` | Admin | Update banner. |
| DELETE | `/admin/banners/:id` | Admin | Soft-delete banner. |

## Reviews

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/products/:productId/reviews` | Public | List approved product reviews. |
| POST | `/products/:productId/reviews` | Customer | Create product review. |
| GET | `/admin/reviews` | Admin | List reviews. |
| GET | `/admin/reviews/:id` | Admin | Get review. |
| PATCH | `/admin/reviews/:id/status` | Admin | Approve or reject review. |
| DELETE | `/admin/reviews/:id` | Admin | Soft-delete review. |

## Wishlist

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/wishlist` | Customer | Get current customer's wishlist. |
| POST | `/wishlist/:productId` | Customer | Add product to wishlist. |
| DELETE | `/wishlist/:productId` | Customer | Remove product from wishlist. |

## Uploads

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/admin/uploads/image` | Admin | Upload a general image. |
| POST | `/admin/uploads/product-image` | Admin | Upload a product image. |
| POST | `/admin/uploads/banner-image` | Admin | Upload a banner image. |
| GET | `/admin/uploads` | Admin | List uploads. |
| DELETE | `/admin/uploads/:id` | Admin | Soft-delete upload record. |

## Reports

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/admin/reports/overview` | Admin | Dashboard metrics overview. |
| GET | `/admin/reports/sales` | Admin | Revenue by date. |
| GET | `/admin/reports/orders` | Admin | Orders and status breakdown. |
| GET | `/admin/reports/products` | Admin | Best sellers and inventory summary. |
| GET | `/admin/reports/customers` | Admin | Customers by date. |

## Settings

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/settings` | Public | Return safe public settings. |
| GET | `/admin/settings` | Admin | Return all settings. |
| PATCH | `/admin/settings` | Admin | Update settings. |

## Notifications

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/notifications` | Customer | List current customer's notifications. |
| PATCH | `/notifications/:id/read` | Customer | Mark current customer's notification as read. |
| GET | `/admin/notifications` | Admin | List notifications. |
| POST | `/admin/notifications` | Admin | Create notification for one or all customers. |

## Audit Logs

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/admin/audit-logs` | Admin | List audit logs with filters and pagination. |
