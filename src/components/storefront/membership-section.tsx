"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StoreTheme } from "@/data/stores-db";
import {
  formatTaiwanMobileDisplay,
  isValidTaiwanMobile,
  normalizeTaiwanMobile,
} from "@/lib/phone";
import {
  clearMemberSession,
  getLoggedInMember,
  type StoreMember,
  upsertStoreMember,
} from "@/lib/storage";
import { useClientReady } from "@/lib/use-client-ready";
import {
  CalendarHeart,
  Gift,
  Lock,
  LogOut,
  Sparkles,
  Ticket,
  UserRound,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Props = {
  storeSlug: string;
  storeName: string;
  tone?: StoreTheme;
};

function MembershipSectionClient({
  storeSlug,
  storeName,
  tone = "brunch",
}: Props) {
  const [member, setMember] = useState<StoreMember | null>(null);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [justJoined, setJustJoined] = useState(false);

  useEffect(() => {
    function sync() {
      setMember(getLoggedInMember(storeSlug));
    }
    sync();
    window.addEventListener("taiwanbiz-storage", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("taiwanbiz-storage", sync);
      window.removeEventListener("storage", sync);
    };
  }, [storeSlug]);

  const shell =
    tone === "nail"
      ? "border-rose-400/25 from-rose-950/50 via-slate-950 to-violet-950/40"
      : tone === "shop"
        ? "border-teal-400/25 from-teal-950/50 via-slate-950 to-slate-950"
        : "border-amber-400/25 from-amber-950/45 via-slate-950 to-emerald-950/35";

  const accentBtn =
    tone === "nail"
      ? "bg-rose-400 text-slate-950 hover:bg-rose-300"
      : tone === "shop"
        ? "bg-teal-400 text-slate-950 hover:bg-teal-300"
        : "bg-amber-500 text-slate-950 hover:bg-amber-400";

  const monthlyPerk = useMemo(
    () =>
      tone === "nail"
        ? {
            title: "10 月熟客專屬優惠券",
            detail: "經典凝膠現折 NT$150（會員價）",
            code: "VIP-OCT-NAIL",
          }
        : tone === "shop"
          ? {
              title: "10 月熟客專屬優惠券",
              detail: "全館現貨單筆現折 NT$100",
              code: "VIP-OCT-SHOP",
            }
          : {
              title: "10 月熟客專屬優惠券",
              detail: "全品項飲品第二杯 8 折",
              code: "VIP-OCT-BRUNCH",
            },
    [tone],
  );

  const memberMenu = useMemo(
    () =>
      tone === "nail"
        ? [
            { name: "會員專屬・深層指緣護理", price: 580, origin: 680 },
            { name: "會員專屬・卸甲養護組合", price: 390, origin: 450 },
          ]
        : tone === "shop"
          ? [
              { name: "會員專屬・亞麻襯衫加購價", price: 1080, origin: 1280 },
              { name: "會員專屬・帆布托特包", price: 790, origin: 890 },
            ]
          : [
              { name: "會員專屬・莊園拿鐵升級組", price: 120, origin: 160 },
              { name: "會員專屬・巷弄早午餐盤", price: 250, origin: 280 },
            ],
    [tone],
  );

  function handleJoin(e: FormEvent) {
    e.preventDefault();
    setError("");
    const normalized = normalizeTaiwanMobile(phone);
    if (!isValidTaiwanMobile(normalized)) {
      setError("請輸入正確的台灣手機號碼（09 開頭共 10 碼）");
      return;
    }
    const result = upsertStoreMember(storeSlug, normalized);
    if (!result.ok) {
      setError("儲存失敗，請稍後再試或更換瀏覽器後重試。");
      return;
    }
    setMember(result.member);
    setJustJoined(result.created);
    setPhone("");
  }

  function handleLogout() {
    clearMemberSession(storeSlug);
    setMember(null);
    setJustJoined(false);
  }

  return (
    <section
      id="membership"
      className={`scroll-mt-24 overflow-hidden rounded-3xl border bg-gradient-to-br shadow-xl shadow-black/30 ${shell}`}
    >
      <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="p-5 sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            VIP 會員專區
          </div>
          <h2 className="mt-4 text-xl font-bold tracking-tight text-white sm:text-3xl">
            專屬會員忠誠系統
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base">
            在 {storeName}{" "}
            以手機快速加入／登入，立刻解鎖迎賓禮、每月熟客回購券，以及僅會員可見的隱藏折扣菜單。
          </p>

          <ul className="mt-6 space-y-3 text-sm text-slate-200">
            <li className="flex gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
              <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
              <span>手機／LINE 思維的快速註冊與登入（示範以手機驗證）</span>
            </li>
            <li className="flex gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
              <Gift className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <span>新會員迎賓禮：首次加入自動派發入會折價券（現折 $50）</span>
            </li>
            <li className="flex gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
              <CalendarHeart className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
              <span>每月 1 號自動派發熟客專屬回購優惠</span>
            </li>
            <li className="flex gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
              <span>會員專屬隱藏折扣區：登入後才顯示優惠菜單</span>
            </li>
          </ul>
        </div>

        <div className="border-t border-white/10 bg-black/25 p-5 sm:border-t-0 sm:border-l sm:p-8">
          {!member ? (
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-50">
                <p className="font-semibold">加入會員享入會禮</p>
                <p className="mt-1 leading-relaxed text-emerald-100/90">
                  首次加入送「現折 $50 優惠券」，之後每個月再領熟客專屬禮。輸入手機號碼即可快速加入／登入。
                </p>
              </div>
              <div>
                <Label htmlFor="member-phone" className="text-slate-300">
                  手機號碼
                </Label>
                <Input
                  id="member-phone"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="例如：0912345678"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (error) setError("");
                  }}
                  maxLength={20}
                  className="border-white/10 bg-white/5 text-base text-white placeholder:text-slate-500 sm:text-sm"
                />
              </div>
              {error ? (
                <p className="text-sm text-rose-300" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className={`h-12 w-full text-base ${accentBtn}`}>
                輸入手機號碼快速加入／登入
              </Button>
              <p className="text-xs leading-relaxed text-slate-500">
                示範用途：資料僅保存在此裝置瀏覽器。正式環境可串接 LINE Login
                與簡訊驗證。送出即表示同意店家於會員經營目的範圍內使用本手機號碼。
              </p>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">
                    歡迎回來！VIP 會員卡包
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    會員{" "}
                    <span className="font-medium text-slate-200">
                      {formatTaiwanMobileDisplay(member.phone)}
                    </span>
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="border-white/15 bg-transparent text-slate-200 hover:bg-white/10"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  登出
                </Button>
              </div>

              <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-50">
                <p className="font-semibold">
                  {justJoined ? "新會員迎賓禮已入袋" : "入會禮／專屬折扣碼"}
                </p>
                <p className="mt-1">
                  入會折價券現折 $50・序號{" "}
                  <span className="font-mono font-bold">
                    {member.welcomeCouponCode}
                  </span>
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Ticket className="h-4 w-4 text-emerald-300" />
                  {monthlyPerk.title}
                </div>
                <p className="mt-2 text-sm text-slate-300">{monthlyPerk.detail}</p>
                <p className="mt-3 inline-flex rounded-lg bg-black/30 px-3 py-1.5 font-mono text-sm tracking-wider text-emerald-200">
                  {monthlyPerk.code}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Lock className="h-4 w-4 text-violet-300" />
                  會員專屬隱藏折扣區
                </div>
                <ul className="mt-3 space-y-2">
                  {memberMenu.map((item) => (
                    <li
                      key={item.name}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm"
                    >
                      <span className="min-w-0 break-words text-slate-100">
                        {item.name}
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="mr-2 text-xs text-slate-500 line-through">
                          NT$ {item.origin}
                        </span>
                        <span className="font-bold text-amber-200">
                          NT$ {item.price}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function MembershipSection(props: Props) {
  const ready = useClientReady();
  if (!ready) {
    return (
      <section
        id="membership"
        className="h-72 animate-pulse rounded-3xl border border-white/10 bg-white/5"
        aria-hidden
      />
    );
  }
  return <MembershipSectionClient {...props} />;
}
