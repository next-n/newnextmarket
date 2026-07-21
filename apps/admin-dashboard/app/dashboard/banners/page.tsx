"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";

const emptyForm = { title: "", imageUrl: "", buttonText: "", collectionId: "" };

export default function BannersPage() {
  const [banners, setBanners] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const [bannerResponse, collectionResponse] = await Promise.all([
      apiClient.get<any>(API_ENDPOINTS.banners, { params: { limit: 50 } }),
      apiClient.get<any>(API_ENDPOINTS.collections, { params: { limit: 100, status: "ACTIVE" } }),
    ]);
    setBanners(bannerResponse.data.data.items ?? []);
    setCollections(collectionResponse.data.data.items ?? []);
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load().catch(() => setMessage("Unable to load banners and collections")); }, []);

  function edit(banner: any) {
    setEditingId(banner.id);
    setForm({ title: banner.title ?? "", imageUrl: banner.imageUrl ?? "", buttonText: banner.buttonText ?? "", collectionId: banner.collectionId ?? "" });
    setMessage("");
  }

  function cancelEdit() { setEditingId(null); setForm(emptyForm); setMessage(""); }

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage("");
    try {
      const payload = { ...form, collectionId: form.collectionId || undefined };
      if (editingId) { await apiClient.patch(`${API_ENDPOINTS.banners}/${editingId}`, payload); setMessage("Banner updated"); }
      else { await apiClient.post(API_ENDPOINTS.banners, { ...payload, status: "ACTIVE" }); setMessage("Banner created"); }
      setEditingId(null); setForm(emptyForm); await load();
    } catch (error: any) { setMessage(error?.response?.data?.message ?? `Unable to ${editingId ? "update" : "create"} banner`); }
    finally { setSaving(false); }
  }

  return <section className="space-y-6"><div><h1 className="text-2xl font-semibold">Banners</h1><p className="mt-1 text-sm text-muted-foreground">Manage homepage promotional content and connect banners to collections.</p></div><form onSubmit={save} className="grid gap-3 rounded-lg border bg-card p-5 md:grid-cols-5"><input required placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-10 rounded-md border bg-background px-3 text-sm" /><input required placeholder="Image URL" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} className="h-10 rounded-md border bg-background px-3 text-sm" /><input placeholder="Button text" value={form.buttonText} onChange={(e) => setForm({ ...form, buttonText: e.target.value })} className="h-10 rounded-md border bg-background px-3 text-sm" /><select value={form.collectionId} onChange={(e) => setForm({ ...form, collectionId: e.target.value })} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="">No collection</option>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select><div className="flex gap-2"><button disabled={saving} className="h-10 flex-1 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">{saving ? "Saving..." : editingId ? "Save changes" : "Create banner"}</button>{editingId ? <button type="button" disabled={saving} onClick={cancelEdit} className="h-10 rounded-md border px-4 text-sm">Cancel</button> : null}</div></form>{message ? <p className="text-sm text-muted-foreground">{message}</p> : null}<div className="overflow-hidden rounded-lg border bg-card"><table className="w-full text-left text-sm"><thead className="border-b bg-muted/50"><tr><th className="p-4">Title</th><th className="p-4">Collection</th><th className="p-4">Image</th><th className="p-4">Status</th><th className="p-4 text-right">Actions</th></tr></thead><tbody>{banners.map((banner) => <tr key={banner.id} className="border-b last:border-0"><td className="p-4 font-medium">{banner.title}</td><td className="p-4">{banner.collection?.name ?? "—"}</td><td className="max-w-md truncate p-4">{banner.imageUrl}</td><td className="p-4">{banner.status}</td><td className="p-4 text-right"><button type="button" onClick={() => edit(banner)} className="font-medium text-primary hover:underline">Edit</button></td></tr>)}</tbody></table></div></section>;
}
