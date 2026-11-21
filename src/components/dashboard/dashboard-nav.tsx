"use client";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { isDeveloperEmail } from "@/lib/roles";
import { getTenantsByOwnerEmail } from "@/lib/tenant-storage";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  Clock3,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Package,
  Palette,
  Settings2,
  Shield,
  Store,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export function DashboardNav() {
  const pathname = usePathname();
  const { data } = useSession();
  const email = data?.user?.email;
  const isAdmin = isDeveloperEmail(email);
  const [ownerSlug, setOwnerSlug] = useState<string | null>(null);
  const [ownerKey, setOwnerKey] = useState(email ?? "");

  const normalizedEmail = email?.trim().toLowerCase() ?? "";
  if (normalizedEmail !== ownerKey) {
    setOwnerKey(normalizedEmail);
    if (!normalizedEmail || isAdmin) {
      setOwnerSlug(null);
    } else if (typeof window !== "undefined") {
      setOwnerSlug(getTenantsByOwnerEmail(normalizedEmail)[0]?.slug ?? null);
    }
  }

  useEffect(() => {
    if (!email || isAdmin) return;
    function sync() {
      setOwnerSlug(getTenantsByOwnerEmail(email ?? "")[0]?.slug ?? null);
    }
    window.addEventListener("taiwanbiz-storage", sync);
    return () => window.removeEventListener("taiwanbiz-storage", sync);
  }, [email, isAdmin]);

  const links = useMemo(() => {
    const previewHref = ownerSlug
      ? `/stores/${ownerSlug}`
      : "/stores/brunch-house";
    const base = [
      {
        href: "/dashboard",
        label: "數據總覽",
        short: "總覽",
        icon: LayoutDashboard,
      },
      {
        href: "/dashboard/store",
        label: "店家設定",
        short: "店家",
        icon: Settings2,
      },
      {
        href: "/dashboard/style",
        label: "網站風格",
        short: "風格",
        icon: Palette,
      },
      {
        href: "/dashboard/billing",
        label: "訂閱付款",
        short: "訂閱",
        icon: CreditCard,
      },
      {
        href: "/dashboard/products",
        label: "服務項目",
        short: "服務",
        icon: Package,
      },
      {
        href: "/dashboard/hours",
        label: "營業時間與時段",
        short: "時段",
        icon: Clock3,
      },
      {
        href: "/dashboard/bookings",
        label: "預約日曆",
        short: "預約",
        icon: CalendarDays,
      },
      {
        href: "/dashboard/customers",
        label: "顧客 CRM",
        short: "顧客",
        icon: UserRound,
      },
      {
        href: "/dashboard/deposit",
        label: "訂金開關",
        short: "訂金",
        icon: Wallet,
      },
      {
        href: "/dashboard/ops",
        label: "營運保護",
        short: "營運",
        icon: Users,
      },
      {
        href: "/dashboard/campaigns/new",
        label: "刮刮樂活動",
        short: "刮刮",
        icon: Megaphone,
      },
      {
        href: previewHref,
        label: "預覽前台",
        short: "前台",
        icon: Store,
      },
    ];
    if (isAdmin) {
      base.unshift({
        href: "/admin/dashboard",
        label: "總管理後台",
        short: "總管",
        icon: Shield,
      });
    }
    return base;
  }, [isAdmin, ownerSlug]);

  return (
    <aside className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/90 lg:static lg:flex lg:min-h-screen lg:w-64 lg:flex-col lg:border-b-0 lg:border-r lg:bg-white lg:backdrop-blur-none">
      <div className="flex h-14 items-center gap-2.5 border-b border-slate-100 px-4 pt-[env(safe-area-inset-top,0px)] sm:h-16 sm:px-5">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <BrandLogo size={36} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-slate-900">
              拓脈
            </span>
            <span className="block truncate text-[11px] text-slate-400">
              {isAdmin ? "總管理員" : "店家後台"} ·{" "}
              {data?.user?.email || "Nova Crest Pulse"}
            </span>
          </span>
        </Link>
      </div>
      <nav
        className="scroll-x-touch flex gap-1 overflow-x-auto px-3 py-2.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden lg:flex-1 lg:flex-col lg:overflow-y-auto lg:overflow-x-visible lg:py-3 lg:[scrollbar-width:thin] lg:[&::-webkit-scrollbar]:block"
        aria-label="後台導覽"
      >
        {links.map((link) => {
          const active =
            link.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "touch-target inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              <link.icon className="h-4 w-4 shrink-0" />
              <span className="sm:hidden">{link.short}</span>
              <span className="hidden sm:inline">{link.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="touch-target inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 lg:hidden"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>登出</span>
        </button>
      </nav>
      <div className="hidden border-t border-slate-100 p-3 lg:block">
        <p className="truncate px-2 text-xs text-slate-400">
          {data?.user?.name || "未登入使用者"}
        </p>
        {!isAdmin && ownerSlug ? (
          <p className="mt-1 truncate px-2 text-xs text-emerald-700">
            綁定店家：/stores/{ownerSlug}
          </p>
        ) : null}
        <Button
          variant="ghost"
          className="mt-2 w-full justify-start"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          <LogOut className="h-4 w-4" />
          登出
        </Button>
      </div>
    </aside>
  );
}
