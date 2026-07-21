"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const response = await apiClient.get<any>(API_ENDPOINTS.customers, { params: { limit: 100, ...(search.trim() ? { search: search.trim() } : {}) } });
    setCustomers(response.data.data.items ?? []);
  }

  useEffect(() => { load().catch(() => setMessage("Unable to load customers")); }, [search]);

  return <section className="space-y-6"><div><h1 className="text-2xl font-semibold">Customers</h1><p className="mt-1 text-sm text-muted-foreground">Registered storefront customers and their order activity.</p></div><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or email" className="h-10 w-full max-w-md rounded-md border bg-background px-3 text-sm" />{message ? <p className="text-sm text-destructive">{message}</p> : null}<div className="overflow-hidden rounded-lg border bg-card"><table className="w-full text-left text-sm"><thead className="border-b bg-muted/50"><tr><th className="p-4">Customer</th><th className="p-4">Email</th><th className="p-4">Phone</th><th className="p-4">Orders</th><th className="p-4">Status</th><th className="p-4">Joined</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.id} className="border-b last:border-0"><td className="p-4 font-medium">{[customer.firstName, customer.lastName].filter(Boolean).join(" ") || "Unnamed customer"}</td><td className="p-4">{customer.email}</td><td className="p-4">{customer.phone ?? "—"}</td><td className="p-4">{customer.orderCount ?? 0}</td><td className="p-4">{customer.status}</td><td className="p-4">{new Date(customer.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table>{!customers.length && !message ? <p className="p-6 text-sm text-muted-foreground">No customers found.</p> : null}</div></section>;
}
