/** Report structured errors to NovaOS hub (unified monitoring). */

const HUB =
  process.env.NEXT_PUBLIC_HUB_URL?.replace(/\/$/, "") ||
  "https://paycheck.com.de";

export async function reportToHub(input: {
  kind:
    | "api_error"
    | "payment_failure"
    | "payment_success"
    | "ai_failure"
    | "notify_failure"
    | "system"
    | "billing";
  message: string;
  severity?: "info" | "warn" | "error" | "fatal";
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    await fetch(`${HUB}/api/telemetry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "taiwanbiz",
        product: "booking",
        kind: input.kind,
        message: input.message,
        severity: input.severity,
        meta: input.meta,
        secret: process.env.NOVAOS_TELEMETRY_SECRET || undefined,
      }),
      signal: AbortSignal.timeout(2500),
    });
  } catch {
    console.error("[novaos-telemetry]", input.kind, input.message);
  }
}
