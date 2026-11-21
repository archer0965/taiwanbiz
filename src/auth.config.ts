import {
  isDemoOwnerEmail,
  isDeveloperEmail,
  isValidLoginEmail,
} from "@/lib/roles";
import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth 設定（供 middleware 使用，不可 import Node／Blob／fs）
 */
export const authConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [],
  callbacks: {
    authorized({ auth: session, request }) {
      const path = request.nextUrl.pathname;
      const email = session?.user?.email;
      if (path.startsWith("/admin")) {
        return isDeveloperEmail(email);
      }
      if (path.startsWith("/dashboard")) {
        return isDeveloperEmail(email) || !!email;
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image;
        token.isDeveloper = isDeveloperEmail(user.email);
        token.role = isDeveloperEmail(user.email) ? "admin" : "owner";
      }
      if (account?.provider) {
        token.provider = account.provider;
      }
      if (token.email && token.isDeveloper === undefined) {
        token.isDeveloper = isDeveloperEmail(token.email as string);
        token.role = token.isDeveloper ? "admin" : "owner";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.name =
          (token.name as string | null | undefined) ?? session.user.name;
        session.user.email =
          (token.email as string | null | undefined) ?? session.user.email;
        session.user.image =
          (token.picture as string | null | undefined) ?? session.user.image;
        (session.user as { role?: string }).role =
          (token.role as string | undefined) ??
          (isDeveloperEmail(session.user.email) ? "admin" : "owner");
      }
      return session;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;

export {
  isDemoOwnerEmail,
  isDeveloperEmail,
  isValidLoginEmail,
};
