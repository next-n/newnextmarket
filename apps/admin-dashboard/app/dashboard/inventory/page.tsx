"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";

type InventoryItem = {
  variant: {
    id: string;
    sku: string;
    color?: string;
    size?: string;
    stock: number;
    lowStockThreshold: number;
    status: string;
  };
  product?: { name?: string };
  isLowStock?: boolean;
};

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [productName, setProductName] = useState("");
  const [lowStockFilter, setLowStockFilter] = useState(false);

  async function load(productId = productFilter) {
    const response = await apiClient.get<{ data: { items: InventoryItem[] } }>(API_ENDPOINTS.inventory, {
      params: { limit: 100, ...(productId ? { productId } : {}), ...(lowStockFilter ? { lowStock: true } : {}) },
    });
    setItems(response.data.data.items ?? []);
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get("productId") ?? "";
    setProductFilter(productId);
    setProductName(params.get("productName") ?? "");
    setLowStockFilter(params.get("lowStock") === "true");
    load(productId)
      .catch(() => setMessage("Unable to load inventory"))
      .finally(() => setLoading(false));
  }, [lowStockFilter]);

  async function adjust(variantId: string, quantity: number) {
    setBusyId(variantId);
    setMessage("");

    try {
      await apiClient.post(`${API_ENDPOINTS.inventory}/${variantId}/adjust`, {
        quantity,
        reason: "Admin dashboard adjustment",
      });
      setMessage("Inventory updated successfully");
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.message ?? "Unable to update inventory");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <p className="mt-1 text-sm text-muted-foreground">Adjust stock by product variant.</p>
        {(productName || lowStockFilter) ? <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-sm">Filtered to <strong>{lowStockFilter ? "low-stock variants" : productName}</strong> <Link href="/dashboard/inventory" className="text-primary hover:underline">Clear</Link></p> : null}
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="p-4">Product</th>
              <th className="p-4">SKU</th>
              <th className="p-4">Stock</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Adjust</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Loading inventory…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No inventory found.</td></tr>
            ) : (
              items.map((item, index) => {
                const variant = item.variant;
                const busy = busyId === variant.id;
                return (
                  <tr key={`${variant.id}-${index}`} className="border-b last:border-0">
                    <td className="p-4 font-medium">{item.product?.name ?? "Unnamed product"}</td>
                    <td className="p-4 text-muted-foreground"><div>{variant.sku}</div><div className="text-xs">{variant.color ?? ""}{variant.size ? ` · Size ${variant.size}` : ""}</div></td>
                    <td className="p-4">
                      <span className={item.isLowStock ? "font-semibold text-destructive" : "font-semibold"}>
                        {variant.stock}
                      </span>
                      <span className="ml-2 text-xs text-muted-foreground">threshold {variant.lowStockThreshold}</span>
                    </td>
                    <td className="p-4 text-xs font-medium">{variant.status}</td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          aria-label={`Decrease stock for ${variant.sku}`}
                          disabled={busy || variant.stock === 0}
                          onClick={() => adjust(variant.id, -1)}
                          className="size-9 rounded-md border text-lg leading-none hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          −
                        </button>
                        <button
                          type="button"
                          aria-label={`Increase stock for ${variant.sku}`}
                          disabled={busy}
                          onClick={() => adjust(variant.id, 1)}
                          className="size-9 rounded-md border text-lg leading-none hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          +
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
