"use client";

import { useEffect, useState } from "react";
import { Activity, ClipboardList, Package, ShoppingBag, Users } from "lucide-react";
import Link from "next/link";

import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import type { AdminOverview, ApiResponse } from "@/lib/api/types";

type Period = "all" | "today" | "7d" | "30d";

const cards = [
  { key: "collectedRevenue", title: "Collected revenue", description: "Payments received", icon: Activity, href: "/dashboard/reports?view=sales", format: (value: number) => `$${value.toFixed(2)}` },
  { key: "salesValue", title: "Sales value", description: "Confirmed order value", icon: ShoppingBag, href: "/dashboard/reports?view=sales", format: (value: number) => `$${value.toFixed(2)}` },
  { key: "totalOrders", title: "Orders", description: "Active orders", icon: ClipboardList, href: "/dashboard/orders", format: (value: number) => String(value) },
  { key: "pendingCod", title: "Pending COD", description: "Payment due on delivery", icon: ClipboardList, href: "/dashboard/orders?paymentStatus=PENDING", format: (value: number) => String(value) },
  { key: "lowStockProducts", title: "Low stock variants", description: "Need inventory attention", icon: Package, href: "/dashboard/inventory?lowStock=true", format: (value: number) => String(value) },
  { key: "totalCustomers", title: "Customers", description: "Registered in period", icon: Users, href: "/dashboard/customers", format: (value: number) => String(value) },
] as const;

function getQuery(period: Period) {
  if (period === "all") return { groupBy: "day" };
  const end = new Date();
  const start = new Date(end);
  if (period === "today") start.setHours(0, 0, 0, 0);
  if (period === "7d") start.setDate(start.getDate() - 6);
  if (period === "30d") start.setDate(start.getDate() - 29);
  return { dateFrom: start.toISOString(), dateTo: end.toISOString(), groupBy: "day" };
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [period, setPeriod] = useState<Period>("30d");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiClient.get<ApiResponse<AdminOverview>>(API_ENDPOINTS.reports.overview, { params: getQuery(period) })
      .then((response) => { setOverview(response.data.data); setError(""); })
      .catch(() => setError("Unable to load store activity"))
      .finally(() => setLoading(false));
  }, [period]);

  return <section className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-semibold">Overview</h1><p className="mt-1 text-sm text-muted-foreground">Corrected store activity and sales summary</p>{error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}</div><label className="grid gap-1 text-sm font-medium text-muted-foreground">Period<select value={period} onChange={(event) => setPeriod(event.target.value as Period)} className="h-9 rounded-md border bg-background px-3 text-foreground"><option value="30d">Last 30 days</option><option value="7d">Last 7 days</option><option value="today">Today</option><option value="all">All time</option></select></label></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map((card) => { const Icon = card.icon; const value = overview ? Number(overview[card.key]) : 0; return <Link key={card.key} href={card.href} className="rounded-lg border bg-card p-5 shadow-sm transition-colors hover:bg-accent"><div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">{card.title}</p><p className="mt-1 text-xs text-muted-foreground">{card.description}</p></div><Icon className="size-4 text-muted-foreground" /></div><p className="text-2xl font-semibold">{loading ? "—" : card.format(value)}</p></Link>; })}</div><div><h2 className="text-lg font-semibold">Quick access</h2><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Products", "/dashboard/products", "Add and manage products"], ["Inventory", "/dashboard/inventory", "Review stock levels"], ["Orders", "/dashboard/orders", "Manage customer orders"], ["Banners", "/dashboard/banners", "Update homepage content"]].map(([title, href, description]) => <Link key={href} href={href} className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent"><p className="font-medium">{title}</p><p className="mt-1 text-sm text-muted-foreground">{description}</p></Link>)}</div></div></section>;
}
