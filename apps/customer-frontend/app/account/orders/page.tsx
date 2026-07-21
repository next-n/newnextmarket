"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { customerRequest } from "@/lib/customer-api";
import { getAccessToken } from "@/lib/auth-storage";

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { if (!getAccessToken()) { router.replace("/login?returnTo=/account/orders"); return; } customerRequest<any>("/orders?limit=50").then((data) => setOrders(data.items ?? [])).catch(() => router.replace("/login?returnTo=/account/orders")).finally(() => setLoading(false)); }, [router]);

  return <><SiteHeader /><main className="container section"><Link href="/account" className="muted">← My account</Link><span className="eyebrow order-eyebrow">Orders</span><h1>Order tracking</h1><p className="muted">Follow the status of your purchases.</p>{loading ? <p className="muted">Loading orders...</p> : orders.length === 0 ? <section className="empty-state"><p className="muted">You have no orders yet.</p><Link href="/products" className="button">Start shopping</Link></section> : <div className="order-list">{orders.map((order) => <Link href={`/account/orders/${order.id}`} className="order-card" key={order.id}><div><span className="order-number">{order.orderNumber}</span><p className="muted">{new Date(order.createdAt).toLocaleDateString()}</p></div><div><strong className={`status-badge status-${String(order.status).toLowerCase()}`}>{formatStatus(order.status)}</strong><p className="muted">{order.items?.length ?? 0} item{order.items?.length === 1 ? "" : "s"}</p></div><strong>${Number(order.totalAmount).toFixed(2)}</strong><span className="order-arrow">→</span></Link>)}</div>}</main></>;
}

function formatStatus(status: string) { return status.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
