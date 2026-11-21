/** Parse hub handoff hash (#access_token&refresh_token). */

export function parseHandoffHash(hash: string): {
  access_token: string;
  refresh_token: string;
} | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token) return null;
  return { access_token, refresh_token };
}

export function sanitizeNextPath(
  raw: string | null | undefined,
  fallback = "/welcome"
): string {
  if (!raw) return fallback;
  const next = raw.trim();
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("://")) {
    return fallback;
  }
  return next;
}
