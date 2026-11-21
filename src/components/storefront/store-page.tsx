import { DeveloperOnly } from "@/components/developer-only";
import { BookingForm } from "@/components/storefront/booking-form";
import { ContactForm } from "@/components/storefront/contact-form";
import { FloatingBookingButton } from "@/components/storefront/floating-booking-button";
import { FloatingCtaBar } from "@/components/storefront/floating-cta-bar";
import { MembershipSection } from "@/components/storefront/membership-section";
import { ScratchCoupon } from "@/components/storefront/scratch-coupon";
import { StoreLegalFooter } from "@/components/storefront/store-legal-footer";
import { Button } from "@/components/ui/button";
import { SafeImage } from "@/components/ui/safe-image";
import type { StoreStaffMember } from "@/lib/beauty-ops";
import type { StoreProfile } from "@/lib/mock-data";
import { LINE_FRIEND_URL } from "@/lib/pricing";
import { toSafeHttpUrl } from "@/lib/safe-url";
import {
  storefrontPresetLabel,
  type StorefrontPreset,
} from "@/lib/storefront-preset";
import {
  normalizeStoreStyle,
  storeStyleCssVars,
  type StoreStyleSettings,
} from "@/lib/store-style";
import {
  ArrowLeft,
  Clock3,
  MapPinned,
  MessageCircle,
  Phone,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";

export type StoreDisplayOptions = {
  announcement?: string;
  welcomeMessage?: string;
  showCampaign?: boolean;
  showContactForm?: boolean;
  showMapButton?: boolean;
  showLineButton?: boolean;
};

type Props = {
  store: StoreProfile;
  options?: StoreDisplayOptions;
  /** 基礎版純預約 / 旗艦版品牌官網 */
  preset?: StorefrontPreset;
  /** 設計師團隊（旗艦版） */
  staff?: StoreStaffMember[];
  /** 預約須知摘要（基礎版頂部） */
  bookingTerms?: string;
  /** 示範站才顯示平台行銷浮動條 */
  showPlatformMarketing?: boolean;
  /** 賣家自訂網站風格 */
  storeStyle?: StoreStyleSettings | null;
};

const themeStyles = {
  brunch: {
    glow: "from-amber-500/25 via-transparent to-emerald-500/10",
    chip: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    accentText: "text-amber-300",
    price: "text-amber-300",
    ring: "ring-amber-400/20",
    button: "bg-amber-500 text-slate-950 hover:bg-amber-400",
    softCard: "border-white/10 bg-white/[0.04]",
    productCta:
      "border-amber-400/30 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20",
  },
  nail: {
    glow: "from-rose-500/25 via-transparent to-violet-500/10",
    chip: "border-rose-400/30 bg-rose-400/10 text-rose-200",
    accentText: "text-rose-300",
    price: "text-rose-300",
    ring: "ring-rose-400/20",
    button: "bg-rose-400 text-slate-950 hover:bg-rose-300",
    softCard: "border-white/10 bg-white/[0.04]",
    productCta:
      "border-rose-400/30 bg-rose-400/10 text-rose-100 hover:bg-rose-400/20",
  },
  shop: {
    glow: "from-teal-500/20 via-transparent to-slate-500/10",
    chip: "border-teal-400/30 bg-teal-400/10 text-teal-200",
    accentText: "text-teal-300",
    price: "text-teal-300",
    ring: "ring-teal-400/20",
    button: "bg-teal-400 text-slate-950 hover:bg-teal-300",
    softCard: "border-white/10 bg-white/[0.04]",
    productCta:
      "border-teal-400/30 bg-teal-400/10 text-teal-100 hover:bg-teal-400/20",
  },
};

function BookingBlock({
  store,
  lineUrl,
  staffNames,
}: {
  store: StoreProfile;
  lineUrl: string;
  staffNames?: string[];
}) {
  return (
    <section id="booking" className="scroll-mt-24 pb-2">
      <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-1">
        <div className="rounded-[1.5rem] bg-slate-950/40 p-1 sm:p-2 [&_form]:border-white/10 [&_form]:bg-transparent [&_form]:shadow-none [&_h2]:text-white [&_label]:text-slate-300 [&_p]:text-slate-400 [&_input]:border-white/10 [&_input]:bg-white/5 [&_input]:text-white [&_textarea]:border-white/10 [&_textarea]:bg-white/5 [&_textarea]:text-white [&_select]:border-white/10 [&_select]:bg-white/5 [&_select]:text-white">
          <BookingForm
            storeSlug={store.slug}
            storeName={store.name}
            storeAddress={store.address}
            lineUrl={lineUrl}
            staffOptions={staffNames}
            services={store.products.map((p) => ({
              id: p.id,
              name: p.name,
              durationMinutes: p.durationMinutes ?? 60,
            }))}
          />
        </div>
      </div>
    </section>
  );
}

function styleShell(
  store: StoreProfile,
  storeStyle?: StoreStyleSettings | null,
): CSSProperties {
  return {
    ...storeStyleCssVars(storeStyle, store.accent),
    background: "var(--sf-page-bg)",
    fontFamily: "var(--sf-font)",
  };
}

export function StorePage({
  store,
  options,
  preset = "premium",
  staff = [],
  bookingTerms,
  showPlatformMarketing = false,
  storeStyle = null,
}: Props) {
  if (preset === "basic") {
    return (
      <BasicStorePage
        store={store}
        options={options}
        bookingTerms={bookingTerms}
        staff={staff}
        storeStyle={storeStyle}
        showPlatformMarketing={showPlatformMarketing}
      />
    );
  }

  return (
    <PremiumStorePage
      store={store}
      options={options}
      staff={staff}
      showPlatformMarketing={showPlatformMarketing}
      storeStyle={storeStyle}
    />
  );
}

/** 【基礎版】極簡單頁預約流：店名／頭像／須知 → 預約表單 */
function BasicStorePage({
  store,
  options,
  bookingTerms,
  staff,
  storeStyle,
  showPlatformMarketing,
}: {
  store: StoreProfile;
  options?: StoreDisplayOptions;
  bookingTerms?: string;
  staff: StoreStaffMember[];
  storeStyle?: StoreStyleSettings | null;
  showPlatformMarketing: boolean;
}) {
  const style = normalizeStoreStyle(storeStyle, store.accent);
  const storeLineUrl = toSafeHttpUrl(store.lineUrl);
  const lineUrl =
    storeLineUrl || toSafeHttpUrl(LINE_FRIEND_URL) || LINE_FRIEND_URL;
  const terms =
    bookingTerms?.trim() ||
    "遲到超過 15 分鐘得視為自動取消；請於預約日前一天告知改期。";
  const staffNames = [
    "不指定",
    ...staff
      .filter((s) => s.active !== false && s.name?.trim())
      .map((s) => s.name.trim()),
  ];
  const welcomeMessage = options?.welcomeMessage ?? store.welcomeMessage;

  return (
    <div
      className="relative min-h-screen overflow-x-hidden text-slate-100"
      style={styleShell(store, style)}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background: `radial-gradient(ellipse at top, var(--sf-glow), transparent 55%)`,
        }}
      />

      <div className="relative mx-auto max-w-xl px-4 pb-10 pt-6 sm:px-6 sm:pt-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            拓脈
          </Link>
          <span
            className="rounded-full border border-[color:var(--sf-primary)]/30 bg-[color:var(--sf-primary-soft)] px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-[color:var(--sf-accent-text)]"
            style={{ borderRadius: "var(--sf-radius)" }}
          >
            {storefrontPresetLabel("basic")}
          </span>
        </div>

        <header className="flex items-start gap-4">
          <div
            className="relative h-16 w-16 shrink-0 overflow-hidden ring-2 ring-white/15 sm:h-20 sm:w-20"
            style={{ borderRadius: "var(--sf-radius)" }}
          >
            <SafeImage
              src={store.banner}
              alt={`${store.name} 頭像`}
              fill
              priority
              sizes="80px"
              className="object-cover"
              style={{
                filter: `brightness(${1 - style.heroOverlay / 200})`,
              }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[color:var(--sf-accent-text)]">
              {store.category}
            </p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {store.name}
            </h1>
            <p className="mt-1 text-sm text-slate-400">{store.tagline}</p>
          </div>
        </header>

        {welcomeMessage ? (
          <p className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
            {welcomeMessage}
          </p>
        ) : null}

        <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-semibold tracking-wide text-slate-400">
            預約須知
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
            {terms.length > 220 ? `${terms.slice(0, 220)}…` : terms}
          </p>
        </section>

        <p className="mt-6 text-center text-xs font-medium tracking-wide text-slate-300">
          服務菜單 → 時段 → 資料與圖片 → 條款 → 送出
        </p>

        <div className="mt-3">
          <BookingBlock
            store={store}
            lineUrl={lineUrl}
            staffNames={staffNames.length > 1 ? staffNames : undefined}
          />
        </div>

        <StoreLegalFooter storeName={store.name} />
      </div>
      {/* 基礎版僅有底部行銷列；預留較高空間避免遮住預約送出鈕 */}
      <div
        className={showPlatformMarketing ? "h-28 sm:h-24" : "h-6"}
        aria-hidden
      />
      {showPlatformMarketing ? <FloatingCtaBar tone={store.theme} /> : null}
    </div>
  );
}

