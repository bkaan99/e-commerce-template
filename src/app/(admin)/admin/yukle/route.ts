import { randomUUID } from "node:crypto";
import { connection } from "next/server";
import { getAuditLogger } from "@/shared/audit";
import { requirePermission } from "@/modules/auth/session";
import { isAppError } from "@/shared/errors";
import { reportError } from "@/shared/error-reporter";
import { PERMISSIONS } from "@/shared/permissions";
import { getClientIp } from "@/shared/rate-limit";
import { getFileStorage } from "@/shared/storage";
import { validateImage } from "@/shared/storage/image-validation";

/** Ürün görseli yükler; yanıt: { url }. Sunucu içeriği doğrular, adı kendisi üretir. */
export async function POST(request: Request) {
  await connection();

  try {
    const user = await requirePermission(PERMISSIONS.PRODUCT_WRITE);

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "Dosya seçilmedi" }, { status: 400 });
    }

    const data = Buffer.from(await file.arrayBuffer());
    const result = validateImage(data);
    if (!result.ok) {
      return Response.json({ error: result.message }, { status: 400 });
    }

    const key = `product/${randomUUID()}.${result.kind.extension}`;
    const url = await getFileStorage().put(key, data, result.kind.contentType);

    await getAuditLogger().log({
      actorId: user.id,
      ip: await getClientIp(),
      action: "upload.image",
      entityType: "Upload",
      entityId: key,
    });

    return Response.json({ url });
  } catch (error) {
    if (isAppError(error)) {
      return Response.json(
        { error: error.message },
        { status: error.httpStatus },
      );
    }
    reportError(error, { action: "uploadImage" });
    return Response.json({ error: "Yükleme başarısız" }, { status: 500 });
  }
}
