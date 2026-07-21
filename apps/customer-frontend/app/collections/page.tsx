import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getApi } from "@/lib/api";

export default async function CollectionsPage() {
  const data = await getApi<{ items: { id: string; name: string; slug: string; description?: string | null; productCount?: number }[] }>("/collections?limit=50");

  return <><SiteHeader /><main className="container section"><div className="section-heading"><div><span className="eyebrow">Catalog</span><h1>Shop all collections</h1><p className="muted">Explore products grouped for the way you shop.</p></div></div><div className="account-grid">{data.items.map((collection) => <Link key={collection.id} href={`/collections/${collection.slug}`} className="account-card"><h2>{collection.name}</h2><p className="muted">{collection.description ?? "Explore this collection."}</p><span className="account-link">{collection.productCount ?? 0} products →</span></Link>)}</div>{!data.items.length ? <p className="muted">No collections available.</p> : null}</main></>;
}
