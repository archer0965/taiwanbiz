import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const MIN_PASSWORD_LENGTH = 8;

export function validatePasswordStrength(password: string) {
  const value = password ?? "";
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `密碼至少 ${MIN_PASSWORD_LENGTH} 碼`;
  }
  if (value.length > 128) {
    return "密碼過長";
  }
  if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) {
    return "密碼需同時包含英文字母與數字";
  }
  return null;
}

/** scrypt 雜湊：salt.base64 + hash.base64 */
export function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("base64")}.${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string) {
  const [saltB64, hashB64] = stored.split(".");
  if (!saltB64 || !hashB64) return false;
  try {
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    const actual = scryptSync(password, salt, expected.length);
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
