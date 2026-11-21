const HUB_URL =
  process.env.NEXT_PUBLIC_NOVAOS_URL?.replace(/\/$/, "") ||
  "https://paycheck.com.de";

export const TAIWANBIZ_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://taiwanbiz.vercel.app";

/** Redirect product auth to NovaOS hub; return via /auth/receive after login. */
export function hubAuthRedirect(
  mode: "login" | "signup",
  nextPath = "/welcome"
): string {
  const next = nextPath.startsWith("/") ? nextPath : "/welcome";
  const returnTo = `${TAIWANBIZ_ORIGIN}/auth/receive?next=${encodeURIComponent(next)}`;
  return `${HUB_URL}/${mode}?next=${encodeURIComponent(returnTo)}&product=taiwanbiz`;
}
