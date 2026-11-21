import { auth } from "@/auth";
import {
  listSellerNotifications,
  markAllSellerNotificationsRead,
  markSellerNotificationRead,
} from "@/lib/seller-notifications-db.server";
import { isDeveloperEmail } from "@/lib/roles";
import { NextResponse } from "next/server";

/** 賣家後台系統通知 */
export async function GET(request: Request) {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase() || "";
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 賣家僅看自己的通知；總管可帶 ?all=1 檢視全部
  const wantAll =
    isDeveloperEmail(email) &&
    new URL(request.url).searchParams.get("all") === "1";
  const notifications = listSellerNotifications({
    ownerEmail: wantAll ? undefined : email,
    limit: 40,
  });
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return NextResponse.json({
    ok: true,
    unreadCount,
    notifications,
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase() || "";
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action === "read_all") {
    const count = markAllSellerNotificationsRead(email);
    return NextResponse.json({ ok: true, marked: count });
  }

  const id = String(body.id || "").trim();
  if (!id) {
    return NextResponse.json({ error: "缺少通知編號" }, { status: 400 });
  }
  const updated = markSellerNotificationRead(id, email);
  if (!updated) {
    return NextResponse.json({ error: "找不到通知" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, notification: updated });
}
