import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductPurchase } from "@/components/product-purchase";
import { SiteHeader } from "@/components/site-header";
import { getApi, resolveAssetUrl, type StoreProduct } from "@/lib/api";

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let product: StoreProduct;
  try { product = await getApi<StoreProduct>(`/products/${slug}`, { fresh: true }); } catch { notFound(); }
  const image = product.images?.[0];
  return <><SiteHeader /><main className="container detail"><div><img className="detail-image" src={resolveAssetUrl(image?.url) || "https://placehold.co/900x900/e5e7eb/6b7280?text=Product"} alt={image?.altText || product.name} /></div><div><span className="eyebrow">Product</span><h1>{product.name}</h1><p className="muted">{product.subtitle}</p><p>{product.description}</p><p className="price">From ${Number(product.priceRange?.minSalePrice ?? product.priceRange?.minPrice ?? product.basePrice).toFixed(2)}</p><ProductPurchase product={product} /><Link href="/products" className="text-button back-link">Back to shop</Link></div></main></>;
}
