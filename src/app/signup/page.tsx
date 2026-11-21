import { redirect } from "next/navigation";

export const metadata = { title: "註冊｜拓脈預約" };

/** Unified NovaOS signup — closes prior /signup 404. */
export default function SignupPage() {
  redirect(
    "https://paycheck.com.de/signup?next=" +
      encodeURIComponent("https://taiwanbiz.vercel.app/welcome")
  );
}
