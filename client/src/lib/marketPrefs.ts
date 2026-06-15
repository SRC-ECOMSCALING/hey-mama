// Marketplace onboarding preferences, persisted per device.
// When absent, the marketplace shows a first-access setup screen.

export interface MarketPrefs {
  city: string; // empty string = all cities
  interest: "items" | "services";
  mode: "buy" | "sell";
}

const KEY = "heymama.marketPrefs";

export function getMarketPrefs(): MarketPrefs | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      (parsed.interest === "items" || parsed.interest === "services") &&
      (parsed.mode === "buy" || parsed.mode === "sell") &&
      typeof parsed.city === "string"
    ) {
      return parsed as MarketPrefs;
    }
    return null;
  } catch {
    return null;
  }
}

export function setMarketPrefs(prefs: MarketPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* localStorage unavailable */
  }
}
