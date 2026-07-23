const ACCESS_TOKEN_KEY = "newnextmarket_admin_access_token";
const REFRESH_TOKEN_KEY = "newnextmarket_admin_refresh_token";

function canUseStorage() {
  try {
    return typeof window !== "undefined" && Boolean(window.localStorage);
  } catch {
    return false;
  }
}

function getItem(key: string) {
  if (!canUseStorage()) return null;

  return window.localStorage.getItem(key);
}

function setItem(key: string, value: string) {
  if (!canUseStorage()) return;

  window.localStorage.setItem(key, value);
}

function removeItem(key: string) {
  if (!canUseStorage()) return;

  window.localStorage.removeItem(key);
}

export function getAccessToken() {
  return getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string) {
  setItem(ACCESS_TOKEN_KEY, token);
}

export function removeAccessToken() {
  removeItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string) {
  setItem(REFRESH_TOKEN_KEY, token);
}

export function removeRefreshToken() {
  removeItem(REFRESH_TOKEN_KEY);
}

export function clearAuthTokens() {
  removeAccessToken();
  removeRefreshToken();
}
