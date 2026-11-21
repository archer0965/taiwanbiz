import { authConfig } from "@/auth.config";
import {
  isDemoOwnerEmail,
  isDeveloperEmail,
  isValidLoginEmail,
} from "@/lib/roles";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

const googleConfigured =
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

const isProductionRuntime =
  process.env.VERCEL_ENV === "production" ||
  (process.env.NODE_ENV === "production" &&
    process.env.VERCEL_ENV !== "preview");
const allowDemoLogin = isProductionRuntime
  ? process.env.ALLOW_DEMO_LOGIN === "true"
  : process.env.ALLOW_DEMO_LOGIN !== "false";

async function isProvisionedOwnerEmail(email: string) {
  try {
    // 動態 import，避免 middleware／Edge 靜態拉進 Blob／fs
    const { listTenantDb } = await import("@/lib/tenant-db.server");
    const tenants = await listTenantDb();
    return tenants.some(
      (t) => t.ownerEmail.trim().toLowerCase() === email.toLowerCase(),
    );
  } catch {
    return false;
  }
}

const providers = [
  ...(googleConfigured
    ? [
        Google({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
      ]
    : []),
  Credentials({
    id: "demo",
    name: "店主／管理員登入",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email =
        typeof credentials?.email === "string" && credentials.email.trim()
          ? credentials.email.trim().toLowerCase()
          : "";
      const password =
        typeof credentials?.password === "string" ? credentials.password : "";
      if (!isValidLoginEmail(email)) return null;

      // 總管：允許無密碼（示範／內部）或正確密碼
      if (isDeveloperEmail(email)) {
        if (password) {
          const { verifyOwnerPassword } = await import(
            "@/lib/owner-credentials-db.server"
          );
          const check = await verifyOwnerPassword(email, password);
          if (check.reason === "mismatch") return null;
        }
        return {
          id: "admin",
          name: "拓脈總管理員",
          email,
          image: null,
        };
      }

      const provisioned = await isProvisionedOwnerEmail(email);
      const demoOk =
        allowDemoLogin &&
        (isDemoOwnerEmail(email) || email.endsWith("@demo.tw"));
      const openOwner = process.env.ALLOW_OWNER_LOGIN === "true";

      if (!(provisioned || demoOk || openOwner)) {
        return null;
      }

      // 店主必須驗證密碼（已設定者）；尚未設定則拒絕（請先完成綁定）
      const { verifyOwnerPassword } = await import(
        "@/lib/owner-credentials-db.server"
      );
      const check = await verifyOwnerPassword(email, password);
      if (!check.ok) {
        return null;
      }

      return {
        id: `owner-${email}`,
        name: "店家老闆",
        email,
        image: null,
      };
    },
  }),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      const email = user.email?.toLowerCase() ?? "";
      if (account?.provider === "google") {
        if (isDeveloperEmail(email)) return true;
        return isProvisionedOwnerEmail(email);
      }
      if (account?.provider === "demo") {
        if (isDeveloperEmail(email)) return true;
        if (await isProvisionedOwnerEmail(email)) return true;
        if (
          allowDemoLogin &&
          (isDemoOwnerEmail(email) || email.endsWith("@demo.tw"))
        ) {
          return true;
        }
        return process.env.ALLOW_OWNER_LOGIN === "true";
      }
      return true;
    },
  },
});

export const isGoogleAuthConfigured = googleConfigured;
export const isDemoLoginEnabled = allowDemoLogin;
