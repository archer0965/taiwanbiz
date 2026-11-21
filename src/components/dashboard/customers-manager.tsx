"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Toast } from "@/components/ui/toast";
import {
  createBlacklistEntry,
  customerCompletionRate,
  isBlacklisted,
  normalizeBlacklists,
  normalizeCustomers,
  patchCustomerCrm,
  toCustomerCrmRow,
  type StoreBlacklistEntry,
  type StoreCustomerCrm,
} from "@/lib/beauty-ops";
import { normalizeTaiwanMobile } from "@/lib/phone";
import { useActiveStore } from "@/lib/use-active-store";
import { useClientReady } from "@/lib/use-client-ready";
import { Ban, Save, ShieldOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

function CustomersClient() {
  const { slug } = useActiveStore();
  const [customers, setCustomers] = useState<StoreCustomerCrm[]>([]);
  const [blacklists, setBlacklists] = useState<StoreBlacklistEntry[]>([]);
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const closeToast = useCallback(() => setToastOpen(false), []);

  const load = useCallback(async () => {
    if (!slug) return;
    const res = await fetch(
      `/api/stores/${encodeURIComponent(slug)}/content`,
      { cache: "no-store" },
    );
    if (!res.ok) return;
    const data = (await res.json()) as {
      content?: {
        customers?: StoreCustomerCrm[];
        blacklists?: StoreBlacklistEntry[];
      };
    };
    setCustomers(normalizeCustomers(data.content?.customers));
    setBlacklists(normalizeBlacklists(data.content?.blacklists));
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.phone.includes(q) ||
        (c.name || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q),
    );
  }, [customers, query]);

  async function saveContent(patch: {
    customers?: StoreCustomerCrm[];
    blacklists?: StoreBlacklistEntry[];
  }) {
    if (!slug) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/stores/${encodeURIComponent(slug)}/content`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "儲存失敗");
      setToastMsg("已儲存");
      setToastOpen(true);
      await load();
    } catch (err) {
      setToastMsg(err instanceof Error ? err.message : "儲存失敗");
      setToastOpen(true);
    } finally {
      setSaving(false);
    }
  }

  async function toggleBlacklist(c: StoreCustomerCrm, enable: boolean) {
    if (!slug) return;
    if (enable) {
      const reason =
        window.prompt("黑名單原因（選填）", "店家手動拉黑") || "店家手動拉黑";
      const entry = createBlacklistEntry({
        phone: c.phone,
        email: c.email,
        reason,
      });
      const next = [entry, ...blacklists.filter((b) => b.phone !== c.phone)];
      setBlacklists(next);
      await saveContent({ blacklists: next });
      return;
    }
    const next = blacklists.filter((b) => b.phone !== c.phone);
    setBlacklists(next);
    // Also call bookings API for consistency
    await fetch(`/api/stores/${encodeURIComponent(slug)}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unblacklist", phone: c.phone }),
    });
    await saveContent({ blacklists: next });
  }

  function updateLocal(id: string, patch: Partial<StoreCustomerCrm>) {
    setCustomers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  }

  async function saveCustomer(c: StoreCustomerCrm) {
    const next = patchCustomerCrm(customers, c.id, {
      storeCredit: c.storeCredit,
      packageNotes: c.packageNotes,
      hairNotes: c.hairNotes,
      colorRecipe: c.colorRecipe,
      preferenceNotes: c.preferenceNotes,
    });
    setCustomers(next);
    await saveContent({ customers: next });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
          顧客 CRM
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          預約次數、完成率與偏好備註；黑名單顧客無法在前台完成預約。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>搜尋顧客</CardTitle>
          <CardDescription>依姓名、電話或 Email</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="例：0912 或小美"
          />
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-stone-500">
            尚無顧客資料。顧客線上或現場預約後會自動建立。
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => {
            const row = toCustomerCrmRow(c);
            const blocked = isBlacklisted({
              phone: c.phone,
              email: c.email,
              list: blacklists,
            });
            const open = expandedId === c.id;
            return (
              <Card
                key={c.id}
                className={blocked ? "border-rose-200 bg-rose-50/30" : undefined}
              >
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <button
                      type="button"
                      className="text-left"
                      onClick={() =>
                        setExpandedId(open ? null : c.id)
                      }
                    >
                      <CardTitle className="text-base">
                        {c.name || "未命名顧客"} ·{" "}
                        {normalizeTaiwanMobile(c.phone) || c.phone}
                      </CardTitle>
                      <CardDescription>
                        預約 {row.booking_count} 次 · 完成率{" "}
                        {customerCompletionRate(c)}% · 完成{" "}
                        {row.completed_count}／取消 {row.cancelled_count}／未到{" "}
                        {row.no_show_count}
                        {blocked ? " · 黑名單中" : ""}
                      </CardDescription>
                    </button>
                    <Button
                      type="button"
                      variant="outline"
                      className={
                        blocked
                          ? "border-stone-300 text-stone-700"
                          : "border-rose-300 text-rose-800"
                      }
                      disabled={saving}
                      onClick={() => void toggleBlacklist(c, !blocked)}
                    >
                      {blocked ? (
                        <>
                          <ShieldOff className="h-4 w-4" />
                          解除黑名單
                        </>
                      ) : (
                        <>
                          <Ban className="h-4 w-4" />
                          加入黑名單
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                {open ? (
                  <CardContent className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label>儲值餘額</Label>
                        <Input
                          className="mt-1"
                          type="number"
                          value={c.storeCredit}
                          onChange={(e) =>
                            updateLocal(c.id, {
                              storeCredit: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label>最近預約</Label>
                        <Input
                          className="mt-1"
                          value={c.lastBookingAt?.slice(0, 16) || "—"}
                          readOnly
                        />
                      </div>
                    </div>
                    <div>
                      <Label>偏好備註</Label>
                      <Textarea
                        className="mt-1"
                        rows={2}
                        value={c.preferenceNotes || ""}
                        onChange={(e) =>
                          updateLocal(c.id, {
                            preferenceNotes: e.target.value,
                          })
                        }
                        placeholder="過敏、指定設計師、溝通偏好…"
                      />
                    </div>
                    <div>
                      <Label>包套／票券備註</Label>
                      <Textarea
                        className="mt-1"
                        rows={2}
                        value={c.packageNotes}
                        onChange={(e) =>
                          updateLocal(c.id, { packageNotes: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>髮況／配方</Label>
                      <Textarea
                        className="mt-1"
                        rows={2}
                        value={
                          [c.hairNotes, c.colorRecipe]
                            .filter(Boolean)
                            .join("\n") || ""
                        }
                        onChange={(e) => {
                          const [hair, ...rest] = e.target.value.split("\n");
                          updateLocal(c.id, {
                            hairNotes: hair || "",
                            colorRecipe: rest.join("\n"),
                          });
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      disabled={saving}
                      className="bg-teal-700 hover:bg-teal-800"
                      onClick={() => void saveCustomer(c)}
                    >
                      <Save className="h-4 w-4" />
                      儲存此顧客
                    </Button>
                  </CardContent>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      <Toast open={toastOpen} onClose={closeToast} message={toastMsg} />
    </div>
  );
}

export function CustomersManager() {
  const ready = useClientReady();
  if (!ready) {
    return (
      <div className="min-h-[240px] animate-pulse rounded-2xl bg-stone-100" />
    );
  }
  return <CustomersClient />;
}
