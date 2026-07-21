"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";

type Variant = { id: string; sku: string; identifier?: string | null; size?: string; width?: string; color?: string; price: number | string; salePrice: number | string | null; stock: number; lowStockThreshold: number; status: string };
type ProductImage = { id: string; url: string; altText?: string };
const emptyForm = { identifier: "", size: "", width: "", color: "", price: "", salePrice: "", stock: "", lowStockThreshold: "", status: "ACTIVE" };

export default function ProductVariantsPage() {
  const params = useParams<{ id: string }>();
  const productId = params.id;
  const [product, setProduct] = useState<any>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [savingImage, setSavingImage] = useState(false);
  const [productName, setProductName] = useState("");
  const [savingProduct, setSavingProduct] = useState(false);

  async function load() {
    const [productResponse, variantsResponse] = await Promise.all([
      apiClient.get<any>(`${API_ENDPOINTS.products}/${productId}`),
      apiClient.get<any>(API_ENDPOINTS.productVariants(productId)),
    ]);
    setProduct(productResponse.data.data);
    setProductName(productResponse.data.data?.name ?? "");
    setVariants(variantsResponse.data.data ?? []);
  }

  useEffect(() => { load().catch(() => setMessage("Unable to load product variants")); }, [productId]);

  function edit(variant: Variant) {
    setEditingId(variant.id);
    setForm({ identifier: variant.identifier ?? variant.sku, size: variant.size ?? "", width: variant.width ?? "", color: variant.color ?? "", price: String(variant.price), salePrice: variant.salePrice == null ? "" : String(variant.salePrice), stock: String(variant.stock), lowStockThreshold: String(variant.lowStockThreshold ?? ""), status: variant.status });
  }

  async function saveProductName(event: FormEvent) {
    event.preventDefault();
    const name = productName.trim();
    if (!name || name === product?.name) return;
    setSavingProduct(true); setMessage("");
    try {
      const response = await apiClient.patch(`${API_ENDPOINTS.products}/${productId}`, { name });
      setProduct(response.data.data); setProductName(response.data.data?.name ?? name); setMessage("Product name updated");
    } catch (error: any) { setMessage(error?.response?.data?.message ?? "Unable to update product name"); }
    finally { setSavingProduct(false); }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    try {
      const body = { identifier: form.identifier.trim(), ...(form.size.trim() ? { size: form.size.trim() } : {}), ...(form.width.trim() ? { width: form.width.trim() } : {}), ...(form.color.trim() ? { color: form.color.trim() } : {}), price: Number(form.price), salePrice: form.salePrice ? Number(form.salePrice) : undefined, stock: Number(form.stock), ...(form.lowStockThreshold ? { lowStockThreshold: Number(form.lowStockThreshold) } : {}) };
      if (editingId) await apiClient.patch(API_ENDPOINTS.variant(editingId), body); else await apiClient.post(API_ENDPOINTS.productVariants(productId), body);
      setForm(emptyForm); setEditingId(null); setMessage(editingId ? "Variant updated" : "Variant added"); await load();
    } catch (error: any) { setMessage(error?.response?.data?.message ?? "Unable to save variant"); }
  }

  async function uploadProductImage() {
    if (!image) return;
    setSavingImage(true); setMessage("");
    try {
      const previousImages: ProductImage[] = product?.images ?? [];
      const body = new FormData(); body.append("file", image); body.append("productId", productId);
      await apiClient.post(API_ENDPOINTS.uploads.productImage, body);
      await Promise.all(previousImages.map((oldImage) => apiClient.delete(API_ENDPOINTS.uploads.delete(oldImage.id))));
      setImage(null); setMessage("Product image updated"); await load();
    } catch (error: any) { setMessage(error?.response?.data?.message ?? "Unable to update product image"); }
    finally { setSavingImage(false); }
  }

  async function discontinue(id: string) {
    if (!window.confirm("Discontinue this variant?")) return;
    try { await apiClient.delete(API_ENDPOINTS.variant(id)); setMessage("Variant discontinued"); await load(); }
    catch (error: any) { setMessage(error?.response?.data?.message ?? "Unable to discontinue variant"); }
  }

  const imageUrl = product?.images?.[0]?.url;
  return <section className="space-y-6">
    <div><Link href="/dashboard/products" className="text-sm text-primary hover:underline">← Products</Link><h1 className="mt-3 text-2xl font-semibold">{product?.name ?? "Product"}</h1><p className="mt-1 text-sm text-muted-foreground">Manage the product image and its variants.</p></div>
    <form onSubmit={saveProductName} className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-5"><label className="grid min-w-[260px] flex-1 gap-2 text-sm font-medium"><span>Product name</span><input required maxLength={180} value={productName} onChange={(event) => setProductName(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm font-normal" /></label><button type="submit" disabled={savingProduct || !productName.trim() || productName.trim() === product?.name} className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">{savingProduct ? "Saving..." : "Save name"}</button></form>
    <div className="grid gap-5 rounded-lg border bg-card p-5 md:grid-cols-[180px_1fr]"><div>{imageUrl ? <img src={imageUrl} alt={product?.name ?? "Product"} className="aspect-square w-full rounded-md object-cover" /> : <div className="flex aspect-square items-center justify-center rounded-md bg-muted text-center text-xs text-muted-foreground">No product image</div>}</div><div className="space-y-3"><div><h2 className="font-semibold">Product image</h2><p className="text-sm text-muted-foreground">Upload a replacement image. JPG, PNG, or WebP up to 5 MB.</p></div><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImage(event.target.files?.[0] ?? null)} className="block w-full rounded-md border bg-background px-3 py-2 text-sm" /><button type="button" disabled={!image || savingImage} onClick={uploadProductImage} className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">{savingImage ? "Uploading…" : "Update product image"}</button></div></div>
    <form onSubmit={save} className="grid gap-3 rounded-lg border bg-card p-5 md:grid-cols-4"><input required placeholder="Variant identifier" value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} className="h-10 rounded-md border bg-background px-3 text-sm" /><input placeholder="Size (optional)" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} className="h-10 rounded-md border bg-background px-3 text-sm" /><input placeholder="Width (optional)" value={form.width} onChange={(e) => setForm({ ...form, width: e.target.value })} className="h-10 rounded-md border bg-background px-3 text-sm" /><input placeholder="Color (optional)" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-10 rounded-md border bg-background px-3 text-sm" /><input required type="number" min="0" step="0.01" placeholder="Price (required)" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="h-10 rounded-md border bg-background px-3 text-sm" /><input type="number" min="0" step="0.01" placeholder="Sale price (optional)" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} className="h-10 rounded-md border bg-background px-3 text-sm" /><input required type="number" min="0" placeholder="Stock (required)" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="h-10 rounded-md border bg-background px-3 text-sm" /><input type="number" min="0" placeholder="Low stock threshold" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })} className="h-10 rounded-md border bg-background px-3 text-sm" /><div className="flex gap-2 md:col-span-4"><button type="submit" className="h-10 cursor-pointer rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">{editingId ? "Save variant" : "Add variant"}</button>{editingId ? <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }} className="h-10 rounded-md border px-4 text-sm">Cancel</button> : null}</div></form>
    {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    <div className="overflow-hidden rounded-lg border bg-card"><table className="w-full text-left text-sm"><thead className="border-b bg-muted/50"><tr><th className="p-4">Identifier</th><th className="p-4">Options</th><th className="p-4">Price</th><th className="p-4">Stock</th><th className="p-4 text-right">Actions</th></tr></thead><tbody>{variants.map((variant) => <tr key={variant.id} className="border-b last:border-0"><td className="p-4 font-medium">{variant.identifier ?? variant.sku}</td><td className="p-4">{[variant.color, variant.size && `Size ${variant.size}`, variant.width && `Width ${variant.width}`].filter(Boolean).join(" · ") || "No options"}</td><td className="p-4">${Number(variant.salePrice ?? variant.price).toFixed(2)}</td><td className="p-4">{variant.stock}</td><td className="p-4 text-right"><button type="button" onClick={() => edit(variant)} className="mr-3 text-primary hover:underline">Edit</button><button type="button" onClick={() => discontinue(variant.id)} className="text-destructive hover:underline">Discontinue</button></td></tr>)}</tbody></table>{variants.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No variants yet.</p> : null}</div>
  </section>;
}