/** 【旗艦版】品牌官網：Hero／作品集／設計師／交通＋浮動預約 */
function PremiumStorePage({
  store,
  options,
  staff,
  showPlatformMarketing,
  storeStyle,
}: {
  store: StoreProfile;
  options?: StoreDisplayOptions;
  staff: StoreStaffMember[];
  showPlatformMarketing: boolean;
  storeStyle?: StoreStyleSettings | null;
}) {
  const theme = themeStyles[store.theme] ?? themeStyles.brunch;
  const style = normalizeStoreStyle(storeStyle, store.accent);
  const sfButton =
    "bg-[color:var(--sf-primary)] text-[color:var(--sf-button-text)] hover:opacity-90";
  const sfAccent = "text-[color:var(--sf-accent-text)]";
  const sfChip =
    "border-[color:var(--sf-primary)]/30 bg-[color:var(--sf-primary-soft)] text-[color:var(--sf-accent-text)]";
  const showCampaign = options?.showCampaign ?? store.showCampaign ?? true;
  const showContactForm =
    options?.showContactForm ?? store.showContactForm ?? true;
  const mapUrl = toSafeHttpUrl(store.mapUrl);
  const storeLineUrl = toSafeHttpUrl(store.lineUrl);
  const lineUrl =
    storeLineUrl || toSafeHttpUrl(LINE_FRIEND_URL) || LINE_FRIEND_URL;
  const showMapButton = (options?.showMapButton ?? true) && !!mapUrl;
  const showLineButton = options?.showLineButton ?? true;
  const announcement = options?.announcement ?? store.announcement;
  const welcomeMessage = options?.welcomeMessage ?? store.welcomeMessage;
  const activeStaff = staff.filter(
    (s) => s.active !== false && s.name?.trim(),
  );
  const staffNames = [
    "不指定",
    ...activeStaff.map((s) => s.name.trim()),
  ];
  const portfolio = store.products.filter((p) => p.image);

  return (
    <div
      className="relative min-h-screen overflow-x-hidden text-slate-100"
      style={styleShell(store, style)}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background: `radial-gradient(ellipse at top, var(--sf-glow), transparent 55%)`,
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(2,6,23,0.2),rgba(2,6,23,0.95))]" />

      <div className="relative sticky top-0 z-40 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="inline-flex min-w-0 items-center gap-1.5 text-sm font-medium text-slate-300 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span className="truncate">拓脈</span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`hidden rounded-full border px-2.5 py-0.5 text-[10px] font-semibold sm:inline ${sfChip}`}
            >
              {storefrontPresetLabel("premium")}
            </span>
            <a href="#booking">
              <Button as="span" size="sm" className={sfButton}>
                立即預約
              </Button>
            </a>
            <DeveloperOnly>
              <Link href="/dashboard">
                <Button
                  as="span"
                  size="sm"
                  variant="outline"
                  className="border-white/20 bg-transparent text-white hover:bg-white/10"
                >
                  店家後台
                </Button>
              </Link>
            </DeveloperOnly>
          </div>
        </div>
      </div>

      <header className="relative">
        <div className="relative h-[52vh] min-h-[300px] w-full sm:h-[62vh]">
          <SafeImage
            src={store.banner}
            alt={`${store.name} 形象 Banner`}
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-slate-950/20"
            style={{
              opacity: 0.55 + style.heroOverlay / 200,
            }}
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-5xl px-4 pb-8 sm:px-6 sm:pb-12">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide ${sfChip}`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {store.category}
            </span>
            <h1 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-5xl">
              {store.name}
            </h1>
            <p className={`mt-3 max-w-2xl text-base sm:text-lg ${sfAccent}`}>
              {store.tagline}
            </p>
            <div className="mt-6">
              <a href="#booking">
                <Button as="span" size="lg" className={`h-12 ${sfButton}`}>
                  立即預約
                </Button>
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-5xl space-y-10 px-4 py-10 pb-28 sm:space-y-14 sm:px-6 sm:py-14 sm:pb-32">
        <section
          className={`rounded-[1.75rem] border p-5 shadow-2xl shadow-black/30 backdrop-blur sm:p-8 ${theme.softCard} ring-1 ${theme.ring}`}
        >
          {welcomeMessage && (
            <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
              {welcomeMessage}
            </p>
          )}
          {announcement && (
            <p className="mt-2 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
              公告：{announcement}
            </p>
          )}

          <div className="mt-5 grid gap-2 text-sm text-slate-300 sm:grid-cols-3">
            <span className="inline-flex items-start gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
              <Clock3 className={`mt-0.5 h-4 w-4 shrink-0 ${sfAccent}`} />
              <span className="break-words">{store.hours}</span>
            </span>
            <span className="inline-flex items-start gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
              <Phone className={`mt-0.5 h-4 w-4 shrink-0 ${sfAccent}`} />
              <span className="break-words">{store.phone}</span>
            </span>
            <span className="inline-flex items-start gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
              <MapPinned
                className={`mt-0.5 h-4 w-4 shrink-0 ${sfAccent}`}
              />
              <span className="break-words">{store.address}</span>
            </span>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {showMapButton && mapUrl && (
              <a href={mapUrl} target="_blank" rel="noreferrer">
                <Button
                  as="span"
                  className={`h-12 w-full sm:h-11 sm:w-auto ${sfButton}`}
                >
                  <MapPinned className="h-4 w-4" />
                  Google 地圖導航
                </Button>
              </a>
            )}
            {showLineButton && lineUrl && (
              <a href={lineUrl} target="_blank" rel="noreferrer">
                <Button
                  as="span"
                  variant="outline"
                  className="h-12 w-full border-white/20 bg-transparent text-white hover:bg-white/10 sm:h-11 sm:w-auto"
                >
                  <MessageCircle className="h-4 w-4" />
                  加 LINE 官方帳號諮詢
                </Button>
              </a>
            )}
            {showCampaign && (
              <a href="#campaign">
                <Button
                  as="span"
                  variant="outline"
                  className="h-12 w-full border-white/20 bg-transparent text-white hover:bg-white/10 sm:h-11 sm:w-auto"
                >
                  參加限時刮刮樂
                </Button>
              </a>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            店家介紹
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base">
            {store.description}
          </p>
        </section>

        {portfolio.length > 0 ? (
          <section id="portfolio">
            <div className="mb-5">
              <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                作品集展示
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                服務作品與價目一覽，點擊下方即可預約
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              {portfolio.map((product) => (
                <a
                  key={product.id}
                  href="#booking"
                  className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
                >
                  <div className="relative aspect-square">
                    <SafeImage
                      src={product.image}
                      alt={product.name}
                      fill
                      sizes="(max-width: 640px) 50vw, 33vw"
                      className="object-cover transition duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <p className="text-sm font-semibold text-white">
                        {product.name}
                      </p>
                      <p className={`text-xs font-bold ${sfAccent}`}>
                        NT$ {product.price.toLocaleString("zh-TW")}
                      </p>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </section>
        ) : null}

        <section id="stylists">
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                設計師團隊
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                可指定服務人員，系統依排班防撞期
              </p>
            </div>
            <Users className={`h-5 w-5 ${sfAccent}`} />
          </div>
          {activeStaff.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {activeStaff.map((member) => (
                <article
                  key={member.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-lg font-semibold text-white">
                    {member.name.slice(0, 1)}
                  </div>
                  <h3 className="mt-3 font-semibold text-white">{member.name}</h3>
                  <p className="mt-1 text-xs text-slate-400">
                    {member.isOwner
                      ? "店長／負責人"
                      : member.role === "assistant"
                        ? "助理"
                        : "設計師"}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-8 text-center text-sm text-slate-400">
              目前為彈性排班。預約時可選擇「不指定」，由店家安排合適設計師。
            </div>
          )}
        </section>

        <section id="location">
          <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            交通與地址
          </h2>
          <div
            className={`mt-4 rounded-2xl border p-5 ${theme.softCard} ring-1 ${theme.ring}`}
          >
            <p className="inline-flex items-start gap-2 text-sm text-slate-200">
              <MapPinned className={`mt-0.5 h-4 w-4 shrink-0 ${sfAccent}`} />
              <span>{store.address}</span>
            </p>
            <p className="mt-3 inline-flex items-start gap-2 text-sm text-slate-300">
              <Clock3 className={`mt-0.5 h-4 w-4 shrink-0 ${sfAccent}`} />
              <span>{store.hours}</span>
            </p>
            <p className="mt-3 inline-flex items-start gap-2 text-sm text-slate-300">
              <Phone className={`mt-0.5 h-4 w-4 shrink-0 ${sfAccent}`} />
              <span>{store.phone}</span>
            </p>
            {mapUrl ? (
              <a href={mapUrl} target="_blank" rel="noreferrer" className="mt-5 inline-block">
                <Button as="span" className={sfButton}>
                  <MapPinned className="h-4 w-4" />
                  開啟 Google 地圖
                </Button>
              </a>
            ) : null}
          </div>
        </section>

        {showCampaign && (
          <ScratchCoupon
            storeSlug={store.slug}
            storeName={store.name}
            campaign={store.campaign}
            tone={store.theme}
            lineUrl={lineUrl}
          />
        )}

        <MembershipSection
          storeSlug={store.slug}
          storeName={store.name}
          tone={store.theme}
        />

        <BookingBlock
          store={store}
          lineUrl={lineUrl}
          staffNames={staffNames.length > 1 ? staffNames : undefined}
        />

        {showContactForm && (
          <section className="pb-4">
            <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-1">
              <div className="rounded-[1.5rem] bg-slate-950/40 p-1 sm:p-2 [&_form]:border-white/10 [&_form]:bg-transparent [&_form]:shadow-none [&_h2]:text-white [&_label]:text-slate-300 [&_p]:text-slate-400 [&_input]:border-white/10 [&_input]:bg-white/5 [&_input]:text-white [&_textarea]:border-white/10 [&_textarea]:bg-white/5 [&_textarea]:text-white">
                <ContactForm storeName={store.name} />
              </div>
            </div>
          </section>
        )}
      </main>

      <StoreLegalFooter storeName={store.name} />
      {/* 預留底部：行銷列 + 立即預約鈕，避免遮住表單 */}
      <div
        className={showPlatformMarketing ? "h-40 sm:h-36" : "h-24"}
        aria-hidden
      />
      <FloatingBookingButton
        tone={store.theme}
        className={
          showPlatformMarketing
            ? "bottom-[4.75rem] z-[51] sm:bottom-[5.5rem]"
            : undefined
        }
      />
      {showPlatformMarketing ? <FloatingCtaBar tone={store.theme} /> : null}
    </div>
  );
}
