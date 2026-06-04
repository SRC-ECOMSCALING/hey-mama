// Runtime/config helpers shared across the client.
//
// On the web the frontend is served by the same Express server as the API, so
// API calls use same-origin relative URLs. Inside a native Capacitor build the
// WebView is served from capacitor://localhost (iOS) / http://localhost
// (Android), so relative URLs would hit the device itself. There we must point
// to the deployed backend over HTTPS and authenticate with a bearer token,
// because cross-site session cookies are unreliable in mobile WebViews.

// True when running inside the native Capacitor runtime (the bridge injects a
// global `Capacitor` object). Checked without importing @capacitor/core so the
// web build needs no extra dependency.
export const isNative =
  typeof window !== "undefined" &&
  Boolean((window as any).Capacitor?.isNativePlatform?.());

// Base URL of the backend. Empty string => same-origin (web dev / web prod).
// For native builds set VITE_API_BASE_URL=https://your-backend at build time.
export const API_BASE_URL = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ""
).replace(/\/$/, "");

// Resolve an API path to a full URL.
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return API_BASE_URL + path;
}

// --- Auth token (used by native builds; harmless on web) -------------------
const TOKEN_KEY = "heymama.token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* localStorage unavailable */
  }
}

// --- Global fetch shim -----------------------------------------------------
// Many pages call fetch('/api/...') directly with relative URLs. On the web
// that resolves to the Express server; in a native build it would hit the
// device. Patching fetch once at startup rewrites those relative API/object
// URLs to the configured backend and attaches the bearer token + credentials,
// so every existing and future relative call works natively. Absolute URLs
// (Stripe, Google, presigned upload URLs) are left untouched.
export function installApiFetch(): void {
  if (typeof window === "undefined" || !window.fetch) return;
  const original = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    // Only intervene for string URLs targeting our own app paths.
    if (typeof input === "string" && input.startsWith("/")) {
      const url = apiUrl(input);
      const token = getToken();
      const headers = new Headers(init?.headers || {});
      if (token && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      return original(url, {
        credentials: "include",
        ...init,
        headers,
      });
    }
    return original(input as any, init);
  };
}
