import { redirect } from "next/navigation";
import { hubAuthRedirect } from "@/lib/hub-auth";

export const metadata = { title: "註冊｜拓脈預約" };

/** Unified NovaOS signup — return via /auth/receive → /welcome. */
export default function SignupPage() {
  redirect(hubAuthRedirect("signup", "/welcome"));
}
