"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import type { AdminAuthResponse, ApiResponse } from "@/lib/api/types";
import { setAccessToken, setRefreshToken } from "@/lib/auth/auth-storage";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await apiClient.post<ApiResponse<AdminAuthResponse>>(
        API_ENDPOINTS.adminAuth.login,
        { email, password },
      );
      setAccessToken(response.data.data.accessToken);
      setRefreshToken(response.data.data.refreshToken);
      router.replace("/dashboard");
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message ?? "Unable to sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Manage your store</p>
          </div>
        </div>
        <div className="space-y-3">
          <label className="block text-sm font-medium" htmlFor="email">Email</label>
          <input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm" />
          <label className="block text-sm font-medium" htmlFor="password">Password</label>
          <input id="password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm" />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button className="mt-3 w-full" disabled={loading} type="submit">{loading ? "Signing in..." : "Login"}</Button>
        </div>
      </form>
    </main>
  );
}
