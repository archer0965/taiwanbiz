import { SiteViewTracker } from "@/components/analytics/site-view-tracker";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import type { Metadata } from "next";
import { Cormorant_Garamond, Noto_Sans_TC, Outfit } from "next/font/google";
import "./globals.css";

const notoSansTC = Noto_Sans_TC({
  variable: "--font-noto-sans-tc",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "拓脈（Nova Crest Pulse）｜美業與美髮極速預約官網",
  description:
    "專為美容美甲與美髮沙龍打造的預約 SaaS：防撞期排班、離峰自動折扣、LINE 即時通知與創始店家優惠，開店即可接單。",
  icons: {
    icon: "/logo-nova-crest-pulse.jpg",
    apple: "/logo-nova-crest-pulse.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-Hant"
      className={`${notoSansTC.variable} ${outfit.variable} ${cormorant.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <AuthSessionProvider>
          {children}
          <SiteViewTracker />
        </AuthSessionProvider>
      </body>
    </html>
  );
}
