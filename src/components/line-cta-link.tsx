import { LINE_FRIEND_URL } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

type Props = Omit<ComponentPropsWithoutRef<"a">, "href" | "target" | "rel"> & {
  children: ReactNode;
  className?: string;
  /** 預設拓脈官方帳號；店家前台可覆寫為該店 LINE */
  href?: string;
};

/**
 * 導向 LINE（預設拓脈官方 @469uykad；可傳店家連結）。
 * 手機可開啟 LINE App，桌面則開啟加好友／聊天頁。
 */
export function LineCtaLink({
  children,
  className,
  href = LINE_FRIEND_URL,
  ...props
}: Props) {
  return (
    <a
      href={href || LINE_FRIEND_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(className)}
      {...props}
    >
      {children}
    </a>
  );
}

export { LINE_FRIEND_URL };
