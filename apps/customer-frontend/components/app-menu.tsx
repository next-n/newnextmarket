"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { customerRequest } from "@/lib/customer-api";

export function AppMenu() {
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      customerRequest<{ items: any[] }>("/collections?limit=50"),
    ]).then(([collectionData]) => {
      setCollections(collectionData.items ?? []);
    }).catch(() => undefined);
  }, []);

  const close = () => setOpen(false);
  return <span className="app-menu"><button type="button" className="apps-grid" onClick={() => setOpen((value) => !value)} aria-label="Open storefront menu" aria-expanded={open}>{Array.from({ length: 9 }, (_, index) => <i key={index} />)}</button>{open ? <span className="app-dropdown"><span className="app-menu-section"><strong className="app-menu-title">Products</strong><Link href="/products" onClick={close}>Shop all products</Link></span><span className="app-menu-section"><strong className="app-menu-title">Collections</strong><Link href="/collections" onClick={close}>Shop all collections</Link>{collections.map((collection) => <Link key={collection.id} href={`/collections/${collection.slug}`} onClick={close}>{collection.name}</Link>)}</span></span> : null}</span>;
}
