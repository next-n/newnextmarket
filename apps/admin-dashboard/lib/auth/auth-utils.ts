import { clearAuthTokens, getAccessToken } from "./auth-storage";

export function hasAdminSession() {
  return Boolean(getAccessToken());
}

export function clearAdminSession() {
  clearAuthTokens();
}
