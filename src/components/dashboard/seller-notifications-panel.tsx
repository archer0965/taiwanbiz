"use client";

import { Button } from "@/components/ui/button";
import type { SellerNotification } from "@/lib/seller-notifications";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
}

export function SellerNotificationsPanel() {
  const [items, setItems] = useState<SellerNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) {
        setItems([]);
        setUnreadCount(0);
        return;
      }
      const data = (await res.json()) as {
        notifications?: SellerNotification[];
        unreadCount?: number;
      };
      setItems(data.notifications || []);
      setUnreadCount(Number(data.unreadCount) || 0);
    } catch {
      setItems([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read_all" }),
    });
    await load();
  }

  async function markRead(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <section className="rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50 to-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Bell className="mt-0.5 h-5 w-5 text-amber-700" />
          <div>
            <h2 className="text-base font-bold text-amber-950">系統通知</h2>
            <p className="mt-0.5 text-xs text-amber-800/80">
              訂閱到期提醒與服務狀態會顯示於此
              {unreadCount > 0 ? `（未讀 ${unreadCount}）` : ""}
            </p>
          </div>
        </div>
        {unreadCount > 0 ? (
          <Button
            type="button"
            variant="outline"
            className="border-amber-300 text-amber-900"
            onClick={() => void markAllRead()}
          >
            全部標為已讀
          </Button>
        ) : null}
      </div>
      <ul className="mt-4 space-y-2">
        {items.slice(0, 8).map((n) => (
          <li
            key={n.id}
            className={
              n.readAt
                ? "rounded-xl border border-stone-200 bg-white/70 px-3 py-2.5"
                : "rounded-xl border border-amber-300 bg-amber-100/50 px-3 py-2.5"
            }
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-stone-900">{n.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-stone-600">
                  {n.body}
                </p>
                <p className="mt-1 text-[11px] text-stone-400">
                  {formatWhen(n.createdAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {n.href ? (
                  <Link href={n.href}>
                    <Button as="span" className="bg-amber-700 hover:bg-amber-800">
                      前往續費
                    </Button>
                  </Link>
                ) : null}
                {!n.readAt ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void markRead(n.id)}
                  >
                    已讀
                  </Button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
