export const DEVELOPER_EMAILS = ["archer0965@gmail.com"] as const;

/** 種子／示範店主帳號（可於總管理後台再綁定更多 Email） */
export const DEMO_OWNER_EMAILS = [
  "owner.brunch@demo.tw",
  "owner.nail@demo.tw",
  "owner.shop@demo.tw",
] as const;

export function isDeveloperEmail(email?: string | null) {
  if (!email) return false;
  return DEVELOPER_EMAILS.includes(
    email.trim().toLowerCase() as (typeof DEVELOPER_EMAILS)[number],
  );
}

export function isDemoOwnerEmail(email?: string | null) {
  if (!email) return false;
  return DEMO_OWNER_EMAILS.includes(
    email.trim().toLowerCase() as (typeof DEMO_OWNER_EMAILS)[number],
  );
}

export function isValidLoginEmail(email?: string | null) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase());
}

/** 總管理員（Super Admin） */
export function isAdminEmail(email?: string | null) {
  return isDeveloperEmail(email);
}
