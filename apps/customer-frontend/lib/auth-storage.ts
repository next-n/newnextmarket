const ACCESS_TOKEN_KEY = "sportwear_customer_access_token";
const REFRESH_TOKEN_KEY = "sportwear_customer_refresh_token";

function storage() {
  return typeof window !== "undefined" ? window.localStorage : null;
}

export function getAccessToken() { return storage()?.getItem(ACCESS_TOKEN_KEY) ?? null; }
export function getRefreshToken() { return storage()?.getItem(REFRESH_TOKEN_KEY) ?? null; }
export function setAuthTokens(accessToken: string, refreshToken: string) { storage()?.setItem(ACCESS_TOKEN_KEY, accessToken); storage()?.setItem(REFRESH_TOKEN_KEY, refreshToken); }
export function clearAuthTokens() { storage()?.removeItem(ACCESS_TOKEN_KEY); storage()?.removeItem(REFRESH_TOKEN_KEY); }
