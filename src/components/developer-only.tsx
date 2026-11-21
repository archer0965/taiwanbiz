"use client";

import { isDeveloperEmail } from "@/lib/roles";
import { useSession } from "next-auth/react";

/** 僅開發者帳號可見的區塊（例如後台入口） */
export function DeveloperOnly({ children }: { children: React.ReactNode }) {
  const { data, status } = useSession();
  if (status === "loading") return null;
  if (!isDeveloperEmail(data?.user?.email)) return null;
  return <>{children}</>;
}
