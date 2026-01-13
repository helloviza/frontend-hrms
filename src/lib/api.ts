/**
 * Unified API client with in-memory access token, localStorage fallback,
 * and single-flight refresh to avoid loops.
 *
 * Key fix for your case:
 * - Always attaches Authorization Bearer from (memory OR localStorage) so
 *   approvals admin endpoints don't fail with NO_TOKEN.
 * - Exports setAccessToken/onAccessTokenRefresh exactly once (no redeclare).
 */

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

function isLocalhostHost(host: string) {
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".local");
}

/**
 * Normalize base into an API base that includes `/api` exactly once.
 */
function normalizeApiBase(input: string) {
  let s = String(input || "").trim();
  if (!s) s = "/api";
  s = s.replace(/\/+$/, "");

  if (s.startsWith("/")) {
    if (!/^\/api(\/|$)/.test(s)) s = `${s}/api`.replace(/\/+$/, "");
    return s;
  }

  if (!/\/api(\/|$)/.test(s)) s = `${s}/api`;
  return s.replace(/\/+$/, "");
}

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/+$/, "");
  const p = String(path || "");
  if (!p) return b;
  if (p.startsWith("/")) return `${b}${p}`;
  return `${b}/${p}`;
}

function getDefaultApiBase() {
  if (typeof window !== "undefined" && isLocalhostHost(window.location.hostname)) {
    // Dev uses Vite proxy
    return "/api";
  }
  // Prod: normalizeApiBase will add /api if missing
  return "https://api.hrms.plumtrips.com";
}

export const API_BASE = normalizeApiBase(
  (import.meta.env.VITE_API_BASE as string | undefined) || getDefaultApiBase()
);

// storage keys we accept (keep compatibility)
const STORAGE_KEYS = ["jwt", "hrms_accessToken"];

function readStoredToken(): string | null {
  try {
    if (typeof window === "undefined") return null;
    for (const k of STORAGE_KEYS) {
      const v = window.localStorage.getItem(k);
      if (v && String(v).trim()) return String(v).trim();
    }
    return null;
  } catch {
    return null;
  }
}

function writeStoredToken(token: string | null) {
  try {
    if (typeof window === "undefined") return;
    if (token) {
      window.localStorage.setItem("jwt", token);
      window.localStorage.setItem("hrms_accessToken", token);
    } else {
      window.localStorage.removeItem("jwt");
      window.localStorage.removeItem("hrms_accessToken");
    }
  } catch {
    /* ignore */
  }
}

// In-memory token (fast)
let accessToken: string | null = readStoredToken();

// single-flight refresh
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

// subscriber (AuthContext)
let onTokenRefresh: ((token: string | null) => void) | null = null;

/** Exported: allow AuthContext / other modules to set token */
export const setAccessToken = (token: string | null) => {
  accessToken = token;
  writeStoredToken(token);
};

/** Exported: allow AuthContext to listen for refresh events */
export const onAccessTokenRefresh = (cb: (token: string | null) => void) => {
  onTokenRefresh = cb;
};

function getAuthToken(): string | null {
  // always re-check storage as fallback (covers first page load)
  return accessToken || readStoredToken();
}

async function safeReadBody(res: Response) {
  const ct = res.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) return await res.json();
    const t = await res.text();
    return t ? { message: t } : null;
  } catch {
    return null;
  }
}

async function readErrorText(res: Response) {
  const body = await safeReadBody(res);
  if (body && typeof body === "object") {
    const anyBody: any = body;
    return anyBody?.error || anyBody?.message || JSON.stringify(anyBody);
  }
  if (typeof body === "string") return body;
  return `Request failed: ${res.status}`;
}

async function ensureRefreshed(): Promise<boolean> {
  if (isRefreshing && refreshPromise) return refreshPromise;
  isRefreshing = true;
  refreshPromise = refreshAccessToken();
  const ok = await refreshPromise;
  isRefreshing = false;
  refreshPromise = null;
  return ok;
}

/** Cookie-based refresh (only works if refresh cookie exists) */
async function refreshAccessToken(): Promise<boolean> {
  try {
    const url = joinUrl(API_BASE, "/auth/refresh");
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) return false;

    const data: any = await safeReadBody(res);
    if (data?.accessToken) {
      accessToken = data.accessToken;
      writeStoredToken(data.accessToken);
      if (onTokenRefresh) onTokenRefresh(data.accessToken);
      return true;
    }
    return false;
  } catch (err) {
    console.warn("Token refresh failed", err);
    return false;
  }
}

async function request<T = any>(
  method: HttpMethod,
  path: string,
  body?: any,
  retried = false
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };

  if (method !== "GET" && method !== "DELETE") headers["Content-Type"] = "application/json";

  const token = getAuthToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const url = joinUrl(API_BASE, path);

  const res = await fetch(url, {
    method,
    headers,
    credentials: "include",
    ...(body && method !== "GET" && method !== "DELETE"
      ? { body: JSON.stringify(body) }
      : {}),
  });

  if (res.status === 401 && !retried) {
    const refreshed = await ensureRefreshed();
    const token2 = getAuthToken();
    if (refreshed && token2) {
      return request<T>(method, path, body, true);
    }

    // hard fail: clear
    accessToken = null;
    writeStoredToken(null);
    if (onTokenRefresh) onTokenRefresh(null);
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) throw new Error(await readErrorText(res));

  const data = await safeReadBody(res);
  if (data == null) return {} as T;
  if (typeof data === "string") return ({ message: data } as unknown) as T;
  return data as T;
}

async function requestForm<T = any>(path: string, formData: FormData, retried = false): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };

  const token = getAuthToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const url = joinUrl(API_BASE, path);

  const res = await fetch(url, {
    method: "POST",
    headers,
    credentials: "include",
    body: formData,
  });

  if (res.status === 401 && !retried) {
    const refreshed = await ensureRefreshed();
    const token2 = getAuthToken();
    if (refreshed && token2) return requestForm<T>(path, formData, true);

    accessToken = null;
    writeStoredToken(null);
    if (onTokenRefresh) onTokenRefresh(null);
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) throw new Error(await readErrorText(res));

  const data = await safeReadBody(res);
  if (data == null) return {} as T;
  if (typeof data === "string") return ({ message: data } as unknown) as T;
  return data as T;
}

export const api = {
  get: <T = any>(path: string) => request<T>("GET", path),
  post: <T = any>(path: string, body?: any) => request<T>("POST", path, body),
  patch: <T = any>(path: string, body?: any) => request<T>("PATCH", path, body),
  put: <T = any>(path: string, body?: any) => request<T>("PUT", path, body),
  delete: <T = any>(path: string) => request<T>("DELETE", path),

  postForm: <T = any>(path: string, formData: FormData) => requestForm<T>(path, formData),

  BASE: API_BASE,
};

export default api;
