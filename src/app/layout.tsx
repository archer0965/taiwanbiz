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

const siteTitle = "拓脈（Nova Crest Pulse）｜美業與美髮極速預約官網";
const siteDescription =
  "專為美容美甲與美髮沙龍打造：線上預約、防撞期排班、離峰自動折扣與 LINE 即時通知，開店當日即可接單。";

export const metadata: Metadata = {
  metadataBase: new URL("https://taiwanbiz.vercel.app"),
  title: {
    default: siteTitle,
    template: "%s｜拓脈",
  },
  description: siteDescription,
  applicationName: "拓脈",
  openGraph: {
    type: "website",
    locale: "zh_TW",
    url: "https://taiwanbiz.vercel.app",
    siteName: "拓脈 Nova Crest Pulse",
    title: siteTitle,
    description: siteDescription,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "拓脈｜美業與美髮工作室的極速預約官網",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/opengraph-image"],
  },
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
