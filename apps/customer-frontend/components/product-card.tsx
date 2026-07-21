import Link from "next/link";
import { resolveAssetUrl } from "@/lib/api";

type ProductCardProps = { product: { name: string; slug: string; basePrice: number | string | null; minPrice: number | string | null; imageUrl?: string | null } };

export function ProductCard({ product }: ProductCardProps) {
  const basePrice = product.basePrice == null ? null : Number(product.basePrice);
  const minPrice = product.minPrice == null ? basePrice : Number(product.minPrice);
  const onSale = minPrice != null && basePrice != null && minPrice < basePrice;
  const displayPrice = minPrice == null ? "Price unavailable" : `$${minPrice.toFixed(2)}`;

  return <Link href={`/products/${product.slug}`} className="product-card"><img className="product-image" src={resolveAssetUrl(product.imageUrl) || "https://placehold.co/700x700/e5e7eb/6b7280?text=Product"} alt={product.name} /><div className="product-info"><h3>{product.name}</h3><span className={onSale ? "price sale" : "price"}>{displayPrice}</span>{onSale ? <span className="muted"> · sale</span> : null}</div></Link>;
}
