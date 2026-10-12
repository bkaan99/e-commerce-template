import { connection } from "next/server";
import { getFileStorage } from "@/shared/storage";
import { STORAGE_KEY_PATTERN } from "@/shared/storage/storage";

/** Yüklenen görselleri sunar. Adlar rastgele ve değişmez olduğundan uzun süre önbelleğe alınır. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  await connection();
  const { path } = await context.params;
  const key = path.join("/");

  if (!STORAGE_KEY_PATTERN.test(key)) {
    return new Response("Bulunamadı", { status: 404 });
  }

  const file = await getFileStorage().read(key);
  if (!file) return new Response("Bulunamadı", { status: 404 });

  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
