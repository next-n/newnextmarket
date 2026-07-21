import axios from "axios";

import { clearAuthTokens, getAccessToken } from "@/lib/auth/auth-storage";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export function resolveAssetUrl(url?: string | null) {
  if (!url || url.includes("cdn.example.com")) return undefined;
  return url.startsWith("/") ? `${API_ORIGIN}${url}` : url;
}

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();

  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearAuthTokens();

      if (
        typeof window !== "undefined" &&
        window.location.pathname.startsWith("/dashboard")
      ) {
        window.location.replace("/login");
      }
    }

    return Promise.reject(error);
  },
);
