"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";

import { apiClient, resolveAssetUrl } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";

const emptyForm = { name: "", slug: "", basePrice: "", status: "ACTIVE", gender: "UNISEX" };

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [image, setImage] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function load() {
    const response = await apiClient.get<any>(API_ENDPOINTS.products, { params: { limit: 50 } });
    setProducts(response.data.data.items ?? []);
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load().catch(() => setMessage("Unable to load products")); }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setSaving(true);
    try {
      const response = await apiClient.post<any>(API_ENDPOINTS.products, { ...form, basePrice: Number(form.basePrice) });
      const createdProduct = response.data.data;
      let uploadedImage: any;
      if (image) {
        const upload = new FormData();
        upload.append("file", image);
        upload.append("productId", response.data.data.id);
        const uploadResponse = await apiClient.post<any>(API_ENDPOINTS.uploads.productImage, upload);
        uploadedImage = uploadResponse.data.data;
      }

      // Update the visible list immediately after the product and image are complete.
      setProducts((current) => [
        { ...createdProduct, images: uploadedImage ? [uploadedImage] : [] },
        ...current.filter((product) => product.id !== createdProduct.id),
      ]);
      setForm(emptyForm);
      setImage(null);
      formRef.current?.reset();
      setMessage("Product created");

      // Keep the button loading until the authoritative list refresh completes.
      try {
        await load();
      } catch {
        setMessage("Product created, but the product list could not refresh. Reload the page to see it.");
      }
    } catch (error: any) {
      if (error?.response?.status === 409) {
        setMessage("A product with this slug already exists. Check the product list before trying again, or use a different slug.");
      } else {
        const detail = Array.isArray(error?.response?.data?.errors) ? error.response.data.errors.join(", ") : error?.response?.data?.message;
        setMessage(detail ?? "Unable to create product");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <div><h1 className="text-2xl font-semibold">Products</h1><p className="mt-1 text-sm text-muted-foreground">Create products, then manage their variants and stock.</p></div>
      <form ref={formRef} onSubmit={create} aria-busy={saving} className="grid gap-3 rounded-lg border bg-card p-5 md:grid-cols-6">
        <input required placeholder="Product name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 rounded-md border bg-background px-3 text-sm" />
        <input required placeholder="Slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="h-10 rounded-md border bg-background px-3 text-sm" />
        <input required type="number" min="0" step="0.01" placeholder="Base price" value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} className="h-10 rounded-md border bg-background px-3 text-sm" />
        <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="h-10 rounded-md border bg-background px-3 text-sm"><option>UNISEX</option><option>MEN</option><option>WOMEN</option><option>KIDS</option></select>
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setImage(e.target.files?.[0] ?? null)} className="h-10 rounded-md border bg-background px-3 py-2 text-sm" />
        <button type="submit" disabled={saving} className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-wait disabled:opacity-50">{saving ? (image ? "Creating & uploading..." : "Creating...") : "Create product"}</button>
      </form>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="w-full text-left text-sm"><thead className="border-b bg-muted/50"><tr><th className="p-4">Image</th><th className="p-4">Name</th><th className="p-4">Status</th><th className="p-4">Price</th><th className="p-4">Variants</th><th className="p-4 text-right">Manage</th></tr></thead>
          <tbody>{products.map((product) => <tr key={product.id} className="border-b last:border-0"><td className="p-4">{product.images?.[0]?.url ? <img src={resolveAssetUrl(product.images[0].url)} alt="" className="h-12 w-12 rounded-md object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted text-[10px] text-muted-foreground">No image</div>}</td><td className="p-4 font-medium">{product.name}<div className="text-xs text-muted-foreground">{product.slug}</div></td><td className="p-4">{product.status}</td><td className="p-4">{product.basePrice == null ? "—" : `$${Number(product.basePrice).toFixed(2)}`}</td><td className="p-4">{product.variants?.length ?? 0}</td><td className="p-4 text-right"><div className="flex justify-end gap-3"><Link href={`/dashboard/products/${product.id}`} className="text-sm font-medium text-primary hover:underline">Manage variants</Link><Link href={`/dashboard/inventory?productId=${product.id}&productName=${encodeURIComponent(product.name)}`} className="text-sm font-medium text-primary hover:underline">Inventory</Link></div></td></tr>)}</tbody>
        </table>
        {products.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No products found.</p> : null}
      </div>
    </section>
  );
}
