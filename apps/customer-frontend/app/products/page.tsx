import { ProductCard } from "@/components/product-card";
import { SiteHeader } from "@/components/site-header";
import { getApi, type StoreProduct } from "@/lib/api";

export default async function ProductsPage({ searchParams }: { searchParams?: Promise<{ category?: string }> }) {
  const category = (await searchParams)?.category;
  const data = await getApi<{ items: StoreProduct[] }>(`/products?limit=50${category ? `&categorySlug=${encodeURIComponent(category)}` : ""}`);
  return <><SiteHeader /><main className="container section"><div className="section-heading"><div><span className="eyebrow">Catalog</span><h1>{category ? `Shop ${category.replaceAll("-", " ")}` : "Shop all products"}</h1><p className="muted">Find the right fit for every day.</p></div></div><div className="product-grid">{data.items.map((product) => <ProductCard key={product.id} product={{ name: product.name, slug: product.slug, basePrice: Number(product.basePrice), minPrice: product.priceRange?.minSalePrice ?? Number(product.basePrice), imageUrl: product.images?.[0]?.url }} />)}</div></main></>;
}
