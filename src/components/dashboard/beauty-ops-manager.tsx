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
  DEFAULT_BOOKING_TERMS,
  createBlacklistEntry,
  defaultCareRetargeting,
  normalizeBlacklists,
  normalizeCareRetargeting,
  normalizeCustomers,
  normalizeStaffMembers,
  patchCustomerCrm,
  toCustomerCrmRow,
  type CareRetargetingSettings,
  type StoreBlacklistEntry,
  type StoreCustomerCrm,
  type StoreStaffMember,
} from "@/lib/beauty-ops";
import { WEEKDAY_KEYS, WEEKDAY_LABELS } from "@/lib/business-hours";
import { normalizeTaiwanMobile } from "@/lib/phone";
import { useActiveStore } from "@/lib/use-active-store";
import { useClientReady } from "@/lib/use-client-ready";
import { Ban, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

function BeautyOpsClient() {
  const { slug } = useActiveStore();
  const [bookingTerms, setBookingTerms] = useState(DEFAULT_BOOKING_TERMS);
  const [staff, setStaff] = useState<StoreStaffMember[]>([]);
  const [blacklists, setBlacklists] = useState<StoreBlacklistEntry[]>([]);
  const [customers, setCustomers] = useState<StoreCustomerCrm[]>([]);
  const [reviewUrl, setReviewUrl] = useState("");
  const [reviewIgHint, setReviewIgHint] = useState("");
  const [careRetargeting, setCareRetargeting] = useState<CareRetargetingSettings>(
    () => defaultCareRetargeting(),
  );
  const [blPhone, setBlPhone] = useState("");
  const [blEmail, setBlEmail] = useState("");
  const [blUserId, setBlUserId] = useState("");
  const [blReason, setBlReason] = useState("");
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(
    null,
  );
  const [baselineCustomers, setBaselineCustomers] = useState<
    StoreCustomerCrm[]
  >([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const closeToast = useCallback(() => setToastOpen(false), []);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `/api/stores/${encodeURIComponent(slug)}/content`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          content?: {
            bookingTerms?: string;
            staff?: StoreStaffMember[];
            blacklists?: StoreBlacklistEntry[];
            customers?: StoreCustomerCrm[];
            careRetargeting?: CareRetargetingSettings;
            reviewUrl?: string;
            reviewIgHint?: string;
          };
        };
        if (cancelled || !data.content) return;
        setBookingTerms(data.content.bookingTerms || DEFAULT_BOOKING_TERMS);
        setStaff(normalizeStaffMembers(data.content.staff));
        setBlacklists(normalizeBlacklists(data.content.blacklists));
        const crm = normalizeCustomers(data.content.customers);
        setCustomers(crm);
        setBaselineCustomers(crm);
        setCareRetargeting(
          normalizeCareRetargeting(data.content.careRetargeting),
        );
        setReviewUrl(data.content.reviewUrl || "");
        setReviewIgHint(data.content.reviewIgHint || "");
      } catch {
        /* ignore */
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function save() {
    if (!slug) {
      setError("請先選擇／綁定店家");
      return;
    }
    setSaving(true);
    setError("");
    try {
      // 儲存前：對有異動的顧客寫入 history
      let nextCustomers = normalizeCustomers(customers);
      for (const c of nextCustomers) {
        const prev = baselineCustomers.find((x) => x.id === c.id);
        if (!prev) continue;
        if (
          prev.storeCredit !== c.storeCredit ||
          prev.packageNotes !== c.packageNotes ||
          (prev.hairNotes || "") !== (c.hairNotes || "") ||
          (prev.colorRecipe || "") !== (c.colorRecipe || "")
        ) {
          nextCustomers = patchCustomerCrm(nextCustomers, c.id, {
            storeCredit: c.storeCredit,
            packageNotes: c.packageNotes,
            hairNotes: c.hairNotes,
            colorRecipe: c.colorRecipe,
          });
        }
      }
      const res = await fetch(
        `/api/stores/${encodeURIComponent(slug)}/content`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingTerms: bookingTerms.trim() || DEFAULT_BOOKING_TERMS,
            staff: normalizeStaffMembers(staff),
            blacklists: normalizeBlacklists(blacklists),
            customers: nextCustomers,
            careRetargeting: normalizeCareRetargeting(careRetargeting),
            reviewUrl: reviewUrl.trim(),
            reviewIgHint: reviewIgHint.trim(),
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "儲存失敗");
      setCustomers(nextCustomers);
      setBaselineCustomers(nextCustomers);
      setToastOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  function addStaff() {
    setStaff((list) => [
      ...list,
      {
        id: `staff_${Date.now().toString(36)}`,
        name: "新設計師",
        role: "stylist",
        useStoreHours: true,
        active: true,
      },
    ]);
  }

  function addBlacklist(from?: {
    phone?: string;
    email?: string;
    userId?: string;
    reason?: string;
  }) {
    const phone = normalizeTaiwanMobile(from?.phone || blPhone);
    const email = (from?.email || blEmail).trim().toLowerCase();
    const userId = (from?.userId || blUserId).trim();
    if (!phone && !email && !userId) {
      setError("請輸入手機、Email 或 user_id 至少一項");
      return;
    }
    setBlacklists((list) => [
      createBlacklistEntry({
        phone: phone || undefined,
        email: email || undefined,
        userId: userId || undefined,
        reason: (from?.reason || blReason).trim() || undefined,
      }),
      ...list,
    ]);
    setBlPhone("");
    setBlEmail("");
    setBlUserId("");
    setBlReason("");
    setError("");
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          美業營運保護
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          預約須知與條款、防放鳥黑名單、服務人員與熟客維護。預約日曆與參考圖請至{" "}
          <Link
            href="/dashboard/bookings"
            className="font-semibold text-stone-800 underline-offset-2 hover:underline"
          >
            預約日曆
          </Link>
          。
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>預約須知設定（Terms & Policy）</CardTitle>
            <CardDescription>
              前台會顯示此文案，並要求買家勾選「我已閱讀並同意店家預約與取消須知」後才能送出。
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setBookingTerms(DEFAULT_BOOKING_TERMS)}
          >
            還原範本
          </Button>
        </CardHeader>
        <CardContent>
          <Textarea
            value={bookingTerms}
            onChange={(e) => setBookingTerms(e.target.value)}
            rows={8}
            className="font-sans text-sm"
            placeholder={DEFAULT_BOOKING_TERMS}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>多設計師獨立排班（stylist）</CardTitle>
            <CardDescription>
              前台可指定設計師；每位設計師可沿用店家營業時間，或設定個人週排班。預約防重疊依「該設計師班表＋其已約時段」計算。
            </CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={addStaff}>
            <Plus className="h-4 w-4" />
            新增設計師
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {staff.map((member) => (
            <div
              key={member.id}
              className="space-y-3 rounded-xl border border-slate-200 p-3"
            >
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
                <div>
                  <Label>姓名</Label>
                  <Input
                    value={member.name}
                    onChange={(e) =>
                      setStaff((list) =>
                        list.map((s) =>
                          s.id === member.id
                            ? { ...s, name: e.target.value }
                            : s,
                        ),
                      )
                    }
                  />
                </div>
                <div>
                  <Label>LINE userId（選填）</Label>
                  <Input
                    value={member.lineUserId || ""}
                    onChange={(e) =>
                      setStaff((list) =>
                        list.map((s) =>
                          s.id === member.id
                            ? { ...s, lineUserId: e.target.value }
                            : s,
                        ),
                      )
                    }
                    placeholder="Uxxxxxxxx"
                  />
                </div>
                <div className="flex items-end">
                  <label className="mb-2 inline-flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={Boolean(member.isOwner)}
                      onChange={(e) =>
                        setStaff((list) =>
                          list.map((s) =>
                            s.id === member.id
                              ? { ...s, isOwner: e.target.checked }
                              : e.target.checked
                                ? { ...s, isOwner: false }
                                : s,
                          ),
                        )
                      }
                    />
                    店長／預設
                  </label>
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={member.isOwner && staff.length <= 1}
                    onClick={() =>
                      setStaff((list) => list.filter((s) => s.id !== member.id))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={member.useStoreHours !== false}
                    onChange={(e) =>
                      setStaff((list) =>
                        list.map((s) =>
                          s.id === member.id
                            ? { ...s, useStoreHours: e.target.checked }
                            : s,
                        ),
                      )
                    }
                  />
                  沿用店家營業時間
                </label>
                <span className="text-slate-400">role: stylist</span>
              </div>
              {member.useStoreHours === false ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {WEEKDAY_KEYS.map((key) => {
                    const day = member.week?.[key] || {
                      open: true,
                      start: "10:00",
                      end: "20:00",
                    };
                    return (
                      <div
                        key={`${member.id}-${key}`}
                        className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-2"
                      >
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                          <input
                            type="checkbox"
                            checked={day.open}
                            onChange={(e) =>
                              setStaff((list) =>
                                list.map((s) =>
                                  s.id === member.id
                                    ? {
                                        ...s,
                                        week: {
                                          ...(s.week || {}),
                                          [key]: {
                                            ...day,
                                            open: e.target.checked,
                                          },
                                        },
                                      }
                                    : s,
                                ),
                              )
                            }
                          />
                          {WEEKDAY_LABELS[key]}
                        </label>
                        <div className="mt-1 flex gap-1">
                          <Input
                            type="time"
                            className="h-8 text-xs"
                            value={day.start}
                            disabled={!day.open}
                            onChange={(e) =>
                              setStaff((list) =>
                                list.map((s) =>
                                  s.id === member.id
                                    ? {
                                        ...s,
                                        week: {
                                          ...(s.week || {}),
                                          [key]: {
                                            ...day,
                                            start: e.target.value,
                                          },
                                        },
                                      }
                                    : s,
                                ),
                              )
                            }
                          />
                          <Input
                            type="time"
                            className="h-8 text-xs"
                            value={day.end}
                            disabled={!day.open}
                            onChange={(e) =>
                              setStaff((list) =>
                                list.map((s) =>
                                  s.id === member.id
                                    ? {
                                        ...s,
                                        week: {
                                          ...(s.week || {}),
                                          [key]: {
                                            ...day,
                                            end: e.target.value,
                                          },
                                        },
                                      }
                                    : s,
                                ),
                              )
                            }
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>防放鳥黑名單（blacklists）</CardTitle>
          <CardDescription>
            資料欄位：phone / email / user_id。被列入的電話或 Email
            無法透過線上預約，前台會提示改以電話聯繫店家。亦可從「預約日曆」訂單一鍵加入。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label>手機 phone</Label>
              <Input
                value={blPhone}
                onChange={(e) => setBlPhone(e.target.value)}
                placeholder="0912345678"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                value={blEmail}
                onChange={(e) => setBlEmail(e.target.value)}
                placeholder="guest@example.com"
              />
            </div>
            <div>
              <Label>user_id（選填）</Label>
              <Input
                value={blUserId}
                onChange={(e) => setBlUserId(e.target.value)}
                placeholder="LINE Uxxxxxxxx"
              />
            </div>
            <div>
              <Label>原因（選填）</Label>
              <Input
                value={blReason}
                onChange={(e) => setBlReason(e.target.value)}
                placeholder="多次放鳥／惡意取消"
              />
            </div>
          </div>
          <Button type="button" onClick={() => addBlacklist()}>
            <Ban className="h-4 w-4" />
            加入黑名單
          </Button>
          <ul className="space-y-2 text-sm">
            {blacklists.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2"
              >
                <span>
                  {[b.phone, b.email, b.userId].filter(Boolean).join(" · ")}
                  {b.reason ? ` · ${b.reason}` : ""}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    setBlacklists((list) => list.filter((x) => x.id !== b.id))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
            {!blacklists.length ? (
              <li className="text-slate-400">尚無黑名單</li>
            ) : null}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>顧客 CRM（儲值／包套／髮況配方）</CardTitle>
          <CardDescription>
            欄位 store_credit／package_notes／hair_notes／color_recipe。預約成功會自動建立顧客；編輯會寫入歷史紀錄。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {customers.slice(0, 30).map((c) => {
            const row = toCustomerCrmRow(c);
            const expanded = expandedCustomerId === c.id;
            return (
              <div
                key={c.id}
                className="space-y-2 rounded-xl border border-slate-200 p-3"
              >
                <div className="grid gap-2 sm:grid-cols-[1.2fr_1fr_1.4fr_auto]">
                  <div>
                    <Label>顧客</Label>
                    <p className="mt-1.5 text-sm font-medium text-slate-800">
                      {c.name || "（未命名）"} · {c.phone}
                    </p>
                  </div>
                  <div>
                    <Label>儲值餘額 store_credit</Label>
                    <Input
                      type="number"
                      min={0}
                      value={c.storeCredit}
                      onChange={(e) =>
                        setCustomers((list) =>
                          list.map((x) =>
                            x.id === c.id
                              ? {
                                  ...x,
                                  storeCredit: Math.max(
                                    0,
                                    Number(e.target.value) || 0,
                                  ),
                                }
                              : x,
                          ),
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label>包套備註 package_notes</Label>
                    <Input
                      value={c.packageNotes}
                      onChange={(e) =>
                        setCustomers((list) =>
                          list.map((x) =>
                            x.id === c.id
                              ? { ...x, packageNotes: e.target.value }
                              : x,
                          ),
                        )
                      }
                      placeholder="例：美甲包套剩 2 次"
                    />
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setExpandedCustomerId((id) =>
                          id === c.id ? null : c.id,
                        )
                      }
                    >
                      {expanded ? "收合詳情" : "髮況詳情"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setHistoryId((id) => (id === c.id ? null : c.id))
                      }
                    >
                      歷史
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-rose-300 text-rose-800"
                      onClick={() =>
                        addBlacklist({
                          phone: c.phone,
                          email: c.email,
                          reason: "顧客列表手動加入",
                        })
                      }
                    >
                      <Ban className="h-4 w-4" />
                      加入黑名單
                    </Button>
                  </div>
                </div>
                {expanded ? (
                  <div className="grid gap-3 rounded-xl border border-amber-200/80 bg-amber-50/60 p-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor={`hair-${c.id}`}>
                        髮況紀錄 hair_notes
                      </Label>
                      <Textarea
                        id={`hair-${c.id}`}
                        rows={4}
                        value={c.hairNotes || ""}
                        onChange={(e) =>
                          setCustomers((list) =>
                            list.map((x) =>
                              x.id === c.id
                                ? { ...x, hairNotes: e.target.value }
                                : x,
                            ),
                          )
                        }
                        placeholder="例：漂過兩次、髮質偏乾、上次修護蛋白…"
                        className="mt-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`recipe-${c.id}`}>
                        染劑配方 color_recipe
                      </Label>
                      <Textarea
                        id={`recipe-${c.id}`}
                        rows={4}
                        value={c.colorRecipe || ""}
                        onChange={(e) =>
                          setCustomers((list) =>
                            list.map((x) =>
                              x.id === c.id
                                ? { ...x, colorRecipe: e.target.value }
                                : x,
                            ),
                          )
                        }
                        placeholder="例：7N 30g + 8G 10g / 6% 40ml，留色 35 分…"
                        className="mt-1.5 text-sm"
                      />
                    </div>
                  </div>
                ) : null}
                {historyId === c.id ? (
                  <ul className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    {(row.history || []).length === 0 ? (
                      <li>尚無異動紀錄</li>
                    ) : (
                      row.history.slice(0, 10).map((h, i) => (
                        <li key={`${c.id}-h-${i}`} className="py-1">
                          {new Date(h.at).toLocaleString("zh-TW", {
                            timeZone: "Asia/Taipei",
                          })}
                          ：{h.note}
                          {typeof h.storeCredit === "number"
                            ? `（餘額 ${h.storeCredit}）`
                            : ""}
                        </li>
                      ))
                    )}
                  </ul>
                ) : null}
              </div>
            );
          })}
          {!customers.length ? (
            <p className="text-sm text-slate-400">
              尚無顧客；完成預約後會自動出現在此。
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>燙染後自動回護理推播</CardTitle>
          <CardDescription>
            當預約項目含「燙髮／染髮」標籤（或名稱含燙／染）時，於服務完成後 N
            天經 LINE／Email 推播護理提醒與回購預約連結。可在服務項目設定 tags。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={careRetargeting.enabled}
              onChange={(e) =>
                setCareRetargeting((c) => ({
                  ...c,
                  enabled: e.target.checked,
                }))
              }
            />
            啟用燙染護理回購推播
          </label>
          <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
            <div>
              <Label>完成後天數</Label>
              <Input
                type="number"
                min={1}
                max={180}
                value={careRetargeting.daysAfter}
                onChange={(e) =>
                  setCareRetargeting((c) => ({
                    ...c,
                    daysAfter: Math.max(
                      1,
                      Math.min(180, Number(e.target.value) || 30),
                    ),
                  }))
                }
              />
            </div>
            <div>
              <Label>推播文案（可用 {"{name}"} {"{service}"} {"{bookingUrl}"}）</Label>
              <Textarea
                rows={3}
                value={careRetargeting.message || ""}
                onChange={(e) =>
                  setCareRetargeting((c) => ({
                    ...c,
                    message: e.target.value,
                  }))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>課後自動關心與五星好評導流</CardTitle>
          <CardDescription>
            預約完成當天晚上約 20:00（晚間檔次改次日
            10:00）自動經 LINE／Email 推播關心訊息，並附上 IG 標記優惠與 Google
            商家評論連結。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Google 商家／評論連結</Label>
            <Input
              value={reviewUrl}
              onChange={(e) => setReviewUrl(e.target.value)}
              placeholder="https://g.page/r/..."
            />
          </div>
          <div className="sm:col-span-2">
            <Label>IG 標記優惠文案</Label>
            <Textarea
              value={reviewIgHint}
              onChange={(e) => setReviewIgHint(e.target.value)}
              placeholder="完成服務後歡迎在 IG 標記本店…"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {error ? (
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="button" onClick={() => void save()} disabled={saving}>
        {saving ? "儲存中…" : "儲存營運設定"}
      </Button>
      <Toast open={toastOpen} onClose={closeToast} message="已儲存營運設定" />
    </div>
  );
}

export function BeautyOpsManager() {
  const ready = useClientReady();
  if (!ready) {
    return <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />;
  }
  return <BeautyOpsClient />;
}
