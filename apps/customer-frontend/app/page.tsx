import Link from "next/link";

import { ProductCard } from "@/components/product-card";
import { BannerCarousel } from "@/components/banner-carousel";
import { SiteHeader } from "@/components/site-header";
import { getApi, type HomeData } from "@/lib/api";

export default async function HomePage() {
  const data = await getApi<HomeData>("/homepage");

  return <><SiteHeader /><main className="container"><BannerCarousel banners={data.banners} />{(data.collections ?? []).map((collection) => <section className="section" key={collection.id}><div className="section-heading"><div><h2>{collection.name}</h2><p className="muted">{collection.description ?? "Explore this collection."}</p></div><Link href={`/collections/${collection.slug}`}>View all</Link></div><div className="product-grid">{(collection.products ?? []).map((product) => <ProductCard key={product.id} product={product} />)}</div></section>)}</main><footer className="footer">Storefront · Move comfortably.</footer></>;
}
