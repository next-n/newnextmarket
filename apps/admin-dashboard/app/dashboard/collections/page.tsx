"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";

export default function CollectionsPage() {
  const [collections, setCollections] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", slug: "", description: "" });
  const [productId, setProductId] = useState("");
  const [selectedCollection, setSelectedCollection] = useState("");
  const [message, setMessage] = useState("");
  const [priorityDrafts, setPriorityDrafts] = useState<Record<string, string>>({});

  async function load() {
    const [collectionResponse, productResponse] = await Promise.all([
      apiClient.get<any>(API_ENDPOINTS.collections, { params: { limit: 100 } }),
      apiClient.get<any>(API_ENDPOINTS.products, { params: { limit: 100 } }),
    ]);
    setCollections(collectionResponse.data.data.items ?? []);
    setProducts(productResponse.data.data.items ?? []);
  }

  useEffect(() => { load().catch(() => setMessage("Unable to load collections")); }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    try {
      await apiClient.post(API_ENDPOINTS.collections, { ...form, status: "ACTIVE" });
      setForm({ name: "", slug: "", description: "" });
      setMessage("Collection created");
      await load();
    } catch (error: any) { setMessage(error?.response?.data?.message ?? "Unable to create collection"); }
  }

  async function updateHomepage(collection: any, showOnHomepage: boolean, homepagePriority: number) {
    try {
      await apiClient.patch(`${API_ENDPOINTS.collections}/${collection.id}`, { showOnHomepage, homepagePriority });
      setMessage(`${collection.name} homepage settings updated`);
      await load();
    } catch (error: any) { setMessage(error?.response?.data?.message ?? "Unable to update homepage settings"); }
  }

  async function commitPriority(collection: any, value: string) {
    if (value.trim() === "") {
      setPriorityDrafts((drafts) => {
        const next = { ...drafts };
        delete next[collection.id];
        return next;
      });
      return;
    }

    const priority = Math.max(0, Number.parseInt(value, 10) || 0);
    setPriorityDrafts((drafts) => {
      const next = { ...drafts };
      delete next[collection.id];
      return next;
    });
    await updateHomepage(collection, Boolean(collection.showOnHomepage), priority);
  }

  async function addProduct() {
    if (!selectedCollection || !productId) return;
    try {
      await apiClient.post(`${API_ENDPOINTS.collections}/${selectedCollection}/products`, { productId });
      setProductId(""); setMessage("Product added to collection"); await load();
    } catch (error: any) { setMessage(error?.response?.data?.message ?? "Unable to add product"); }
  }

  async function removeProduct(collectionId: string, id: string) {
    try { await apiClient.delete(`${API_ENDPOINTS.collections}/${collectionId}/products/${id}`); setMessage("Product removed"); await load(); }
    catch (error: any) { setMessage(error?.response?.data?.message ?? "Unable to remove product"); }
  }

  return <section className="space-y-6"><div><h1 className="text-2xl font-semibold">Collections</h1><p className="mt-1 text-sm text-muted-foreground">Create collections, connect products, and control homepage order.</p></div><form onSubmit={create} className="grid gap-3 rounded-lg border bg-card p-5 md:grid-cols-4"><input required placeholder="Collection name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 rounded-md border bg-background px-3 text-sm" /><input required placeholder="Slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="h-10 rounded-md border bg-background px-3 text-sm" /><input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="h-10 rounded-md border bg-background px-3 text-sm" /><button className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Create collection</button></form><div className="grid gap-3 rounded-lg border bg-card p-5 md:grid-cols-[1fr_1fr_auto]"><select value={selectedCollection} onChange={(e) => setSelectedCollection(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="">Choose collection</option>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select><select value={productId} onChange={(e) => setProductId(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="">Choose product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select><button type="button" onClick={addProduct} className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Add product</button></div>{message ? <p className="text-sm text-muted-foreground">{message}</p> : null}<div className="space-y-4">{[...collections].sort((a, b) => Number(a.homepagePriority ?? 0) - Number(b.homepagePriority ?? 0)).map((collection) => { const priorityValue = priorityDrafts[collection.id] ?? String(collection.homepagePriority ?? 0); return <section key={collection.id} className="rounded-lg border bg-card p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-semibold">{collection.name}</h2><p className="text-sm text-muted-foreground">/{collection.slug} · {collection.productCount ?? collection.products?.length ?? 0} products</p></div><div className="flex items-center gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(collection.showOnHomepage)} onChange={(e) => updateHomepage(collection, e.target.checked, Number(collection.homepagePriority ?? 0))} /> Show on homepage</label><label className="flex items-center gap-2 text-sm">Priority<input type="number" min="0" value={priorityValue} onChange={(e) => setPriorityDrafts((drafts) => ({ ...drafts, [collection.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }} onBlur={(e) => void commitPriority(collection, e.target.value)} className="h-9 w-20 rounded-md border bg-background px-2" /></label></div></div><div className="mt-4 space-y-2">{(collection.products ?? []).map((item: any) => <div key={item.product.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"><span>{item.product.name}</span><button type="button" onClick={() => removeProduct(collection.id, item.product.id)} className="text-destructive hover:underline">Remove</button></div>)}{!collection.products?.length ? <p className="text-sm text-muted-foreground">No products assigned.</p> : null}</div></section>; })}</div></section>;
}
