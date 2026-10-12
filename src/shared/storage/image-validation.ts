export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export interface ImageKind {
  extension: "jpg" | "png" | "webp" | "gif";
  contentType: string;
}

/**
 * Dosya türü istemcinin bildirdiği MIME'a değil içeriğin imzasına (magic bytes)
 * göre belirlenir. SVG bilerek desteklenmez (betik içerebilir).
 */
export function detectImageKind(data: Uint8Array): ImageKind | null {
  const startsWith = (...bytes: number[]) =>
    bytes.every((byte, index) => data[index] === byte);

  if (startsWith(0xff, 0xd8, 0xff)) {
    return { extension: "jpg", contentType: "image/jpeg" };
  }
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
    return { extension: "png", contentType: "image/png" };
  }
  if (startsWith(0x47, 0x49, 0x46, 0x38)) {
    return { extension: "gif", contentType: "image/gif" };
  }
  // RIFF....WEBP
  if (
    startsWith(0x52, 0x49, 0x46, 0x46) &&
    data[8] === 0x57 &&
    data[9] === 0x45 &&
    data[10] === 0x42 &&
    data[11] === 0x50
  ) {
    return { extension: "webp", contentType: "image/webp" };
  }
  return null;
}

export function validateImage(
  data: Uint8Array,
): { ok: true; kind: ImageKind } | { ok: false; message: string } {
  if (data.byteLength === 0) return { ok: false, message: "Dosya boş" };
  if (data.byteLength > MAX_IMAGE_BYTES) {
    return { ok: false, message: "Görsel 5 MB'tan büyük olamaz" };
  }
  const kind = detectImageKind(data);
  if (!kind) {
    return {
      ok: false,
      message: "Yalnızca JPEG, PNG, WebP veya GIF görsel yüklenebilir",
    };
  }
  return { ok: true, kind };
}
