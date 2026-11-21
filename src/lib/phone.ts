/** 將輸入正規化為半形數字字串（去除空白、連字號與常見符號） */
export function normalizeTaiwanMobile(phone: string): string {
  let digits = phone
    .trim()
    .replace(/[０-９]/g, (d) =>
      String.fromCharCode(d.charCodeAt(0) - 0xff10 + 0x30),
    )
    .replace(/\D/g, "");

  // +886 / 886 開頭轉為 09xxxxxxxx
  if (digits.startsWith("886") && digits.length >= 11) {
    const rest = digits.slice(3);
    digits = rest.startsWith("0") ? rest : `0${rest}`;
  }

  return digits;
}

/** 驗證台灣手機號碼格式：09 開頭共 10 碼 */
export function isValidTaiwanMobile(phone: string): boolean {
  return /^09\d{8}$/.test(normalizeTaiwanMobile(phone));
}

export function formatTaiwanMobileDisplay(phone: string): string {
  const p = normalizeTaiwanMobile(phone);
  if (p.length !== 10) return phone;
  return `${p.slice(0, 4)}-${p.slice(4, 7)}-${p.slice(7)}`;
}
