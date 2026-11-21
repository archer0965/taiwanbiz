import { auth } from "@/auth";
import { isDeveloperEmail } from "@/lib/roles";
import { getStoreContent } from "@/lib/store-content-db.server";
import { listTenantDb } from "@/lib/tenant-db.server";
import { toTenantDbRow } from "@/lib/tenants";
import { NextResponse } from "next/server";

export const instant = false;

/** 目前登入者擁有的店家（伺服器端） */
export async function GET() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase() || "";
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenants = await listTenantDb();
  const mine = isDeveloperEmail(email)
    ? tenants
    : tenants.filter((t) => t.ownerEmail.trim().toLowerCase() === email);

  const contents = [];
  for (const t of mine) {
    const c = await getStoreContent(t.slug);
    if (c) contents.push(c);
  }

  return NextResponse.json({
    ok: true,
    email,
    tenants: mine,
    schema: mine.map(toTenantDbRow),
    contents,
  });
}
