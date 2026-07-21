"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { customerRequest } from "@/lib/customer-api";
import { resolveAssetUrl } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-storage";

type Cart = { items: any[]; currency: string; subtotal: number; discountAmount: number; taxAmount: number; totalAmount: number; shippingEstimate: { standard: number; express: number; amount: number; isFreeShipping: boolean } };

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadCart() {
    if (!getAccessToken()) { router.replace("/login?returnTo=/cart"); setLoading(false); return; }
    try { setCart(await customerRequest<Cart>("/cart")); } catch { router.replace("/login?returnTo=/cart"); } finally { setLoading(false); }
  }

  useEffect(() => { void loadCart(); }, []);

  async function update(itemId: string, quantity: number) {
    setMessage("");
    try { setCart(await customerRequest<Cart>(`/cart/items/${itemId}`, { method: "PATCH", body: JSON.stringify({ quantity }) })); window.dispatchEvent(new Event("cart-updated")); } catch (error: any) { setMessage(error.message); }
  }

  async function remove(itemId: string) {
    try { setCart(await customerRequest<Cart>(`/cart/items/${itemId}`, { method: "DELETE" })); window.dispatchEvent(new Event("cart-updated")); } catch (error: any) { setMessage(error.message); }
  }

  if (loading) return <><SiteHeader /><main className="container section"><p className="muted">Loading cart...</p></main></>;
  if (!cart || !cart.items.length) return <><SiteHeader /><main className="container section empty-state"><span className="eyebrow">Your bag</span><h1>Your cart is empty</h1><p className="muted">Add a product to begin checkout.</p><Link href="/products" className="button">Continue shopping</Link></main></>;

  return <><SiteHeader /><main className="container section"><span className="eyebrow">Your bag</span><h1>Shopping cart</h1><div className="cart-layout"><section className="cart-items">{cart.items.map((item) => <article className="cart-item" key={item.id}><img src={resolveAssetUrl(item.product.images?.[0]?.url) || "https://placehold.co/160x160/e5e7eb/6b7280?text=Product"} alt={item.product.name} /><div className="cart-item-info"><Link href={`/products/${item.product.slug}`}><h2>{item.product.name}</h2></Link><p className="muted">{[item.variant.color, item.variant.size ? `Size ${item.variant.size}` : null, item.variant.width ? `Width ${item.variant.width}` : null].filter(Boolean).join(" · ") || item.variant.sku}</p><p>${Number(item.unitPrice).toFixed(2)} each</p><div className="quantity-control"><button type="button" onClick={() => item.quantity > 1 ? update(item.id, item.quantity - 1) : remove(item.id)} aria-label="Decrease quantity">−</button><span>{item.quantity}</span><button type="button" onClick={() => update(item.id, item.quantity + 1)} aria-label="Increase quantity">+</button><button type="button" className="text-button" onClick={() => remove(item.id)}>Remove</button></div></div><strong>${Number(item.lineTotal).toFixed(2)}</strong></article>)}</section><aside className="summary-card"><h2>Summary</h2><p><span>Subtotal</span><strong>${Number(cart.subtotal).toFixed(2)}</strong></p><p><span>Tax</span><strong>${Number(cart.taxAmount).toFixed(2)}</strong></p><p className="summary-total"><span>Total</span><strong>${Number(cart.totalAmount).toFixed(2)}</strong></p><Link href="/checkout" className="button checkout-button">Continue to checkout</Link>{message ? <p className="form-message">{message}</p> : null}</aside></div></main></>;
}
