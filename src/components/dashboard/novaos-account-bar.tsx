"use client";

import { NOVAOS_HUB_URL, NOVAOS_MATRIX } from "@/lib/novaos-matrix";
import { cn } from "@/lib/utils";
import { ExternalLink, Grid3X3, LogOut } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

/** Top-right NovaOS account status + product switcher for merchant admin. */
export function NovaOsAccountBar({ className }: { className?: string }) {
  const { data } = useSession();
  const email = data?.user?.email || "";
  const name = data?.user?.name || email.split("@")[0] || "NovaOS 用戶";
  const [matrixOpen, setMatrixOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setMatrixOpen(false);
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const initials = (name || "?").slice(0, 2).toUpperCase();

  return (
    <div
      ref={rootRef}
      className={cn("flex items-center justify-end gap-2", className)}
    >
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setMatrixOpen((v) => !v);
            setMenuOpen(false);
          }}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-700 shadow-sm hover:bg-stone-50"
          aria-label="切換拓新雲端產品"
          title="快速切換至主站／其他工具"
        >
          <Grid3X3 className="h-4 w-4" />
        </button>
        {matrixOpen ? (
          <div className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-stone-200 bg-white p-2 shadow-xl">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400">
              拓新雲端產品矩陣
            </p>
            {NOVAOS_MATRIX.map((p) => (
              <a
                key={p.href}
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-stone-700 hover:bg-stone-50"
                onClick={() => setMatrixOpen(false)}
              >
                {p.name}
                <ExternalLink className="h-3.5 w-3.5 text-stone-400" />
              </a>
            ))}
          </div>
        ) : null}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setMenuOpen((v) => !v);
            setMatrixOpen(false);
          }}
          className="inline-flex max-w-[12rem] items-center gap-2 rounded-xl border border-stone-200 bg-white py-1 pl-1 pr-2.5 shadow-sm"
          aria-label="拓新雲端 NovaOS 帳號狀態"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-xs font-semibold text-white">
            {initials}
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block truncate text-xs font-semibold text-stone-900">
              拓新雲端 NovaOS 帳號
            </span>
            <span className="block truncate text-[10px] text-stone-500">
              {email || name}
            </span>
          </span>
        </button>
        {menuOpen ? (
          <div className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-stone-200 bg-white p-2 shadow-xl">
            <p className="truncate px-3 py-2 text-xs text-stone-500">{email}</p>
            <a
              href={`${NOVAOS_HUB_URL}/dashboard`}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50"
              onClick={() => setMenuOpen(false)}
            >
              前往 NovaOS 主站中控
            </a>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-rose-700 hover:bg-rose-50"
              onClick={() => void signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="h-4 w-4" />
              登出
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
