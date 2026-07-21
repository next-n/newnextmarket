"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { customerRequest } from "@/lib/customer-api";
import { getAccessToken } from "@/lib/auth-storage";

type Address = { firstName: string; lastName: string; phone: string; addressLine1: string; addressLine2: string; city: string; state: string; postalCode: string; country: string };
type Checkout = { cart: any; totals: { subtotal: number; discountAmount: number; totalAmount: number; currency: string; shippingEstimate: { standard: number; express: number } } };

const emptyAddress: Address = { firstName: "", lastName: "", phone: "", addressLine1: "", addressLine2: "", city: "", state: "", postalCode: "", country: "" };

export default function CheckoutPage() {
  const router = useRouter();
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [address, setAddress] = useState(emptyAddress);
  const [shippingMethod, setShippingMethod] = useState<"standard" | "express">("standard");
  const [shipping, setShipping] = useState({ standard: 0, express: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [order, setOrder] = useState<any>(null);

  useEffect(() => { if (!getAccessToken()) { router.replace("/login?returnTo=/checkout"); setLoading(false); return; } customerRequest<Checkout>("/checkout/validate", { method: "POST", body: JSON.stringify({}) }).then((data) => { setCheckout(data); setShipping(data.totals.shippingEstimate); }).catch((error: any) => { setMessage(error.message); }).finally(() => setLoading(false)); }, [router]);

  const shippingFee = shippingMethod === "express" ? shipping.express : shipping.standard;
  const total = checkout ? Number(checkout.totals.subtotal) - Number(checkout.totals.discountAmount) + Number(shippingFee) : 0;

  async function refreshShipping() {
    if (!address.country || !address.city) return;
    try { const result = await customerRequest<any>("/checkout/shipping-rate", { method: "POST", body: JSON.stringify({ country: address.country, state: address.state, city: address.city }) }); setShipping({ standard: result.methods.find((method: any) => method.id === "standard")?.amount ?? 0, express: result.methods.find((method: any) => method.id === "express")?.amount ?? 0 }); } catch (error: any) { setMessage(error.message); }
  }

  async function placeOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setMessage("");
    try { const result = await customerRequest<any>("/checkout/create-order", { method: "POST", body: JSON.stringify({ paymentMethod: "CASH_ON_DELIVERY", shippingMethod, shippingAddress: { ...address, phone: address.phone || undefined, addressLine2: address.addressLine2 || undefined, state: address.state || undefined } }) }); setOrder(result.order); window.dispatchEvent(new Event("cart-updated")); } catch (error: any) { setMessage(error.message); } finally { setSaving(false); }
  }

  if (loading) return <><SiteHeader /><main className="container section"><p className="muted">Preparing checkout...</p></main></>;
  if (order) return <><SiteHeader /><main className="container section success-panel"><span className="eyebrow">Order confirmed</span><h1>Order {order.orderNumber}</h1><p className="muted">Your order is confirmed. Payment will be collected when it is delivered.</p><p className="price">${Number(order.totalAmount).toFixed(2)}</p><Link href="/products" className="button">Continue shopping</Link></main></>;
  if (!checkout) return <><SiteHeader /><main className="container section"><h1>Checkout</h1><p className="form-error">{message || "Your cart could not be loaded."}</p><Link href="/cart" className="button">Return to cart</Link></main></>;

  return <><SiteHeader /><main className="container section"><span className="eyebrow">Secure checkout</span><h1>Checkout</h1><div className="checkout-layout"><form className="checkout-form" onSubmit={placeOrder}><section className="checkout-card"><h2>Shipping address</h2><div className="form-grid two"><input required placeholder="First name" value={address.firstName} onChange={(e) => setAddress({ ...address, firstName: e.target.value })} /><input required placeholder="Last name" value={address.lastName} onChange={(e) => setAddress({ ...address, lastName: e.target.value })} /></div><input placeholder="Phone" value={address.phone} onChange={(e) => setAddress({ ...address, phone: e.target.value })} /><input required placeholder="Address line 1" value={address.addressLine1} onChange={(e) => setAddress({ ...address, addressLine1: e.target.value })} /><input placeholder="Address line 2" value={address.addressLine2} onChange={(e) => setAddress({ ...address, addressLine2: e.target.value })} /><div className="form-grid two"><input required placeholder="City" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} /><input placeholder="State / region" value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} /></div><div className="form-grid two"><input required placeholder="Postal code" value={address.postalCode} onChange={(e) => setAddress({ ...address, postalCode: e.target.value })} /><input required placeholder="Country code" value={address.country} onBlur={refreshShipping} onChange={(e) => setAddress({ ...address, country: e.target.value.toUpperCase() })} /></div></section><section className="checkout-card"><h2>Shipping method</h2><label className="shipping-option"><input type="radio" checked={shippingMethod === "standard"} onChange={() => setShippingMethod("standard")} /> <span>Standard shipping<small>3–7 business days</small></span><strong>${Number(shipping.standard).toFixed(2)}</strong></label><label className="shipping-option"><input type="radio" checked={shippingMethod === "express"} onChange={() => setShippingMethod("express")} /> <span>Express shipping<small>1–3 business days</small></span><strong>${Number(shipping.express).toFixed(2)}</strong></label></section><section className="checkout-card"><h2>Payment method</h2><label className="shipping-option"><input type="radio" checked readOnly /> <span>Cash on Delivery<small>Pay when your order arrives.</small></span></label></section><button type="submit" className="button checkout-submit" disabled={saving}>{saving ? "Placing order..." : "Place order"}</button>{message ? <p className="form-error">{message}</p> : null}</form><aside className="summary-card"><h2>Order summary</h2>{checkout.cart.items.map((item: any) => <p key={item.id}><span>{item.product.name} × {item.quantity}</span><strong>${Number(item.lineTotal).toFixed(2)}</strong></p>)}<p><span>Subtotal</span><strong>${Number(checkout.totals.subtotal).toFixed(2)}</strong></p><p><span>Shipping</span><strong>${Number(shippingFee).toFixed(2)}</strong></p><p className="summary-total"><span>Total</span><strong>${total.toFixed(2)}</strong></p></aside></div></main></>;
}
