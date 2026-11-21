"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StoreCampaign, StoreTheme } from "@/data/stores-db";
import {
  normalizeCampaignPrizes,
  summarizePrizes,
  totalPrizeQuantity,
  type CampaignPrizeTier,
} from "@/lib/campaign-prizes";
import { DEFAULT_CAMPAIGN, type CampaignDraft } from "@/lib/mock-data";
import {
  formatTaiwanMobileDisplay,
  isValidTaiwanMobile,
  normalizeTaiwanMobile,
} from "@/lib/phone";
import {
  addLead,
  consumePrizeTier,
  getPrizeStockSummary,
  hasPhoneClaimed,
  isCampaignActive,
  markPhoneClaimed,
  normalizeCampaign,
  peekCampaignPrize,
  readSavedCampaign,
  restorePrizeTier,
  unclaimPhone,
} from "@/lib/storage";
import { useClientReady } from "@/lib/use-client-ready";
import { generateCouponCode } from "@/lib/utils";
import { LineCtaLink } from "@/components/line-cta-link";
import { Gift, MessageCircle, Sparkles, Ticket, X } from "lucide-react";
import {
  FormEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Props = {
  storeSlug: string;
  storeName: string;
  campaign?: StoreCampaign;
  tone?: StoreTheme;
  lineUrl?: string;
};

type Stage = "idle" | "claim" | "done";

function toDraft(campaign: StoreCampaign | CampaignDraft): CampaignDraft {
  const prizes = normalizeCampaignPrizes(campaign);
  return normalizeCampaign({
    name: campaign.name,
    prize: campaign.prize || summarizePrizes(prizes),
    expiresAt: campaign.expiresAt,
    quota: totalPrizeQuantity(prizes) || campaign.quota,
    prizes,
  });
}

function ScratchCard({
  revealed,
  wonPrize,
  couponCode,
  tone,
  onReveal,
}: {
  revealed: boolean;
  wonPrize: string;
  couponCode?: string;
  tone: StoreTheme;
  onReveal: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const revealedRef = useRef(revealed);
  const scratchedRef = useRef(false);
  const sampleTick = useRef(0);
  const [hintVisible, setHintVisible] = useState(true);

  useEffect(() => {
    revealedRef.current = revealed;
  }, [revealed]);

  const paintFoil = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || scratchedRef.current || revealedRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const gradient = ctx.createLinearGradient(0, 0, rect.width, rect.height);
    if (tone === "nail") {
      // 微大地／暖玫瑰：美甲沙龍質感（避免紫調）
      gradient.addColorStop(0, "#9a3412");
      gradient.addColorStop(0.45, "#e7e5e4");
      gradient.addColorStop(1, "#881337");
    } else {
      gradient.addColorStop(0, "#78350f");
      gradient.addColorStop(0.45, "#f5f5f4");
      gradient.addColorStop(1, "#44403c");
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.fillStyle = "rgba(15,23,42,0.35)";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "600 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("用手指或滑鼠刮開", rect.width / 2, rect.height / 2 - 10);
    ctx.font = "500 13px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillText("刮出您的限時優惠", rect.width / 2, rect.height / 2 + 14);
  }, [tone]);

  useEffect(() => {
    if (revealed) return;
    scratchedRef.current = false;
    sampleTick.current = 0;
    // 等 layout 後再繪製，避免寬高為 0
    const id = window.requestAnimationFrame(() => paintFoil());
    return () => window.cancelAnimationFrame(id);
  }, [paintFoil, revealed]);

  function measureCleared(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
    try {
      const sample = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let cleared = 0;
      const step = 32;
      for (let i = 3; i < sample.length; i += step) {
        if (sample[i] === 0) cleared += 1;
      }
      return cleared / (sample.length / step);
    } catch {
      return 0;
    }
  }

  function scratchAt(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas || revealedRef.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    scratchedRef.current = true;
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();

    setHintVisible(false);

    // 降頻估算刮開比例，避免每次 pointermove 都 getImageData
    sampleTick.current += 1;
    if (sampleTick.current % 4 !== 0) return;
    if (measureCleared(ctx, canvas) > 0.4) onReveal();
  }

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (revealed) return;
    drawing.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    scratchAt(e.clientX, e.clientY);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || revealed) return;
    scratchAt(e.clientX, e.clientY);
  }

  function onPointerUp() {
    drawing.current = false;
    if (revealedRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !scratchedRef.current) return;
    if (measureCleared(ctx, canvas) > 0.35) onReveal();
  }

  return (
    <div className="relative mx-auto h-48 w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 shadow-inner sm:h-52">
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950 p-4 text-center text-white">
        <p className="text-xs font-medium tracking-[0.2em] text-slate-300 uppercase">
          恭喜獲得
        </p>
        <p className="mt-2 text-lg font-bold break-words sm:text-xl">
          {wonPrize || "？？？"}
        </p>
        {couponCode ? (
          <p className="mt-3 rounded-lg bg-white/15 px-3 py-1.5 font-mono text-sm tracking-wider">
            {couponCode}
          </p>
        ) : (
          <p className="mt-3 text-xs text-slate-400">
            {revealed ? "請輸入手機領取序號" : "刮開後顯示獎項"}
          </p>
        )}
      </div>

      {!revealed && (
        <>
          <canvas
            ref={canvasRef}
            className="absolute inset-0 z-10 h-full w-full touch-none cursor-crosshair"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            aria-label="刮開優惠券"
          />
          {hintVisible && (
            <button
              type="button"
              onClick={onReveal}
              className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/55 px-4 py-2 text-xs font-semibold text-white backdrop-blur transition hover:bg-black/70"
            >
              點我直接刮開
            </button>
          )}
        </>
      )}
    </div>
  );
}

