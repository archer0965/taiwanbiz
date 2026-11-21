/**
 * 歷史訂閱匯款對帳型別／帳號顯示。
 * 新訂閱已改走綠界；此模組僅供 Admin 清庫與預約訂金說明複用。
 */

export const BANK_TRANSFER_INFO = {
  /** 顯示用銀行名稱（例：國泰世華） */
  bankName: process.env.NEXT_PUBLIC_BANK_NAME?.trim() || "國泰世華",
  /** 銀行代號 */
  bankCode: process.env.NEXT_PUBLIC_BANK_CODE?.trim() || "013",
  branchName: process.env.NEXT_PUBLIC_BANK_BRANCH?.trim() || "敦南分行",
  accountName:
    process.env.NEXT_PUBLIC_BANK_ACCOUNT_NAME?.trim() || "拓脈數位有限公司",
  /** 匯款帳號（續訂／開通轉入帳戶） */
  accountNumber:
    process.env.NEXT_PUBLIC_BANK_ACCOUNT_NUMBER?.trim() || "699522357336",
} as const;

/** 前台顯示：013國泰世華 */
export function formatBankLabel(
  info: Pick<typeof BANK_TRANSFER_INFO, "bankCode" | "bankName"> = BANK_TRANSFER_INFO,
) {
  return `${info.bankCode}${info.bankName}`;
}

export type BankTransferReport = {
  id: string;
  storeId: string;
  storeName: string;
  ownerEmail: string;
  planName: string;
  planId: string;
  billingCycle: "monthly" | "annual";
  amount: number;
  last5: string;
  transferDate: string;
  note?: string;
  /** 開通時填寫的同業推薦碼 */
  referralCode?: string;
  /** 本次匯款已套用的帳單折抵（推薦人獎勵等） */
  creditApplied?: number;
  createdAt: string;
  status: "pending_review" | "approved" | "rejected";
  reviewedAt?: string | null;
  reviewerEmail?: string | null;
};

export function formatBankAccountDisplay(account: string) {
  const digits = account.replace(/\D/g, "");
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}
