import { notFound } from "next/navigation";
import { ProductCard } from "@/components/product-card";
import { SiteHeader } from "@/components/site-header";
import { getApi } from "@/lib/api";

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let collection: any;
  try { collection = await getApi<any>(`/collections/${slug}`); } catch { notFound(); }
  return <><SiteHeader /><main className="container section"><span className="eyebrow">Collection</span><h1>{collection.name}</h1><p className="muted">{collection.description ?? "Explore this collection."}</p><div className="product-grid">{(collection.products ?? []).map((item: any) => { const product = item.product; return <ProductCard key={product.id} product={{ name: product.name, slug: product.slug, basePrice: Number(product.basePrice), minPrice: product.priceRange?.minSalePrice ?? Number(product.basePrice), imageUrl: product.images?.[0]?.url }} />; })}</div>{!collection.products?.length ? <p className="muted">No products in this collection yet.</p> : null}</main></>;
}
