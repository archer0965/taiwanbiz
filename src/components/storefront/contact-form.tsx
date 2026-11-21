"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Toast } from "@/components/ui/toast";
import { isValidTaiwanMobile, normalizeTaiwanMobile } from "@/lib/phone";
import { saveContactSubmission } from "@/lib/storage";
import { FormEvent, useCallback, useState } from "react";

type Props = {
  storeName?: string;
};

export function ContactForm({ storeName = "拓脈案例店家" }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const closeToast = useCallback(() => setToastOpen(false), []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("請填寫姓名");
      return;
    }

    const normalized = normalizeTaiwanMobile(phone);
    if (!isValidTaiwanMobile(normalized)) {
      setError("請輸入正確的台灣手機號碼（09 開頭共 10 碼）");
      return;
    }

    if (!message.trim()) {
      setError("請填寫留言內容");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeName,
          name: name.trim(),
          phone: normalized,
          message: message.trim(),
          website: honeypot,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "送出失敗，請稍後再試");
        return;
      }

      const savedLocal = saveContactSubmission({
        name: name.trim(),
        phone: normalized,
        message: message.trim(),
        storeName,
      });

      setName("");
      setPhone("");
      setMessage("");
      setToastOpen(true);
      if (!savedLocal) {
        console.warn("[contact] API 已送出，但本機留言備份失敗");
      }
    } catch {
      setError("網路異常，請稍後再試或改用電話／LINE 聯絡");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="relative space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8"
      >
        <div>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
            聯絡我們
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            預約、團體訂位或合作洽詢，留下訊息我們會盡快回覆。
          </p>
        </div>

        <div>
          <Label htmlFor="contact-name">姓名</Label>
          <Input
            id="contact-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="如何稱呼您"
            disabled={loading}
            className="text-base sm:text-sm"
          />
        </div>

        <div>
          <Label htmlFor="contact-phone">手機號碼</Label>
          <Input
            id="contact-phone"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0912345678"
            disabled={loading}
            maxLength={20}
            className="text-base sm:text-sm"
          />
        </div>

        <div>
          <Label htmlFor="contact-message">留言</Label>
          <Textarea
            id="contact-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="告訴我們您的需求…"
            disabled={loading}
            className="text-base sm:text-sm"
          />
        </div>

        {/* honeypot */}
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <Label htmlFor="contact-website">網站</Label>
          <Input
            id="contact-website"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        {error && (
          <p className="text-sm text-rose-600" role="alert">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="h-12 w-full text-base sm:h-11 sm:w-auto sm:text-sm"
        >
          {loading ? "送出中…" : "送出訊息"}
        </Button>
      </form>

      <Toast
        open={toastOpen}
        onClose={closeToast}
        message="訊息已成功送出！店家將盡快與您聯繫。"
      />
    </>
  );
}
