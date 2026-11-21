"use client";

import { Button } from "@/components/ui/button";
import type { BankTransferReport } from "@/lib/bank-transfer";
import { formatTwd } from "@/lib/pricing";
import { useCallback, useEffect, useState } from "react";

export function AdminBankTransferPanel() {
  const [pending, setPending] = useState<BankTransferReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/bank-transfer", { cache: "no-store" });
      const data = (await res.json()) as {
        pending?: BankTransferReport[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "載入失敗");
      setPending(data.pending || []);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(id: string, action: "approve" | "reject") {
    setBusyId(id);
    setMessage("");
    try {
      const res = await fetch("/api/billing/bank-transfer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "操作失敗");
      setMessage(data.message || (action === "approve" ? "已開通" : "已退回"));
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "操作失敗");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-amber-400/20 bg-slate-900/80 shadow-xl shadow-black/30">
      <div className="border-b border-white/10 px-4 py-4 sm:px-5">
        <h2 className="text-lg font-bold text-white">
          歷史匯款單（已停收・僅清庫）
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          訂閱已改為綠界線上付款，不再接受新匯款回報。此處僅供清掉歷史 pending
          單；確認開通後 expires_at 依方案展延 30 或 365 天。
        </p>
      </div>
      <div className="space-y-3 p-4">
        {loading ? (
          <p className="text-sm text-slate-400">載入中…</p>
        ) : pending.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-slate-400">
            無歷史待清匯款單（新訂閱請走綠界）
          </p>
        ) : (
          pending.map((r) => (
            <article
              key={r.id}
              className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">{r.storeName}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {r.storeId} · {r.ownerEmail}
                  </p>
                  <p className="mt-2 text-sm text-amber-100">
                    {r.planName} · {formatTwd(r.amount)} · 後五碼{" "}
                    <span className="font-mono font-bold">{r.last5}</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    轉帳日 {r.transferDate} · 提交{" "}
                    {new Date(r.createdAt).toLocaleString("zh-TW", {
                      timeZone: "Asia/Taipei",
                    })}
                    {r.referralCode
                      ? ` · 同業推薦碼 ${r.referralCode}（首月現折）`
                      : ""}
                    {r.creditApplied
                      ? ` · 扣抵 $${r.creditApplied}`
                      : ""}
                    {r.note ? ` · ${r.note}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={busyId === r.id}
                    className="bg-emerald-600 hover:bg-emerald-500"
                    onClick={() => void review(r.id, "approve")}
                  >
                    確認開通
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busyId === r.id}
                    className="border-rose-400/40 text-rose-200"
                    onClick={() => void review(r.id, "reject")}
                  >
                    退回／聯絡賣家
                  </Button>
                </div>
              </div>
            </article>
          ))
        )}
        {message ? (
          <p className="text-sm text-emerald-300" role="status">
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
