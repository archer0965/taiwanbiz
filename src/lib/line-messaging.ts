/**
 * LINE Messaging API 推播（店家／服務人員即時通知、顧客提醒）。
 * 需設定 LINE_CHANNEL_ACCESS_TOKEN；收件人為 LINE userId。
 */

export type LinePushResult =
  | { ok: true; skipped?: false }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; error: string };

function channelToken() {
  return (
    process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim() ||
    process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN?.trim() ||
    ""
  );
}

export async function pushLineText(
  toUserId: string,
  text: string,
): Promise<LinePushResult> {
  const token = channelToken();
  const userId = toUserId.trim();
  if (!token) {
    return { ok: true, skipped: true, reason: "no-line-token" };
  }
  if (!userId) {
    return { ok: true, skipped: true, reason: "no-user-id" };
  }

  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: userId,
        messages: [{ type: "text", text: text.slice(0, 4900) }],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `LINE push ${res.status}: ${body}` };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "LINE push failed",
    };
  }
}

/** 以逗號／空白分隔的多個 LINE userId */
export function parseLineUserIds(raw?: string | null): string[] {
  if (!raw?.trim()) return [];
  return [
    ...new Set(
      raw
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

/** 推播 http(s) 圖片（data URL 不支援，請改傳預覽連結） */
export async function pushLineImage(
  toUserId: string,
  imageUrl: string,
): Promise<LinePushResult> {
  const token = channelToken();
  const userId = toUserId.trim();
  const url = imageUrl.trim();
  if (!token) {
    return { ok: true, skipped: true, reason: "no-line-token" };
  }
  if (!userId) {
    return { ok: true, skipped: true, reason: "no-user-id" };
  }
  if (!/^https?:\/\//i.test(url)) {
    return { ok: true, skipped: true, reason: "image-not-https" };
  }

  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: userId,
        messages: [
          {
            type: "image",
            originalContentUrl: url,
            previewImageUrl: url,
          },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `LINE image ${res.status}: ${body}` };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "LINE image failed",
    };
  }
}
