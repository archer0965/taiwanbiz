/** 僅允許 http(s) 連結，阻擋 javascript: 等危險協定 */
export function toSafeHttpUrl(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function isSafeHttpUrl(value?: string | null): boolean {
  return toSafeHttpUrl(value) !== null;
}
