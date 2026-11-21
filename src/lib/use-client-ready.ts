"use client";

import { useSyncExternalStore } from "react";

/** 伺服器端為 false，客戶端 hydration 後為 true（避免 localStorage 水合不一致） */
export function useClientReady() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
