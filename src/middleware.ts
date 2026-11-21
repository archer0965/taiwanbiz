import { authConfig } from "@/auth.config";
import { isDeveloperEmail } from "@/lib/roles";
import NextAuth from "next-auth";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const path = req.nextUrl.pathname;
  const email = req.auth?.user?.email;
  const isDev = isDeveloperEmail(email);

  if (path.startsWith("/admin")) {
    if (!isDev) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("callbackUrl", path);
      if (email) url.searchParams.set("error", "AccessDenied");
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (path.startsWith("/dashboard")) {
    if (!email) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("callbackUrl", path);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
