"use client";

import { Button } from "@/components/ui/button";
import { ECPAY_BILLING_MESSAGE } from "@/lib/architecture-constraints";
import Link from "next/link";

type Props = {
  storeId: string;
  storeName?: string;
  ownerEmail?: string;
  planName?: string;
  monthlyListAmount?: number;
  isFoundingMember?: boolean;
  planId?: string;
  defaultCycle?: "monthly" | "annual";
  billingCreditBalance?: number;
  allowReferralDiscount?: boolean;
  lastPaymentAt?: string | null;
  referralDiscountApplied?: number;
  onSuccess?: (message: string) => void;
};

/**
 * @deprecated 訂閱匯款已停用；元件改為導向綠界續費頁。
 */
export function BankTransferRemitForm({ storeId }: Props) {
  const renewHref = `/billing/renew?storeId=${encodeURIComponent(storeId)}`;
  return (
    <div className="space-y-4 rounded-2xl border border-teal-200 bg-teal-50/80 p-5 text-teal-950">
      <p className="text-sm font-semibold">訂閱付款已改為綠界金流</p>
      <p className="text-xs leading-relaxed text-teal-900/80">
        {ECPAY_BILLING_MESSAGE}
      </p>
      <Link href={renewHref}>
        <Button as="span" className="h-11 w-full bg-teal-600 text-white hover:bg-teal-500">
          前往綠界線上付款
        </Button>
      </Link>
    </div>
  );
}