function ScratchCouponClient({
  storeSlug,
  storeName,
  campaign: storeCampaign,
  tone = "brunch",
  lineUrl,
}: Props) {
  const fallback = useMemo(
    () => (storeCampaign ? toDraft(storeCampaign) : DEFAULT_CAMPAIGN),
    [storeCampaign],
  );

  const [campaign, setCampaign] = useState<CampaignDraft>(fallback);
  const [prizeRows, setPrizeRows] = useState(() =>
    getPrizeStockSummary(storeSlug, fallback),
  );
  const [campaignBlocked, setCampaignBlocked] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [pendingTier, setPendingTier] = useState<CampaignPrizeTier | null>(
    null,
  );
  const [couponCode, setCouponCode] = useState("");
  const [wonPrize, setWonPrize] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [lineGateOpen, setLineGateOpen] = useState(false);
  const revealLock = useRef(false);
  const claimLock = useRef(false);

  useEffect(() => {
    function syncCampaign() {
      // brunch-house 可套用後台 localStorage 活動；其餘租戶用店家 DB
      const saved =
        storeSlug === "brunch-house" ? readSavedCampaign() : null;
      const next = saved ? normalizeCampaign(saved, fallback) : fallback;
      setCampaign(next);
      setPrizeRows(getPrizeStockSummary(storeSlug, next));
      const active = isCampaignActive(next, storeSlug);
      setCampaignBlocked(active.ok ? null : active.reason);
    }
    syncCampaign();
    window.addEventListener("taiwanbiz-storage", syncCampaign);
    window.addEventListener("storage", syncCampaign);
    return () => {
      window.removeEventListener("taiwanbiz-storage", syncCampaign);
      window.removeEventListener("storage", syncCampaign);
    };
  }, [fallback, storeSlug]);

  const shell =
    tone === "nail"
      ? "border-stone-400/25 from-stone-900/80 via-stone-950 to-rose-950/25"
      : "border-stone-400/25 from-stone-900/80 via-stone-950 to-amber-950/30";

  const accentBtn =
    tone === "nail"
      ? "bg-stone-100 text-stone-900 hover:bg-white"
      : "bg-amber-100 text-stone-900 hover:bg-amber-50";

  function handleReveal() {
    if (revealLock.current || pendingTier || stage !== "idle") return;
    revealLock.current = true;
    setError("");
    const active = isCampaignActive(campaign, storeSlug);
    if (!active.ok) {
      setCampaignBlocked(active.reason);
      setError(active.reason);
      revealLock.current = false;
      return;
    }
    const tier = peekCampaignPrize(storeSlug, campaign);
    if (!tier) {
      setCampaignBlocked("本活動優惠券已發放完畢。");
      setError("本活動優惠券已發放完畢。");
      revealLock.current = false;
      return;
    }
    setPendingTier(tier);
    setWonPrize(tier.label);
    setStage("claim");
  }

  function handleClaim(e: FormEvent) {
    e.preventDefault();
    if (!pendingTier || claiming || claimLock.current) return;
    claimLock.current = true;
    setError("");
    setClaiming(true);

    try {
      const active = isCampaignActive(campaign, storeSlug);
      if (!active.ok) {
        setError(active.reason);
        setCampaignBlocked(active.reason);
        return;
      }

      const normalized = normalizeTaiwanMobile(phone);
      if (!isValidTaiwanMobile(normalized)) {
        setError("請輸入正確的台灣手機號碼（09 開頭共 10 碼）");
        return;
      }
      if (hasPhoneClaimed(storeSlug, normalized)) {
        setError("此手機號碼已領取過本活動優惠券，請勿重複領取。");
        return;
      }

      let consumed = consumePrizeTier(storeSlug, campaign, pendingTier.id);
      if (!consumed) {
        // 該階獎項剛好被領完時，改抽其他剩餘獎項
        const fallbackTier = peekCampaignPrize(storeSlug, campaign);
        if (!fallbackTier) {
          setError("本活動優惠券已發放完畢。");
          setCampaignBlocked("本活動優惠券已發放完畢。");
          setPrizeRows(getPrizeStockSummary(storeSlug, campaign));
          setStage("idle");
          setPendingTier(null);
          setWonPrize("");
          return;
        }
        consumed = consumePrizeTier(storeSlug, campaign, fallbackTier.id);
        if (!consumed) {
          setError("儲存失敗，請稍後再試或更換瀏覽器後重試。");
          setPrizeRows(getPrizeStockSummary(storeSlug, campaign));
          return;
        }
        setPendingTier(consumed.tier);
        setWonPrize(consumed.tier.label);
      }

      finishClaim(normalized, consumed.tier);
    } finally {
      setClaiming(false);
      claimLock.current = false;
    }
  }

  function finishClaim(normalizedPhone: string, tier: CampaignPrizeTier) {
    const code = generateCouponCode("PULSE");
    const displayPhone = formatTaiwanMobileDisplay(normalizedPhone);
    const claimed = markPhoneClaimed(storeSlug, normalizedPhone);
    if (!claimed) {
      restorePrizeTier(storeSlug, campaign, tier.id);
      setPrizeRows(getPrizeStockSummary(storeSlug, campaign));
      setError("儲存失敗，請稍後再試或更換瀏覽器後重試。");
      return;
    }

    const result = addLead({
      id: `lead-${Date.now()}-${code}`,
      createdAt: new Date().toISOString(),
      phone: displayPhone,
      campaignName: campaign.name,
      couponCode: code,
      prizeLabel: tier.label,
      prizeTierId: tier.id,
      status: "未兌換",
    });

    if (!result.ok) {
      restorePrizeTier(storeSlug, campaign, tier.id);
      unclaimPhone(storeSlug, normalizedPhone);
      setPrizeRows(getPrizeStockSummary(storeSlug, campaign));
      setError("儲存失敗，請稍後再試或更換瀏覽器後重試。");
      return;
    }

    setPhone(normalizedPhone);
    setWonPrize(tier.label);
    setCouponCode(code);
    setPendingTier(tier);
    setStage("done");
    setLineGateOpen(true);
    setPrizeRows(getPrizeStockSummary(storeSlug, campaign));

    void fetch("/api/lead-notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeName,
        phone: normalizedPhone,
        campaignName: campaign.name,
        couponCode: code,
        prize: tier.label,
      }),
    }).catch(() => {});
  }

  return (
    <section
      id="campaign"
      className={`scroll-mt-24 overflow-hidden rounded-3xl border bg-gradient-to-br shadow-xl shadow-black/30 ${shell}`}
    >
      <div className="grid gap-0 lg:grid-cols-2">
        <div className="p-5 sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
            <Gift className="h-3.5 w-3.5" />
            限時開幕刮刮樂
          </div>
          <h2 className="mt-4 text-xl font-bold tracking-tight break-words text-white sm:text-3xl">
            {campaign.name}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base">
            先刮開看獎項，再留手機領序號；領獎後請加入 LINE
            保存核銷碼，把過路客轉成熟客。
          </p>

          <ul className="mt-5 space-y-2">
            {prizeRows.map((tier) => (
              <li
                key={tier.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-200"
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                  <Ticket className="h-4 w-4 shrink-0 text-emerald-300" />
                  <span className="break-words">{tier.label}</span>
                </span>
                <span className="shrink-0 text-xs text-slate-400">
                  剩 {tier.remaining}/{tier.quantity}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-4 inline-flex items-center gap-2 text-xs text-slate-400">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            總名額 {campaign.quota} 份 · 於 {storeName} 現場出示序號即可使用
          </p>
        </div>

        <div className="border-t border-white/10 bg-black/20 p-5 sm:border-t-0 sm:border-l sm:p-8">
          {campaignBlocked ? (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
              {campaignBlocked}
            </div>
          ) : (
            <div className="space-y-4">
              <ScratchCard
                revealed={stage !== "idle"}
                wonPrize={wonPrize}
                couponCode={stage === "done" ? couponCode : undefined}
                tone={tone}
                onReveal={handleReveal}
              />

              {stage === "idle" && (
                <p className="text-center text-xs leading-relaxed text-slate-400">
                  刮開後需驗證台灣手機（09 開頭 10 碼）才能領取序號
                </p>
              )}

              {stage === "claim" && (
                <form onSubmit={handleClaim} className="space-y-4">
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">
                    您刮中「{wonPrize}」！留下手機即可領取專屬優惠碼。
                  </div>
                  <div>
                    <Label htmlFor="phone" className="text-slate-300">
                      手機號碼（領取序號）
                    </Label>
                    <Input
                      id="phone"
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
                  {error && (
                    <p className="text-sm text-rose-300" role="alert">
                      {error}
                    </p>
                  )}
                  <Button
                    type="submit"
                    disabled={claiming}
                    className={`h-12 w-full text-base ${accentBtn}`}
                  >
                    {claiming ? "領取中…" : "驗證手機並領取序號"}
                  </Button>
                  <p className="text-xs leading-relaxed text-slate-500">
                    送出即表示您同意「{storeName}」依台灣《個人資料保護法》蒐集並於活動核發、兌換通知之目的範圍內使用本手機號碼；名單由店家保有，拓脈平台僅提供系統處理。詳見{" "}
                    <a href="/privacy" className="text-emerald-300 underline-offset-2 hover:underline">
                      隱私權政策
                    </a>
                    。
                  </p>
                </form>
              )}

              {stage === "done" && (
                <div className="animate-fade-in-up rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                  <p className="font-semibold">領取成功！</p>
                  <p className="mt-1 leading-relaxed break-words">
                    您抽中「{wonPrize}」，優惠碼：
                    <span className="font-mono font-bold">{couponCode}</span>
                    。請加入 LINE 領取憑證與核銷碼，並於到店時出示。手機{" "}
                    <span className="font-semibold text-white">
                      {formatTaiwanMobileDisplay(phone)}
                    </span>{" "}
                    已加入店家名單。
                  </p>
                  <Button
                    type="button"
                    className={`mt-3 h-11 w-full ${accentBtn}`}
                    onClick={() => setLineGateOpen(true)}
                  >
                    <MessageCircle className="h-4 w-4" />
                    加入 LINE 領取憑證
                  </Button>
                </div>
              )}

              {error && stage === "idle" && (
                <p className="text-sm text-rose-300" role="alert">
                  {error}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {lineGateOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-stone-950/55 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="line-claim-title"
        >
          <div className="relative w-full max-w-md rounded-3xl border border-stone-200 bg-gradient-to-b from-stone-50 to-white p-5 shadow-2xl sm:p-6">
            <button
              type="button"
              className="absolute right-3 top-3 rounded-full p-1.5 text-stone-400 hover:bg-stone-100"
              onClick={() => setLineGateOpen(false)}
              aria-label="關閉"
            >
              <X className="h-4 w-4" />
            </button>
            <h3
              id="line-claim-title"
              className="pr-8 text-lg font-bold text-stone-900"
            >
              請加入 LINE 官方帳號領取憑證與核銷碼
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-stone-500">
              您已刮中「{wonPrize}」。加入 {storeName}{" "}
              LINE 後，即可保存核銷碼並接收回訪優惠，過路客也能轉成熟客名單。
            </p>
            <div className="mt-4 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm">
              <p className="text-stone-400">核銷碼</p>
              <p className="mt-1 font-mono text-lg font-bold tracking-wide text-stone-900">
                {couponCode}
              </p>
            </div>
            <LineCtaLink href={lineUrl} className="mt-4 block">
              <Button as="span" className="h-12 w-full bg-emerald-600 hover:bg-emerald-500">
                <MessageCircle className="h-4 w-4" />
                一鍵加入 LINE 領獎
              </Button>
            </LineCtaLink>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function ScratchCoupon(props: Props) {
  const ready = useClientReady();
  if (!ready) {
    return (
      <section
        id="campaign"
        className="h-72 animate-pulse rounded-3xl border border-white/10 bg-white/5"
        aria-hidden
      />
    );
  }
  return <ScratchCouponClient {...props} />;
}
