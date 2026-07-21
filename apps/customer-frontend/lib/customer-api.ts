import { clearAuthTokens, getAccessToken, getRefreshToken, setAuthTokens } from "@/lib/auth-storage";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  const response = await fetch(`${API_URL}/auth/refresh-token`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken }) });
  if (!response.ok) return false;
  const body = await response.json();
  setAuthTokens(body.data.accessToken, body.data.refreshToken);
  return true;
}

export async function customerRequest<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (response.status === 401 && retry && await refreshAccessToken()) {
    return customerRequest<T>(path, options, false);
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(Array.isArray(error.errors) ? error.errors.join(", ") : error.message ?? "Request failed");
  }
  const body = await response.json();
  return body.data as T;
}

export function signOut() {
  const token = getAccessToken();
  if (token) void customerRequest("/auth/logout", { method: "POST" }).catch(() => undefined);
  clearAuthTokens();
}
