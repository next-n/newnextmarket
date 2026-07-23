"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { customerRequest } from "@/lib/customer-api";
import { getAccessToken } from "@/lib/auth-storage";
import type { StoreProduct } from "@/lib/api";

export function ProductPurchase({ product }: { product: StoreProduct }) {
  const router = useRouter();
  const variants = product.variants ?? [];
  const [selectedId, setSelectedId] = useState(variants.find((variant) => variant.stock > 0 && variant.status === "ACTIVE")?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const selected = variants.find((variant) => variant.id === selectedId);
  const unitPrice = selected ? Number(selected.salePrice ?? selected.price) : Number(product.priceRange?.minSalePrice ?? product.priceRange?.minPrice ?? product.basePrice);
  const options = useMemo(() => variants.map((variant) => ({ ...variant, label: variant.identifier || [variant.color, variant.size ? `Size ${variant.size}` : null, variant.width ? `Width ${variant.width}` : null].filter(Boolean).join(" · ") || variant.sku })), [variants]);

  async function addToCart() {
    if (!selected) return;
    if (!getAccessToken()) { router.push("/login?returnTo=/products/" + product.slug); return; }
    setSaving(true);
    setMessage("");
    try {
      await customerRequest("/cart/items", { method: "POST", body: JSON.stringify({ productVariantId: selected.id, quantity }) });
      setMessage("Added to cart");
      window.dispatchEvent(new Event("cart-updated"));
      router.refresh();
    } catch (error: any) {
      setMessage(error.message);
    } finally { setSaving(false); }
  }

  if (!variants.length) return <p className="form-error">This product is not available for purchase yet.</p>;

  return <div className="purchase-panel"><h2>Choose your option</h2><div className="purchase-options">{options.map((variant) => <button type="button" key={variant.id} className={`variant-option ${selectedId === variant.id ? "selected" : ""}`} disabled={variant.stock <= 0 || variant.status !== "ACTIVE"} onClick={() => { setSelectedId(variant.id); setQuantity(1); setMessage(""); }}>{variant.label}<small>{variant.stock <= 0 ? "Sold out" : `$${Number(variant.salePrice ?? variant.price).toFixed(2)}`}</small></button>)}</div>{selected ? <p className="muted">{selected.stock > 0 ? `${selected.stock} left in stock` : "Sold out"}</p> : null}<div className="purchase-actions"><label>Quantity<select value={quantity} onChange={(event) => setQuantity(Number(event.target.value))}>{Array.from({ length: Math.min(selected?.stock ?? 1, 10) }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label><span className="price">${(unitPrice * quantity).toFixed(2)}</span></div><button type="button" className="button add-cart-button" disabled={!selected || saving} onClick={addToCart}>{saving ? "Adding..." : "Add to cart"}</button>{message ? <p className={message === "Added to cart" ? "form-message" : "form-error"}>{message}</p> : null}</div>;
}
