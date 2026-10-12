"use server";

import { revalidatePath } from "next/cache";
import { invalidateStorefrontCaches } from "@/shared/cache/registry";
import {
  getBulkUpdateService,
  getProductImportService,
} from "@/modules/admin/container";
import type {
  BulkUpdateReport,
  ProductImportReport,
} from "@/modules/admin/import/import.types";
import { requirePermission } from "@/modules/auth/session";
import { isAppError } from "@/shared/errors";
import { reportError } from "@/shared/error-reporter";
import { PERMISSIONS } from "@/shared/permissions";
import { getClientIp } from "@/shared/rate-limit";

const MAX_FILE_BYTES = 2 * 1024 * 1024;

export type ImportFormState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | {
      kind: "report";
      mode: "urunler" | "guncelle";
      report: ProductImportReport | BulkUpdateReport;
    };

export async function runImportAction(
  _previous: ImportFormState,
  formData: FormData,
): Promise<ImportFormState> {
  try {
    const user = await requirePermission(PERMISSIONS.IMPORT_RUN);
    const actor = { userId: user.id, ip: await getClientIp() };

    const mode = formData.get("mode") === "guncelle" ? "guncelle" : "urunler";
    const dryRun = formData.get("intent") !== "apply";
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return { kind: "error", message: "Bir CSV dosyası seçin" };
    }
    if (file.size > MAX_FILE_BYTES) {
      return { kind: "error", message: "Dosya 2 MB'tan büyük olamaz" };
    }

    const csv = await file.text();
    const report =
      mode === "urunler"
        ? await getProductImportService().run(csv, { dryRun }, actor)
        : await getBulkUpdateService().run(csv, { dryRun }, actor);

    if (!dryRun) {
      invalidateStorefrontCaches();
      revalidatePath("/admin/urunler");
      revalidatePath("/", "layout");
    }
    return { kind: "report", mode, report };
  } catch (error) {
    if (isAppError(error)) return { kind: "error", message: error.message };
    reportError(error, { action: "productImport" });
    return {
      kind: "error",
      message: "İşlem tamamlanamadı, lütfen tekrar deneyin.",
    };
  }
}
