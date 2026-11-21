import imageCompression from "browser-image-compression";

/** 允許的預約參考圖 MIME */
export const ALLOWED_REFERENCE_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedReferenceImageType =
  (typeof ALLOWED_REFERENCE_IMAGE_TYPES)[number];

const ALLOWED_SET = new Set<string>(ALLOWED_REFERENCE_IMAGE_TYPES);

/** 壓縮後目標上限（約 400KB） */
export const REFERENCE_IMAGE_MAX_BYTES = 400 * 1024;

/** 最大邊長 */
export const REFERENCE_IMAGE_MAX_EDGE = 1080;

/** 壓縮品質（0.7～0.8） */
export const REFERENCE_IMAGE_QUALITY = 0.75;

export function isAllowedReferenceImageType(
  type: string,
): type is AllowedReferenceImageType {
  return ALLOWED_SET.has(type);
}

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("讀取圖片失敗"));
    reader.readAsDataURL(file);
  });
}

/**
 * 前端壓縮預約參考圖：最大邊 1080px、品質約 0.75、目標 ≤ 400KB。
 * 回傳 data URL（jpeg／png／webp）。
 */
export async function compressReferenceImage(file: File): Promise<string> {
  if (!isAllowedReferenceImageType(file.type)) {
    throw new Error("僅支援 JPEG、PNG、WebP 圖片");
  }

  const compressed = await imageCompression(file, {
    maxSizeMB: REFERENCE_IMAGE_MAX_BYTES / (1024 * 1024),
    maxWidthOrHeight: REFERENCE_IMAGE_MAX_EDGE,
    initialQuality: REFERENCE_IMAGE_QUALITY,
    useWebWorker: true,
    fileType:
      file.type === "image/png"
        ? "image/png"
        : file.type === "image/webp"
          ? "image/webp"
          : "image/jpeg",
    // 避免極端大圖卡住太久
    maxIteration: 12,
  });

  // 仍過大時再以 Canvas 降一次品質
  let output: Blob = compressed;
  if (output.size > REFERENCE_IMAGE_MAX_BYTES) {
    output = await canvasRecompress(output, 0.7, REFERENCE_IMAGE_MAX_EDGE);
  }
  if (output.size > REFERENCE_IMAGE_MAX_BYTES) {
    output = await canvasRecompress(output, 0.62, 960);
  }

  const dataUrl = await fileToDataUrl(output);
  if (!dataUrl.startsWith("data:image/")) {
    throw new Error("圖片壓縮結果無效");
  }
  return dataUrl;
}

async function canvasRecompress(
  blob: Blob,
  quality: number,
  maxEdge: number,
): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return blob;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const mime =
    blob.type === "image/png" || blob.type === "image/webp"
      ? blob.type
      : "image/jpeg";

  const recompressed = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), mime, quality);
  });
  return recompressed || blob;
}
