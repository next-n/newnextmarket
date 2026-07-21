"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { customerRequest } from "@/lib/customer-api";
import { getAccessToken } from "@/lib/auth-storage";

const stages = ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"];

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function loadOrder() { try { setOrder(await customerRequest<any>(`/orders/${params.id}`)); } catch { router.replace("/account/orders"); } finally { setLoading(false); } }
  useEffect(() => { if (!getAccessToken()) { router.replace("/login?returnTo=/account/orders/" + params.id); return; } void loadOrder(); }, [params.id, router]);
  const currentStage = stages.indexOf(order?.status);

  if (loading) return <><SiteHeader /><main className="container section"><p className="muted">Loading order...</p></main></>;
  if (!order) return null;

  return <><SiteHeader /><main className="container section"><Link href="/account/orders" className="muted">← Order tracking</Link><div className="order-detail-heading"><div><span className="eyebrow order-eyebrow">Order</span><h1>{order.orderNumber}</h1><p className="muted">Placed {new Date(order.createdAt).toLocaleDateString()}</p></div><strong className={`status-badge status-${String(order.status).toLowerCase()}`}>{formatStatus(order.status)}</strong></div><section className="tracking-card"><h2>Delivery progress</h2>{order.status === "CANCELLED" ? <p className="form-error">This order was cancelled.</p> : <div className="tracking-timeline">{stages.map((stage, index) => <div className={`tracking-stage ${index <= currentStage ? "complete" : ""}`} key={stage}><span className="tracking-dot">{index <= currentStage ? "✓" : index + 1}</span><span>{formatStatus(stage)}</span></div>)}</div>}<div className="shipment-summary"><span>Shipment</span><strong>{formatStatus(order.shipment?.status ?? "PENDING")}</strong>{order.shipment?.trackingNumber ? <span>Tracking: {order.shipment.trackingNumber}</span> : <span className="muted">Tracking number will appear after dispatch.</span>}</div></section><div className="order-detail-grid"><section className="checkout-card"><h2>Items</h2>{order.items.map((item: any) => <div className="order-line" key={item.id}><span>{item.productName}<small>{[item.color, item.size ? `Size ${item.size}` : null, item.width ? `Width ${item.width}` : null].filter(Boolean).join(" · ") || item.sku} × {item.quantity}</small></span><strong>${Number(item.lineTotal).toFixed(2)}</strong></div>)}</section><aside className="summary-card"><h2>Order summary</h2><p><span>Subtotal</span><strong>${Number(order.subtotal).toFixed(2)}</strong></p><p><span>Shipping</span><strong>${Number(order.shippingFee).toFixed(2)}</strong></p><p className="summary-total"><span>Total</span><strong>${Number(order.totalAmount).toFixed(2)}</strong></p><p className="muted">Payment: {formatStatus(order.payment?.method ?? "CASH_ON_DELIVERY")}</p></aside></div></main></>;
}

function formatStatus(status: string) { return status.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
