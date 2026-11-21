"use client";

import { Button } from "@/components/ui/button";
import { BarChart3, Eye, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Summary = {
  totalViews: number;
  todayViews: number;
  yesterdayViews: number;
  last7Views: number;
  last30Views: number;
  updatedAt: string;
  daily: Array<{ date: string; total: number }>;
  topPaths: Array<{ path: string; views: number; share: number }>;
  categories: Array<{ id: string; label: string; views: number }>;
  backend: string;
};

function formatWhen(iso: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("zh-TW", { hour12: false });
  } catch {
    return iso;
  }
}

export function SiteAnalyticsPanel() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/analytics", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "載入失敗");
      setData(json as Summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入失敗");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const maxDaily = useMemo(
    () => Math.max(1, ...(data?.daily.map((d) => d.total) || [1])),
    [data],
  );

  const cards = data
    ? [
        { label: "今日瀏覽", value: data.todayViews },
        { label: "昨日瀏覽", value: data.yesterdayViews },
        { label: "近 7 日", value: data.last7Views },
        { label: "近 30 日", value: data.last30Views },
        { label: "累計瀏覽", value: data.totalViews },
      ]
    : [];

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 shadow-xl shadow-black/30">
      <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <BarChart3 className="h-5 w-5 text-teal-300" />
            官網瀏覽數據
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            全站公開頁瀏覽（首頁、方案、案例店家、條款等）。後台頁不計入。
            {data?.updatedAt ? (
              <span className="mt-0.5 block text-xs text-slate-500">
                更新於 {formatWhen(data.updatedAt)}
                {data.backend === "blob" ? "・已同步雲端" : "・本機暫存"}
              </span>
            ) : null}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => void load()}
          className="w-full border-white/15 bg-transparent text-slate-200 hover:bg-white/10 sm:w-auto"
        >
          <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
          重新整理
        </Button>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        {error ? (
          <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            {error}
          </p>
        ) : null}

        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          {cards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-3 sm:px-4"
            >
              <p className="text-xs text-slate-400">{card.label}</p>
              <p className="mt-1 flex items-baseline gap-1.5 text-2xl font-bold tabular-nums text-white">
                <Eye className="hidden h-4 w-4 text-teal-300 sm:inline" />
                {card.value.toLocaleString("zh-TW")}
              </p>
            </div>
          ))}
          {!data && !error ? (
            <div className="col-span-2 h-20 animate-pulse rounded-2xl bg-white/5 lg:col-span-5" />
          ) : null}
        </div>

        {data ? (
          <>
            <div>
              <p className="mb-3 text-sm font-semibold text-slate-200">
                近 14 日瀏覽趨勢
              </p>
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-2 pb-2 pt-4 sm:px-3">
                <div className="flex h-40 items-end gap-1 sm:gap-1.5">
                  {data.daily.map((day) => {
                    // 用固定 px，避免 % 高度在 flex 子層算成 0
                    const barPx =
                      day.total <= 0
                        ? 3
                        : Math.max(
                            8,
                            Math.round((day.total / maxDaily) * 140),
                          );
                    return (
                      <div
                        key={day.date}
                        className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                        title={`${day.date}：${day.total.toLocaleString("zh-TW")} 次`}
                      >
                        <span className="pointer-events-none mb-1 hidden rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-teal-100 opacity-0 shadow-lg transition group-hover:opacity-100 sm:block">
                          {day.total}
                        </span>
                        <div
                          className={
                            day.total > 0
                              ? "w-full rounded-t-md bg-gradient-to-t from-teal-500 to-emerald-300"
                              : "w-full rounded-sm bg-white/15"
                          }
                          style={{ height: `${barPx}px` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex gap-1 sm:gap-1.5">
                  {data.daily.map((day, index) => (
                    <div
                      key={`${day.date}-label`}
                      className="min-w-0 flex-1 truncate text-center text-[9px] leading-tight text-slate-500 sm:text-[10px]"
                    >
                      <span className={index % 2 === 1 ? "opacity-0 sm:opacity-100" : undefined}>
                        {day.date.slice(8)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-200">
                  頁面分類
                </p>
                <ul className="space-y-2">
                  {data.categories.length === 0 ? (
                    <li className="rounded-xl border border-dashed border-white/15 px-3 py-6 text-center text-sm text-slate-500">
                      尚無資料；訪客開啟官網後會自動累計
                    </li>
                  ) : (
                    data.categories.map((cat) => (
                      <li
                        key={cat.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2.5 text-sm"
                      >
                        <span className="text-slate-200">{cat.label}</span>
                        <span className="tabular-nums font-semibold text-teal-200">
                          {cat.views.toLocaleString("zh-TW")}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-slate-200">
                  熱門路徑 Top 20
                </p>
                <div className="scroll-y-touch max-h-72 overflow-y-auto rounded-xl border border-white/10">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2 font-semibold">路徑</th>
                        <th className="px-3 py-2 font-semibold text-right">
                          瀏覽
                        </th>
                        <th className="hidden px-3 py-2 font-semibold text-right sm:table-cell">
                          佔比
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {data.topPaths.length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-3 py-6 text-center text-slate-500"
                          >
                            尚無路徑資料
                          </td>
                        </tr>
                      ) : (
                        data.topPaths.map((row) => (
                          <tr key={row.path} className="hover:bg-white/[0.03]">
                            <td className="max-w-[12rem] truncate px-3 py-2 font-mono text-xs text-slate-300 sm:max-w-none">
                              {row.path}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-100">
                              {row.views.toLocaleString("zh-TW")}
                            </td>
                            <td className="hidden px-3 py-2 text-right tabular-nums text-slate-400 sm:table-cell">
                              {row.share}%
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
