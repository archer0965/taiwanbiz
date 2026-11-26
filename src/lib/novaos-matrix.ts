/** Shared NovaOS product matrix for dashboard cross-site switching. */

export const NOVAOS_HUB_URL =
  process.env.NEXT_PUBLIC_NOVAOS_URL?.replace(/\/$/, "") ||
  "https://paycheck.com.de";

/** 對外產品名一律「訂閱管家」（勿顯示 SubKeeper）；訂閱管家為永久免費個人工具。 */
export const NOVAOS_MATRIX = [
  { name: "NovaOS 主站", href: NOVAOS_HUB_URL },
  { name: "NovaStore", href: "https://novastore-omega.vercel.app/dashboard" },
  { name: "訂閱管家", href: "https://temporary-speedy-reef-cy4xhhu.vercel.app/app" },
  { name: "拓脈預約", href: "https://taiwanbiz.vercel.app/dashboard" },
  { name: "拓維空間", href: "https://novadimension.vercel.app" },
] as const;
