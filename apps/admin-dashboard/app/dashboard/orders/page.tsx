"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";

const statuses = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];

function paymentLabel(payment: any) {
  if (!payment) return "No payment";
  const method = payment.method === "CASH_ON_DELIVERY" ? "COD" : payment.method;
  const status = payment.status === "PAID" ? "Collected" : payment.status === "CANCELLED" ? "Cancelled" : payment.status;
  return `${method} · ${status}`;
}

export default function OrdersPage() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [busyPaymentId, setBusyPaymentId] = useState<string | null>(null);
  const statusFilter = searchParams.get("status") ?? "";
  const paymentStatusFilter = searchParams.get("paymentStatus") ?? "";

  async function load() {
    const response = await apiClient.get<any>(API_ENDPOINTS.orders, {
      params: {
        limit: 50,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(paymentStatusFilter ? { paymentStatus: paymentStatusFilter } : {}),
      },
    });
    setOrders(response.data.data.items ?? []);
  }

  useEffect(() => {
    load().catch(() => setMessage("Unable to load orders"));
  }, [statusFilter, paymentStatusFilter]);

  async function updateStatus(id: string, status: string) {
    try {
      await apiClient.patch(`${API_ENDPOINTS.orders}/${id}/status`, { status });
      setMessage("Order updated");
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.message ?? "Unable to update order");
    }
  }

  async function collectPayment(paymentId: string) {
    setBusyPaymentId(paymentId);
    setMessage("");
    try {
      await apiClient.post(`${API_ENDPOINTS.payments}/${paymentId}/collect`);
      setMessage("Cash payment marked as collected");
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.message ?? "Unable to update payment");
    } finally {
      setBusyPaymentId(null);
    }
  }

  const filterLabel = statusFilter
    ? `Status: ${statusFilter}`
    : paymentStatusFilter
      ? `Payment: ${paymentStatusFilter}`
      : "All orders";

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">Review fulfillment and payment progress.</p>
        <p className="mt-3 inline-flex rounded-full bg-accent px-3 py-1 text-sm">{filterLabel}</p>
        {statusFilter || paymentStatusFilter ? <Link href="/dashboard/orders" className="ml-3 text-sm font-medium text-primary hover:underline">View all orders</Link> : null}
      </div>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="p-4">Order</th>
              <th className="p-4">Customer</th>
              <th className="p-4">Total</th>
              <th className="p-4">Payment</th>
              <th className="p-4">Fulfillment</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const payment = order.payment ?? order.payments?.[0];
              const isCancelled = order.status === "CANCELLED";
              const canCollect = payment?.method === "CASH_ON_DELIVERY" && payment.status === "PENDING";
              return (
                <tr key={order.id} className="border-b last:border-0">
                  <td className="p-4 font-medium">{order.orderNumber ?? order.id}</td>
                  <td className="p-4">{order.user?.email ?? order.customer?.email ?? "—"}</td>
                  <td className="p-4">${Number(order.totalAmount ?? 0).toFixed(2)}</td>
                  <td className="space-y-2 p-4">
                    <div>{paymentLabel(payment)}</div>
                    {canCollect ? (
                      <button
                        type="button"
                        disabled={isCancelled || busyPaymentId === payment.id}
                        onClick={() => collectPayment(payment.id)}
                        title={isCancelled ? "Cancelled orders cannot be collected" : undefined}
                        className="rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busyPaymentId === payment.id ? "Saving…" : "Mark collected"}
                      </button>
                    ) : null}
                  </td>
                  <td className="p-4">
                    <select disabled={isCancelled} value={order.status} onChange={(e) => updateStatus(order.id, e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm disabled:cursor-not-allowed disabled:opacity-60">
                      {statuses.map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
